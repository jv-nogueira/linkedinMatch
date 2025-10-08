// popup.js — cole inteiro no seu arquivo (Manifest V3)
// Garante que, ao reabrir o popup, ele reflita o estado real do script na aba ativa.

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const keywordsInput = document.getElementById('keywords');
  const saveAllCheckbox = document.getElementById('saveAll');
  const statusInfoEl = document.getElementById('statusInfo'); // opcional

  if (!startBtn || !stopBtn || !keywordsInput || !saveAllCheckbox) {
    console.error('popup.js: IDs não encontrados (verifique popup.html).');
    return;
  }

  // Fecha o popup quando o content script terminar a execução
  chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.action === 'fecharPopup') {
    window.close();
  }
  });

  // --- Wrappers Promisificados ---
  function storageGet(keys) {
    return new Promise(resolve => {
      try {
        chrome.storage.local.get(keys, res => resolve(res || {}));
      } catch (e) {
        console.error('storageGet error', e);
        resolve({});
      }
    });
  }
  function storageSet(obj) {
    return new Promise(resolve => {
      try {
        chrome.storage.local.set(obj, () => resolve());
      } catch (e) {
        console.error('storageSet error', e);
        resolve();
      }
    });
  }
  function tabsQuery(q) {
    return new Promise(resolve => {
      try {
        chrome.tabs.query(q, tabs => resolve(tabs || []));
      } catch (e) {
        console.error('tabsQuery error', e);
        resolve([]);
      }
    });
  }
  function executeScriptOnTab(tabId, func, args = []) {
    return new Promise((resolve, reject) => {
      try {
        chrome.scripting.executeScript(
          { target: { tabId }, func, args },
          (res) => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            resolve(res);
          }
        );
      } catch (e) {
        reject(e);
      }
    });
  }
  function sendMessageToTab(tabId, message) {
    return new Promise(resolve => {
      try {
        chrome.tabs.sendMessage(tabId, message, (resp) => {
          if (chrome.runtime.lastError) {
            // retorna objeto com erro (não causa rejeição para não quebrar fluxo)
            return resolve({ error: chrome.runtime.lastError.message });
          }
          resolve(resp);
        });
      } catch (e) {
        resolve({ error: e.message });
      }
    });
  }

  // --- UI helpers ---
  function updateSaveAllDisabled() {
    const hasKeywords = keywordsInput.value.trim().length > 0;
    saveAllCheckbox.disabled = !hasKeywords;
  }

  function updateStatusInfo(text) {
    if (!statusInfoEl) return;
    statusInfoEl.textContent = text || '';
  }

  let pollingIntervalId = null;

  async function startPollingTabStatus(tabId) {
    // Se houver polling anterior, limpe:
    if (pollingIntervalId) clearInterval(pollingIntervalId);
    pollingIntervalId = setInterval(async () => {
      const resp = await sendMessageToTab(tabId, { action: 'getStatus' });
      if (resp && !resp.error && resp.running) {
        updateStatusInfo(`Em execução — item ${resp.currentIndex || 0} — armazenadas: ${resp.vagasCount || 0}`);
      } else {
        // se o script não existe mais, pare o polling e atualize UI
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
        setRunningState(false);
      }
    }, 1500);
  }

  function stopPolling() {
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
      pollingIntervalId = null;
    }
  }

  // --- Estado visual e persistência ---
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

  // --- Inicialização (restaura valores e tenta sincronizar com content script) ---
  (async () => {
    try {
      const data = await storageGet(['running', 'keywords', 'saveAll']);
      keywordsInput.value = data.keywords || '';
      saveAllCheckbox.checked = !!data.saveAll;
      updateSaveAllDisabled();

      if (data.running) {
        // tenta perguntar diretamente ao content script na aba ativa
        const tabs = await tabsQuery({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (tab) {
          const resp = await sendMessageToTab(tab.id, { action: 'getStatus' });
          if (resp && !resp.error && resp.running) {
            // content script confirmou que está rodando
            await setRunningState(true);
            updateStatusInfo(`Em execução — item ${resp.currentIndex || 0} — armazenadas: ${resp.vagasCount || 0}`);
            startPollingTabStatus(tab.id);
          } else {
            // fallback: content script não responde -> considera que não está rodando
            await setRunningState(false);
          }
        } else {
          await setRunningState(false);
        }
      } else {
        await setRunningState(false);
      }
    } catch (e) {
      console.error('Erro na inicialização do popup:', e);
      await setRunningState(false);
    }
  })();

  // --- Eventos de UI ---
  keywordsInput.addEventListener('input', async () => {
    updateSaveAllDisabled();
    try { await storageSet({ keywords: keywordsInput.value }); } catch (e) { console.error(e); }
  });

  saveAllCheckbox.addEventListener('change', async () => {
    try { await storageSet({ saveAll: saveAllCheckbox.checked }); } catch (e) { console.error(e); }
  });

  startBtn.addEventListener('click', async () => {
    const keywords = keywordsInput.value.trim();
    if (!keywords) {
      alert('Preencha as palavras-chave separadas por vírgula.');
      return;
    }
    const words = keywords.toLowerCase().split(',').map(p => p.trim()).filter(Boolean);
    const saveAll = saveAllCheckbox.checked;

    const tabs = await tabsQuery({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab) {
      alert('Aba ativa não encontrada.');
      return;
    }

    // salva estado e injeta o script
    await storageSet({ keywords, saveAll, running: true });
    await setRunningState(true);

    try {
      await executeScriptOnTab(tab.id, executarScript, [words, saveAll]);
      // tenta sincronizar imediatamente e iniciar polling para atualizar UI
      const resp = await sendMessageToTab(tab.id, { action: 'getStatus' });
      if (resp && !resp.error && resp.running) {
        updateStatusInfo(`Em execução — item ${resp.currentIndex || 0} — armazenadas: ${resp.vagasCount || 0}`);
        startPollingTabStatus(tab.id);
      } else {
        // se não respondeu, mas não falhou na injeção, ainda mantemos UI em execução
        updateStatusInfo('Em execução...');
        startPollingTabStatus(tab.id);
      }
    } catch (execErr) {
      console.error('Falha ao injetar script:', execErr);
      alert('Não foi possível injetar o script nesta aba (ver console).');
      await setRunningState(false);
      await storageSet({ running: false });
    }
  });

  stopBtn.addEventListener('click', async () => {
    try {
      const tabs = await tabsQuery({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (tab) {
        // pede ao content script para parar e gerar CSV
        await sendMessageToTab(tab.id, { action: 'stop' });
        window.close();
      }
    } catch (e) {
      console.error('Erro ao enviar stop:', e);
    } finally {
      await setRunningState(false);
      await storageSet({ running: false });
    }
  });

  // Ao fechar o popup, limpa polling
  window.addEventListener('unload', () => {
    stopPolling();
  });

  // -------------------------------
  // Função a ser injetada na aba
  // (coloquei aqui dentro para o executeScript injetá-la corretamente)
  // -------------------------------
  function executarScript(words = [], saveAll = false) {
    try {
      if (window.__EXT_JOB_RUNNER_ACTIVE) {
        console.log('Script já em execução nesta página.');
        // atualiza storage caso necessário
        try { chrome.storage.local.set({ running: true }); } catch (e) {}
        return;
      }
      window.__EXT_JOB_RUNNER_ACTIVE = true;
      window.running = true;

      // Limpa dados antigos para reinício limpo
      window.vagasStorage = [];
      try { chrome.storage.local.remove(['vagasStorage']); } catch(e){ console.error(e); }

      let index1 = 0;

      // salva status no chrome.storage.local
      function saveStatus() {
        try {
          chrome.storage.local.set({
            running: !!window.running,
            currentIndex: index1,
            vagasCount: (window.vagasStorage || []).length,
            lastStatusAt: Date.now()
          });
        } catch (e) {
          console.error('saveStatus error', e);
        }
      }

      // listener para mensagens vindas do popup
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        try {
          if (!msg || !msg.action) {
            sendResponse({ ok: false });
            return;
          }
          if (msg.action === 'getStatus') {
            sendResponse({
              running: !!window.running,
              currentIndex: index1,
              vagasCount: (window.vagasStorage || []).length
            });
            return; // resposta síncrona
          }
          if (msg.action === 'stop') {
            window.running = false;
            window.__EXT_JOB_RUNNER_ACTIVE = false; // garante que o start funcione de novo

            // limpa dados antigos
            window.vagasStorage = [];
            try { chrome.storage.local.remove(['vagasStorage']); } catch(e){ console.error(e); }
            
            try {
              if (typeof window.gerarCSV === 'function') window.gerarCSV();
            } catch (e) { console.error('Erro ao gerar CSV no stop:', e); }
            sendResponse({ stopped: true });
            return;
          }
          sendResponse({ ok: true });
        } catch (e) {
          console.error('onMessage error', e);
          try { sendResponse({ error: e.message }); } catch {}
        }
      });

      // garante que, ao recarregar a página, o armazenamento marque como false (página reiniciou)
      window.addEventListener('beforeunload', () => {
        try { chrome.storage.local.set({ running: false }); } catch (e) {}
      });

      // função para finalizar execução (gera sinal para popup opcionalmente)
      function finalizarExecucao() {
        // Para execução e reseta flag
        window.running = false;
        window.__EXT_JOB_RUNNER_ACTIVE = false;

        try { 
          chrome.storage.local.set({ running: false }); 
        } catch (e) { 
          console.error('Erro ao resetar storage', e);
        }

        try { 
          chrome.runtime.sendMessage({ action: 'fecharPopup' }); 
        } catch (e) { 
          // ignora erro
        }
      }

      // função para gerar o arquivo (mantida globalmente)
      window.gerarCSV = function () {
        try {
          if (!window.vagasStorage || window.vagasStorage.length === 0) {
            finalizarExecucao(); // já reseta flags
            return;
          }

          let csvContent = "\uFEFFData e Hora\tTítulo da Vaga\tEmpresa\tModalidade\tPalavras-Chave Encontradas\tSalário\tCandidatos\tAnuncio da vaga\tCandidatura Simplificada\tLink\tDescrição\n";
          window.vagasStorage.forEach(vaga => {
            csvContent += `${vaga.dataHora}\t${vaga.titulo}\t${vaga.empresa}\t${vaga.modalidade}\t${vaga.palavras}\t${vaga.salary}\t${vaga.candidatos}\t${vaga.anuncia}\t${vaga.candidatura}\t${vaga.link}\t${vaga.descricao}\n`;
          });

          const blob = new Blob([csvContent], { type: 'text/plain' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = 'vagasStorage.txt';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          console.log('Arquivo gerado com sucesso.');

        } catch (e) {
          console.error('Erro gerarCSV:', e);
        } finally {
          finalizarExecucao(); // reseta flags mesmo em caso de erro
        }
      };

      // salva estado inicial
      saveStatus();

      // --- Lógica principal (mesma ideia do seu script) ---
      loopLista1();

      function loopLista1() {
        if (!window.running) return;
        const listaElementos = Array.from(document.querySelectorAll("li[class^='ember-view']"));
        if (index1 >= listaElementos.length) return loopLista2();

        const item = listaElementos[index1];
        const botaoClick = item.querySelector('ul');

        if (botaoClick) {
          try {
            item.scrollIntoView();
            botaoClick.click();
          } catch (e) { console.warn('Erro ao clicar item', e); }

          aguardarAriaCurrent(item, () => {
            processarVaga(item, () => {
              index1++;
              saveStatus();
              setTimeout(loopLista1, 300); // pequeno delay
            });
          });
        } else {
          setTimeout(() => {
            console.log('Item não renderizado; tentando novamente...');
            loopLista1();
          }, 3000);
        }
      }

      function aguardarAriaCurrent(elemento, callback) {
        const verificar = () => {
          try {
            const ativo = elemento.children[0]?.children[0]?.getAttribute('aria-current');
            if (ativo) callback();
            else setTimeout(verificar, 2000);
          } catch (e) {
            setTimeout(verificar, 2000);
          }
        };
        verificar();
      }

      function processarVaga(itemElemento, callback) {
        if (!window.running) return;
        let palavrasEncontradas = [];

        let tit = '';
        try { tit = itemElemento.querySelector('strong')?.textContent || ''; } catch (e) { tit = ''; }

        const tituloVaga = (tit || '').toLowerCase();
        try { palavrasEncontradas = (words || []).filter(p => tituloVaga.includes(p)); } catch (e) { palavrasEncontradas = []; }

        const tentarDescricao = () => {
          try {
            const desc = document.querySelector('#job-details')?.querySelector('p');
            if (!desc) { setTimeout(tentarDescricao, 1000); return; }

            const descriptionText = (desc.innerText || '').toLowerCase();
            if (descriptionText) palavrasEncontradas.push(...(words || []).filter(p => descriptionText.includes(p)));
            else palavrasEncontradas.push('Sem descrição');

            palavrasEncontradas = [...new Set(palavrasEncontradas)];

            let salary = '', candidatos = '', anuncia = '', candidaturaSimplificada = '', nomeEmpresa = '', indexURL = '', modalidade = '';

            try { salary = itemElemento.children[0].children[0].children[0].children[0].children[1].children[3]?.innerText || ''; } catch {}
            try { modalidade = itemElemento.querySelectorAll("ul")[0]?.innerText || ''; } catch {}
            try { candidatos = document.querySelector('.t-black--light.mt2')?.children[0]?.children[4]?.textContent || ''; } catch {}
            try { anuncia = document.querySelector('.t-black--light.mt2')?.children[0]?.children[2]?.textContent || ''; } catch {}
            try { if (document.querySelector('.jobs-apply-button--top-card')?.innerText.includes('Candidatura simplificada')) candidaturaSimplificada = 'TRUE'; } catch {}
            try { nomeEmpresa = itemElemento.querySelector('strong')?.innerText || ''; } catch {}
            indexURL = itemElemento.querySelector('a')?.href || '';

            if ((palavrasEncontradas.length > 0 || saveAll) && indexURL) {
              window.vagasStorage.push({
                dataHora: new Date().toLocaleString(),
                titulo: '"' + (tit || '').replace(/\n+/g, ' ') + '"',
                empresa: "'" + (nomeEmpresa || ''),
                modalidade: modalidade,
                palavras: palavrasEncontradas.join('; '),
                salary: salary,
                candidatos: candidatos,
                anuncia: anuncia,
                candidatura: candidaturaSimplificada,
                link: indexURL,
                descricao: '"' + (desc?.innerText || '').replace(/\n+/g, '\n').replace(/"/g, '').trim() + '"'
              });
            }
          } catch (e) {
            console.error('Erro processando vaga:', e);
          } finally {
            saveStatus();
            callback();
          }
        };

        tentarDescricao();
      }

      function loopLista2() {
        if (!window.running) return;
        try {
          const footer = document.querySelector("[id='jobs-search-results-footer']") || document.getElementById('jobs-search-results-footer');
          const lista = footer ? Array.from(footer.querySelectorAll('li.jobs-search-pagination__indicator')) : [];
          if (!lista || lista.length === 0) {
            console.log('Nenhuma paginação encontrada. Gerando arquivo...');
            window.gerarCSV();
            return;
          }

          const indexAtual = lista.findIndex(btn => btn.children[0]?.getAttribute('aria-current') === 'page');
          if (indexAtual >= 0 && indexAtual + 1 < lista.length) {
            lista[indexAtual + 1].children[0].click();
            index1 = 0;
            saveStatus();
            setTimeout(loopLista1, 2000);
          } else {
            console.log('Fim da navegação.');
            try {
              chrome.runtime.sendMessage({ action: 'fecharPopup' });
            } catch (e) {
              console.error('Erro ao enviar mensagem para fechar popup:', e);
            }
            window.gerarCSV();
          }
        } catch (e) {
          console.error('Erro loopLista2:', e);
          window.gerarCSV();
        }
      }
    } catch (err) {
      console.error('executarScript erro:', err);
      try { chrome.storage.local.set({ running: false }); } catch (e) {}
    }
  } // fim executarScript
});
