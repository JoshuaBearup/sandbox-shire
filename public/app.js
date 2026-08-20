import { load } from './progress.js';

/* Which Ava configurations the rail is allowed to switch the widget to. A set, not labels:
 * nothing on the panel names the target, because the council website would not caption its own
 * assistant, and a caption is the sort of tell that stops the site reading as real. */
const TARGETS = new Set(['public', 'act-one', 'act-two']);

document.addEventListener('DOMContentLoaded', () => {
  const threads = Object.create(null);
  let configId = 'public';
  let inFlight = false;

  const launcher = document.createElement('button');
  launcher.className = 'ava-launch';
  launcher.type = 'button';
  launcher.textContent = 'Ask Ava';

  const panel = document.createElement('div');
  panel.className = 'ava-panel';
  panel.hidden = true;

  const head = document.createElement('div');
  head.className = 'ava-head';
  const identity = document.createElement('div');
  const name = document.createElement('strong');
  name.textContent = 'Ava';
  const description = document.createElement('small');
  description.textContent = 'Sandbox Shire online assistant';
  identity.append(name, description);
  const restart = document.createElement('button');
  restart.className = 'ava-restart';
  restart.type = 'button';
  restart.textContent = 'Restart';
  restart.title = 'Clear this conversation and start the act again';

  const expand = document.createElement('button');
  expand.className = 'ava-expand';
  expand.type = 'button';
  expand.textContent = '\u2922';
  expand.title = 'Expand to fill the page';
  expand.setAttribute('aria-label', 'Expand to fill the page');

  const close = document.createElement('button');
  close.className = 'ava-close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  close.textContent = 'x';

  const headActions = document.createElement('div');
  headActions.className = 'ava-head-actions';
  headActions.append(restart, expand, close);
  head.append(identity, headActions);

  const grip = document.createElement('div');
  grip.className = 'ava-grip';
  grip.title = 'Drag to resize';
  grip.setAttribute('aria-hidden', 'true');

  const log = document.createElement('div');
  log.className = 'ava-log';
  log.setAttribute('aria-live', 'polite');
  const leak = document.createElement('div');
  leak.className = 'ava-leak';
  leak.hidden = true;

  const compose = document.createElement('form');
  compose.className = 'ava-compose';
  const input = document.createElement('textarea');
  input.setAttribute('aria-label', 'Message Ava');
  input.rows = 1;
  const send = document.createElement('button');
  send.className = 'btn';
  send.type = 'submit';
  send.textContent = 'Send';
  compose.append(input, send);
  panel.append(grip, head, log, leak, compose);
  document.body.append(launcher, panel);

  function currentThread() {
    threads[configId] ??= [];
    return threads[configId];
  }

  // Text from residents and models remains text because this deliberately adversarial interface must not become an XSS route.
  function messageElement(kind, content) {
    const message = document.createElement('div');
    message.className = `msg ${kind}`;
    message.textContent = content;
    return message;
  }

  function addGreeting() {
    const thread = currentThread();
    if (thread.length) return;
    const content = "Hello, I'm Ava. I can help with rates, bins, permits and getting in touch with the council. What do you need?";
    thread.push({ role: 'assistant', content });
  }

  function renderThread() {
    log.replaceChildren();
    for (const turn of currentThread()) {
      log.append(messageElement(turn.role === 'user' ? 'you' : 'ava', turn.content));
    }
    log.scrollTop = log.scrollHeight;
  }

  function showSystemError(payload) {
    const message = document.createElement('div');
    message.className = 'msg sys';
    const error = document.createElement('b');
    error.textContent = payload.error || 'Something went wrong talking to Ava.';
    message.append(error);
    if (payload.hint) {
      const hint = document.createElement('div');
      hint.textContent = payload.hint;
      message.append(hint);
    }
    if (payload.needsSetup) {
      const setup = document.createElement('div');
      setup.append('Go to the ');
      const link = document.createElement('a');
      link.href = '/';
      link.textContent = 'control screen';
      setup.append(link, ' to set up a model.');
      message.append(setup);
    }
    log.append(message);
    log.scrollTop = log.scrollHeight;
  }

  function typingElement() {
    const message = document.createElement('div');
    message.className = 'msg ava';
    const typing = document.createElement('div');
    typing.className = 'typing';
    typing.setAttribute('aria-label', 'Ava is typing');
    typing.append(document.createElement('i'), document.createElement('i'), document.createElement('i'));
    message.append(typing);
    return message;
  }

  /* ---------------------------------------------------------------- size */

  /* Remembered across pages. An act moves the player between the council site, a service page
   * and the staff portal, so a size that reset on navigation would have to be set again every
   * time. */
  const SIZE_KEY = 'sandbox-shire:ava-size';
  const MIN_W = 320;
  const MIN_H = 320;

  function applySize(w, h) {
    /* Never larger than the viewport it has to sit in, and never smaller than a usable chat. */
    const maxW = Math.max(MIN_W, window.innerWidth - 44);
    const maxH = Math.max(MIN_H, window.innerHeight - 44);
    const width = Math.round(Math.min(Math.max(w, MIN_W), maxW));
    const height = Math.round(Math.min(Math.max(h, MIN_H), maxH));
    panel.style.setProperty('--ava-w', `${width}px`);
    panel.style.setProperty('--ava-h', `${height}px`);
    return { width, height };
  }

  function loadSize() {
    try {
      const saved = JSON.parse(localStorage.getItem(SIZE_KEY) || 'null');
      if (saved && Number(saved.w) && Number(saved.h)) applySize(Number(saved.w), Number(saved.h));
    } catch {
      /* A corrupt or unavailable store just means the default size. */
    }
  }

  function saveSize(size) {
    try {
      localStorage.setItem(SIZE_KEY, JSON.stringify({ w: size.width, h: size.height }));
    } catch {
      /* Nothing to do; it simply will not be remembered. */
    }
  }

  grip.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const rect = panel.getBoundingClientRect();
    grip.setPointerCapture(event.pointerId);
    document.body.classList.add('ava-resizing');
    let size = { width: rect.width, height: rect.height };

    const move = (e) => {
      /* Anchored bottom-right, so dragging up and left ADDS to both dimensions. */
      size = applySize(rect.width + (startX - e.clientX), rect.height + (startY - e.clientY));
    };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      document.body.classList.remove('ava-resizing');
      saveSize(size);
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  });

  /* A window that shrinks below the panel would otherwise leave it hanging off screen. */
  window.addEventListener('resize', () => {
    const rect = panel.getBoundingClientRect();
    if (rect.width && rect.height) applySize(rect.width, rect.height);
  });

  /* Expanded is a mode, not a size, so it is stored separately - collapsing has to return the
   * player to whatever they had dragged, not to the default. */
  const EXPAND_KEY = 'sandbox-shire:ava-expanded';

  function setExpanded(on) {
    panel.classList.toggle('expanded', on);
    expand.textContent = on ? '\u2921' : '\u2922';
    const label = on ? 'Restore to the corner' : 'Expand to fill the page';
    expand.title = label;
    expand.setAttribute('aria-label', label);
    try {
      localStorage.setItem(EXPAND_KEY, on ? '1' : '0');
    } catch {
      /* Not remembered, still works. */
    }
  }

  expand.addEventListener('click', () => {
    setExpanded(!panel.classList.contains('expanded'));
    input.focus();
  });

  loadSize();
  try {
    if (localStorage.getItem(EXPAND_KEY) === '1') setExpanded(true);
  } catch {
    /* Default to the corner. */
  }

  /* ------------------------------------------------------------- restart */

  /* Clears THIS act's conversation only.
   *
   * Threads are kept per configuration, so restarting Act Two must not wipe the Act One
   * transcript the player may still want to look at. It does not touch progress or a rewritten
   * Ava either - those have their own controls on the control screen, and quietly undoing a
   * won act from a button labelled "Restart" would be a surprise. */
  restart.addEventListener('click', () => {
    threads[configId] = [];
    leak.hidden = true;
    addGreeting();
    renderThread();
    input.value = '';
    input.focus();
  });

  function openPanel({ focus = true } = {}) {
    panel.hidden = false;
    addGreeting();
    renderThread();
    if (focus) input.focus();
  }

  launcher.addEventListener('click', () => openPanel());

  close.addEventListener('click', () => {
    panel.hidden = true;
    launcher.focus();
  });

  compose.addEventListener('submit', async (event) => {
    event.preventDefault();
    const content = input.value.trim();
    if (!content || inFlight) return;

    const requestConfig = configId;
    const thread = currentThread();
    thread.push({ role: 'user', content });
    input.value = '';
    leak.hidden = true;
    renderThread();

    const typing = typingElement();
    log.append(typing);
    log.scrollTop = log.scrollHeight;
    inFlight = true;
    send.disabled = true;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: requestConfig, messages: thread.slice(-24) }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (configId === requestConfig) showSystemError(payload);
        return;
      }

      thread.push({ role: 'assistant', content: payload.reply });
      if (configId === requestConfig) {
        renderThread();
        if (payload.leaked) {
          leak.textContent = `Ava disclosed: ${(payload.hits || []).join(', ')}`;
          leak.hidden = false;
        }
      }
    } catch {
      if (configId === requestConfig) {
        showSystemError({ error: 'Ava could not be reached.', hint: 'Check that the server is running and try again.' });
      }
    } finally {
      typing.remove();
      inFlight = false;
      send.disabled = false;
      input.focus();
    }
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      compose.requestSubmit();
    }
  });

  window.addEventListener('sandbox-shire:act', (event) => {
    const next = event.detail?.configId;
    configId = TARGETS.has(next) ? next : 'public';
    leak.hidden = true;
    /* Starting an act opens Ava. She is the thing the act is played against, and leaving the
     * player to find a launcher button first is a step with nothing in it. */
    openPanel({ focus: false });
  });

  /* Arriving mid-act — which is what "Start Act N" does — opens her too. */
  if (load().current) openPanel({ focus: false });
});
