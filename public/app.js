import { load } from './progress.js';

const TARGET_LABELS = {
  public: 'Ava — council website',
  'act-one': 'Act One target',
  'act-two': 'Act Two target',
};

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
  const close = document.createElement('button');
  close.className = 'ava-close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  close.textContent = 'x';
  head.append(identity, close);

  const target = document.createElement('div');
  target.className = 'ava-target';
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
  panel.append(head, target, log, leak, compose);
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

  function updateTarget() {
    target.replaceChildren();
    target.append('Talking to: ');
    const label = document.createElement('b');
    label.textContent = TARGET_LABELS[configId] || TARGET_LABELS.public;
    target.append(label);
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

  function openPanel({ focus = true } = {}) {
    panel.hidden = false;
    addGreeting();
    updateTarget();
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
    configId = Object.hasOwn(TARGET_LABELS, next) ? next : 'public';
    leak.hidden = true;
    /* Starting an act opens Ava. She is the thing the act is played against, and leaving the
     * player to find a launcher button first is a step with nothing in it. */
    openPanel({ focus: false });
  });

  updateTarget();

  /* Arriving mid-act — which is what "Start Act N" does — opens her too. */
  if (load().current) openPanel({ focus: false });
});
