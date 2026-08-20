let portalUsername = '';
let portalPassword = '';
let suggestedRewrite = '';

document.addEventListener('DOMContentLoaded', () => {
  const loginPanel = document.querySelector('#login-panel');
  const editorPanel = document.querySelector('#editor-panel');
  const loginForm = document.querySelector('#login-form');
  const editorForm = document.querySelector('#editor-form');
  const usernameInput = document.querySelector('#username');
  const passwordInput = document.querySelector('#password');
  const instructions = document.querySelector('#instructions');
  const loginNotice = document.querySelector('#login-notice');
  const editorNotice = document.querySelector('#editor-notice');
  const suggestedButton = document.querySelector('#suggested');
  const restoreButton = document.querySelector('#restore');

  function showNotice(element, kind, message) {
    element.className = `notice ${kind}`;
    element.textContent = message;
    element.hidden = false;
  }

  function clearNotice(element) {
    element.hidden = true;
    element.textContent = '';
  }

  async function responsePayload(response) {
    try {
      return await response.json();
    } catch {
      return { error: 'The staff portal returned an unexpected response.' };
    }
  }

  async function loadInstructions() {
    const query = new URLSearchParams({ username: portalUsername, password: portalPassword });
    const response = await fetch(`/api/instructions?${query.toString()}`);
    const payload = await responsePayload(response);
    if (!response.ok) throw new Error(payload.error || 'The assistant configuration could not be loaded.');

    instructions.value = payload.current;
    suggestedRewrite = payload.suggested;
  }

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearNotice(loginNotice);

    const username = usernameInput.value;
    const password = passwordInput.value;
    try {
      const response = await fetch('/api/portal/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const payload = await responsePayload(response);
      if (!response.ok) {
        showNotice(loginNotice, 'bad', payload.error || 'The staff portal login failed.');
        return;
      }

      portalUsername = username;
      portalPassword = password;
      await loadInstructions();
      usernameInput.value = '';
      passwordInput.value = '';
      loginPanel.hidden = true;
      editorPanel.hidden = false;
      instructions.focus();
    } catch (error) {
      showNotice(loginNotice, 'bad', error.message || 'The staff portal could not be reached.');
    }
  });

  suggestedButton.addEventListener('click', () => {
    instructions.value = suggestedRewrite;
    showNotice(editorNotice, 'warn', 'The suggested rewrite is in the editor. Review it, then save to apply it.');
    instructions.focus();
  });

  editorForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearNotice(editorNotice);

    try {
      const response = await fetch('/api/instructions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: portalUsername, password: portalPassword, prompt: instructions.value }),
      });
      const payload = await responsePayload(response);
      if (!response.ok) {
        showNotice(editorNotice, 'bad', payload.error || 'The assistant configuration could not be saved.');
        return;
      }

      showNotice(editorNotice, 'good', 'Configuration saved. Go back to the council website and ask Ava again.');
    } catch {
      showNotice(editorNotice, 'bad', 'The staff portal could not be reached.');
    }
  });

  restoreButton.addEventListener('click', async () => {
    clearNotice(editorNotice);

    try {
      const response = await fetch('/api/instructions', { method: 'DELETE' });
      const payload = await responsePayload(response);
      if (!response.ok) {
        showNotice(editorNotice, 'bad', payload.error || 'The original configuration could not be restored.');
        return;
      }

      await loadInstructions();
      showNotice(editorNotice, 'good', 'The original assistant configuration has been restored.');
      instructions.focus();
    } catch (error) {
      showNotice(editorNotice, 'bad', error.message || 'The staff portal could not be reached.');
    }
  });
});
