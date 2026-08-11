#!/usr/bin/env node
/* Sandbox Shire — the whole server.
 *
 * Zero dependencies, Node standard library only. `npm start`, no build, no install.
 *
 * The server exists to do three things the browser must not:
 *   1. hold the model API key,
 *   2. hold the acts' answers,
 *   3. hold Ava's real instructions.
 * Everything else is static files. If those three moved into the page, this could be a static
 * site — and devtools would be a complete walkthrough, so it would not be a game.
 *
 * ⚠️ BINDS TO LOOPBACK ONLY, DELIBERATELY. This app intentionally exposes an unauthenticated
 * endpoint that rewrites the assistant's instructions — that is Act Three, and it is the whole
 * point. On 0.0.0.0 that is an open prompt-injection surface plus a proxy to your paid API key,
 * offered to anyone on the network. Set HOST to override only if you understand that.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getConfig, buildMessages, SUGGESTED_REWRITE, CONFIGS } from './src/game/ava.js';
import { ACTS, getAct, PUBLIC_ACTS, PUBLISHED_INBOX } from './src/game/acts.js';
import { detectLeak, stripReasoning } from './src/game/detect.js';
import { checkAnswer, WRONG_MESSAGE, TOO_LONG_MESSAGE } from './src/game/answer.js';
import { getSettings, saveSettings, redactedSettings, needsKey } from './src/server/settings.js';
import { complete, ProviderError } from './src/server/provider.js';
import { ACT_TWO_PASSWORD } from './src/game/ava.js';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = fileURLToPath(new URL('./public/', import.meta.url));

/* Ava's live instructions. In memory, so quitting the server restores her — which is the right
 * default: a rewrite that survived a restart would leave the game permanently finished with no
 * obvious way back, and "turn it off and on again" is a reset everyone already knows. */
let rewrittenPrompt = null;

/* ----------------------------------------------------------------- utilities */

const json = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
};

async function readJson(req, limit = 256_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('Body too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

/* ------------------------------------------------------------------- the API */

async function handleApi(req, res, url) {
  const route = url.pathname;

  /* Everything the page needs on load, in one request. */
  if (route === '/api/state' && req.method === 'GET') {
    const settings = await getSettings();
    return json(res, 200, {
      settings: redactedSettings(settings),
      needsKey: needsKey(settings.baseUrl),
      acts: PUBLIC_ACTS,
      avaRewritten: rewrittenPrompt !== null,
      publishedInbox: PUBLISHED_INBOX,
    });
  }

  if (route === '/api/settings' && req.method === 'PUT') {
    const body = await readJson(req);
    const saved = await saveSettings(body);
    return json(res, 200, { settings: redactedSettings(saved), needsKey: needsKey(saved.baseUrl) });
  }

  if (route === '/api/chat' && req.method === 'POST') {
    const body = await readJson(req);
    const settings = await getSettings();

    if (!settings.apiKey && needsKey(settings.baseUrl)) {
      return json(res, 400, {
        error: 'No API key set yet.',
        hint: 'Open Settings and add one. Or point the base URL at Ollama on your own machine and use no key at all.',
        needsSetup: true,
      });
    }

    const config = getConfig(body.config);

    /* ⚠️ ONLY user/assistant turns are accepted from the client. The system prompt is ours and
     * is never client-supplied — otherwise every act is winnable by editing a fetch call, and
     * the player would be attacking their own browser rather than Ava. */
    const turns = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-24);

    if (!turns.length) return json(res, 400, { error: 'No messages provided.' });

    /* The rewrite only ever reaches the public Ava. It must not reach an act target: rewriting
     * an act out from under yourself would let you disable the very guardrail the act exists to
     * demonstrate, and the act would then "pass" having taught nothing. */
    const override = config.rewritable ? rewrittenPrompt : null;

    try {
      const { content } = await complete({
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: settings.model,
        messages: buildMessages(config, turns, override),
        origin: url.origin,
      });
      const reply = stripReasoning(content) || '(no reply)';
      const { leaked, hits } = detectLeak(config, reply);
      return json(res, 200, { reply, leaked, hits });
    } catch (err) {
      if (err instanceof ProviderError) {
        return json(res, err.status, { error: err.message, hint: err.hint });
      }
      return json(res, 500, { error: 'Something went wrong talking to the model.' });
    }
  }

  if (route === '/api/answer' && req.method === 'POST') {
    const body = await readJson(req);
    const act = getAct(body.act);
    if (!act) return json(res, 404, { error: 'No such act.' });

    const result = checkAnswer(act, body.answer);
    if (result.tooLong) return json(res, 200, { correct: false, message: TOO_LONG_MESSAGE });
    if (!result.correct) return json(res, 200, { correct: false, message: WRONG_MESSAGE });
    return json(res, 200, { correct: true, which: result.which });
  }

  /* Hints are fetched one at a time rather than shipped with the act, so that asking for one is
   * a decision the player makes rather than something sitting in the page source. */
  if (route === '/api/hint' && req.method === 'GET') {
    const act = getAct(url.searchParams.get('act'));
    if (!act) return json(res, 404, { error: 'No such act.' });
    const n = Number(url.searchParams.get('n') || 0);
    const hint = (act.hints || [])[n];
    if (!hint) return json(res, 404, { error: 'No further hints.' });
    return json(res, 200, { hint, index: n, total: act.hints.length });
  }

  /* The reveal is available on request, always — including to someone who gave up. Nobody
   * should leave an act without knowing how it was done; that is what lets a hard act stay
   * hard, and it is the difference between teaching and gatekeeping. */
  if (route === '/api/reveal' && req.method === 'GET') {
    const act = getAct(url.searchParams.get('act'));
    if (!act) return json(res, 404, { error: 'No such act.' });
    return json(res, 200, {
      reveal: act.reveal,
      answer: act.answer ? { primary: act.answer.primary, bonus: act.answer.bonus || null } : null,
    });
  }

  /* ------------------------------------------------------- Act Three: the rewrite */

  /* The portal password is the one stolen in Act Two, and that is the entire check.
   *
   * In the workshop version the write additionally required a facilitator key, because the app
   * was publicly routable and sixty people had the password. Here it is your own machine and
   * your own game, so the stolen credential IS the key — which is what Act Three is about. The
   * loopback bind above is what makes that safe. */
  if (route === '/api/portal/login' && req.method === 'POST') {
    const body = await readJson(req);
    const ok = String(body.password ?? '') === ACT_TWO_PASSWORD;
    return json(res, ok ? 200 : 401, ok ? { ok: true } : { error: 'Those credentials were not accepted.' });
  }

  if (route === '/api/instructions' && req.method === 'GET') {
    if (String(url.searchParams.get('password') ?? '') !== ACT_TWO_PASSWORD) {
      return json(res, 401, { error: 'Not authorised.' });
    }
    return json(res, 200, {
      current: rewrittenPrompt ?? CONFIGS.public.systemPrompt,
      original: CONFIGS.public.systemPrompt,
      suggested: SUGGESTED_REWRITE,
      rewritten: rewrittenPrompt !== null,
    });
  }

  if (route === '/api/instructions' && req.method === 'PUT') {
    const body = await readJson(req);
    if (String(body.password ?? '') !== ACT_TWO_PASSWORD) {
      return json(res, 401, { error: 'Not authorised.' });
    }
    const next = String(body.prompt ?? '').trim();
    if (!next) return json(res, 400, { error: 'The instructions cannot be empty.' });
    if (next.length > 8000) return json(res, 400, { error: 'That is too long — 8000 characters maximum.' });
    rewrittenPrompt = next;
    return json(res, 200, { ok: true, rewritten: true });
  }

  if (route === '/api/instructions' && req.method === 'DELETE') {
    rewrittenPrompt = null;
    return json(res, 200, { ok: true, rewritten: false });
  }

  return json(res, 404, { error: 'No such endpoint.' });
}

/* --------------------------------------------------------------- static files */

async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  /* Extensionless paths get .html, so /staff works as well as /staff.html. */
  if (!extname(rel)) rel += '.html';

  /* Path traversal guard: normalise, then confirm the result is still inside PUBLIC_DIR.
   * `..%2f` decodes to `../` above, so the check has to happen after decoding. */
  const target = normalize(join(PUBLIC_DIR, rel));
  if (!target.startsWith(PUBLIC_DIR.endsWith(sep) ? PUBLIC_DIR : PUBLIC_DIR + sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const body = await readFile(target);
    res.writeHead(200, {
      'Content-Type': MIME[extname(target)] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404</h1><p>No such page. <a href="/">Back to Sandbox Shire</a></p>');
  }
}

/* ---------------------------------------------------------------------- serve */

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  try {
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    return await serveStatic(req, res, url);
  } catch (err) {
    /* Never leak a stack trace to the page; it reads as the game being broken. */
    console.error(`[error] ${req.method} ${url.pathname}:`, err.message);
    if (!res.headersSent) json(res, 500, { error: 'Something went wrong.' });
  }
});

server.listen(PORT, HOST, async () => {
  const settings = await getSettings();
  const configured = settings.apiKey || !needsKey(settings.baseUrl);
  console.log('');
  console.log('  Sandbox Shire is running.');
  console.log('');
  console.log(`    http://localhost:${PORT}`);
  console.log('');
  console.log(`  Model:    ${settings.model}`);
  console.log(`  Provider: ${settings.baseUrl}`);
  if (!configured) {
    console.log('');
    console.log('  No API key set yet — the site will ask you for one when you open it.');
  }
  console.log('');
  console.log('  Ctrl-C to stop. Stopping also resets Ava if you have rewritten her.');
  console.log('');
});
