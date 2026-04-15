'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const keywordsInput = document.getElementById('keywords');
  const saveAllCheckbox = document.getElementById('saveAll');
  const statusInfoEl = document.getElementById('statusInfo');

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.action === 'fecharPopup') {
      window.close();
    }
  });

  function storageGet(keys) {
    return new Promise(resolve => chrome.storage.local.get(keys, res => resolve(res || {})));
  }

  function storageSet(obj) {
    return new Promise(resolve => chrome.storage.local.set(obj, () => resolve()));
  }

  function tabsQuery(q) {
    return new Promise(resolve => chrome.tabs.query(q, tabs => resolve(tabs || [])));
  }

  function sendMessageToTab(tabId, message) {
    return new Promise(resolve => {
      chrome.tabs.sendMessage(tabId, message, (resp) => {
        if (chrome.runtime.lastError) {
          return resolve({ error: chrome.runtime.lastError.message });
        }
        resolve(resp);
      });
    });
  }

  function updateSaveAllDisabled() {
    saveAllCheckbox.disabled = !keywordsInput.value.trim();
  }

  function updateStatusInfo(text) {
    if (statusInfoEl) statusInfoEl.textContent = text || '';
  }

  let pollingIntervalId = null;

  async function startPollingTabStatus(tabId) {
    if (pollingIntervalId) clearInterval(pollingIntervalId);

    pollingIntervalId = setInterval(async () => {
      const resp = await sendMessageToTab(tabId, { action: 'getStatus' });

      if (resp && !resp.error && resp.running) {
        updateStatusInfo(`Em execução — item ${resp.currentIndex || 0} — armazenadas: ${resp.vagasCount || 0}`);
      } else {
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
        setRunningState(false);
      }
    }, 1500);
  }

  function stopPolling() {
    if (pollingIntervalId) clearInterval(pollingIntervalId);
  }

  async function setRunningState(isRunning) {
    if (isRunning) {
      startBtn.style.display = 'none';
      stopBtn.style.display = 'block';
      keywordsInput.disabled = true;
      saveAllCheckbox.disabled = true;
      updateStatusInfo('Em execução...');
    } else {
      startBtn.style.display = 'block';
      stopBtn.style.display = 'none';
      keywordsInput.disabled = false;
      updateSaveAllDisabled();
      updateStatusInfo('');
    }

    await storageSet({ running: !!isRunning });

    if (!isRunning) stopPolling();
  }

  (async () => {
    const data = await storageGet(['running', 'keywords', 'saveAll']);

    keywordsInput.value = data.keywords || '';
    saveAllCheckbox.checked = !!data.saveAll;
    updateSaveAllDisabled();

    const tabs = await tabsQuery({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (data.running && tab) {
      const resp = await sendMessageToTab(tab.id, { action: 'getStatus' });

      if (resp && resp.running) {
        await setRunningState(true);
        startPollingTabStatus(tab.id);
      } else {
        await setRunningState(false);
      }
    } else {
      await setRunningState(false);
    }
  })();

  keywordsInput.addEventListener('input', async () => {
    updateSaveAllDisabled();
    await storageSet({ keywords: keywordsInput.value });
  });

  saveAllCheckbox.addEventListener('change', async () => {
    await storageSet({ saveAll: saveAllCheckbox.checked });
  });

  startBtn.addEventListener('click', async () => {
    const keywords = keywordsInput.value.trim();
    if (!keywords) return alert('Preencha as palavras-chave.');

    const words = keywords.toLowerCase().split(',').map(p => p.trim()).filter(Boolean);
    const saveAll = saveAllCheckbox.checked;

    const tabs = await tabsQuery({ active: true, currentWindow: true });
    const tab = tabs[0];

    await storageSet({ keywords, saveAll, running: true });
    await setRunningState(true);

    await sendMessageToTab(tab.id, {
      action: 'start',
      words,
      saveAll
    });

    startPollingTabStatus(tab.id);
  });

  stopBtn.addEventListener('click', async () => {
    const tabs = await tabsQuery({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (tab) {
      await sendMessageToTab(tab.id, { action: 'stop' });
    }

    await setRunningState(false);
    await storageSet({ running: false });
    window.close();
  });

  window.addEventListener('unload', stopPolling);
});