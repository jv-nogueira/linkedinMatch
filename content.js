'use strict';

const GOOGLE_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzgYl20qiSaDxibUdR0fCA0BDZzlploNnn2LHsUyAGXq2v7t2Yd-zO7Zm0KyE73yUYC/exec';

if (!window.__EXT_JOB_RUNNER_INITIALIZED) {
  window.__EXT_JOB_RUNNER_INITIALIZED = true;

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.action) return;

    if (msg.action === 'start') {
      executarScript(
        msg.words,
        msg.wordsTitle || [],
        msg.saveAll,
        msg.sheetLink,
        msg.useSheet
      );
      sendResponse({ started: true });
    }

    if (msg.action === 'stop') {
      window.running = false;

      if (typeof window.gerarCSV === 'function') {
        window.gerarCSV();
      }

      sendResponse({ stopped: true });
    }

    if (msg.action === 'getStatus') {
      sendResponse({
        running: !!window.running,
        currentIndex: window.currentIndex || 0,
        vagasCount: (window.vagasStorage || []).length
      });
    }
  });
}

// -------------------------------
function executarScript(words = [], wordsTitle = [], saveAll = false, sheetLink = '', useSheet = false) {
  try {
    if (window.__EXT_JOB_RUNNER_ACTIVE) {
      console.log('Script já em execução nesta página.');
      try { chrome.storage.local.set({ running: true }); } catch {}
      return;
    }

    window.__EXT_JOB_RUNNER_ACTIVE = true;
    window.running = true;

    window.vagasStorage = [];
    try { chrome.storage.local.remove(['vagasStorage']); } catch {}

    function extrairIdLinkedin(url) {
      try {
        const match = url.match(/jobs\/view\/(\d+)/);
        return match ? match[1] : null;
      } catch {
        return null;
      }
    }

    function parseCSVLine(line) {
      const result = [];
      let current = '';
      let insideQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }

      result.push(current);
      return result;
    }

    let sheetLinksSet = new Set();

    function isScriptUrl(url = '') {
      const value = (url || '').trim();
      return !!value && (value.includes('script.google.com') || value.includes('/exec'));
    }

    const scriptUrl = (sheetLink || '').trim() || GOOGLE_APPS_SCRIPT_URL;

    async function carregarPlanilha() {
      if (!useSheet || !sheetLink) return;
      if (isScriptUrl(sheetLink)) return;

      try {
        const resp = await fetch(sheetLink);
        const text = await resp.text();

        const linhas = text.split('\n').map(l => l.trim());
        if (!linhas.length) return;

        const header = parseCSVLine(linhas[0]);
        const indexLink = header.findIndex(h => h.trim() === 'Link');

        if (indexLink === -1) {
          console.warn('Coluna "Link" não encontrada exatamente');
          return;
        }

        for (let i = 1; i < linhas.length; i++) {
          const cols = parseCSVLine(linhas[i]);
          const link = (cols[indexLink] || '').replace(/"/g, '').trim();

          const id = extrairIdLinkedin(link);
          if (id) sheetLinksSet.add(id);
        }

        console.log('Planilha carregada:', sheetLinksSet.size, 'IDs');

      } catch (e) {
        console.error('Erro planilha:', e);
      }
    }

    let index1 = 0;

    function saveStatus() {
      try {
        chrome.storage.local.set({
          running: !!window.running,
          currentIndex: index1,
          vagasCount: (window.vagasStorage || []).length,
          lastStatusAt: Date.now()
        });
      } catch {}
    }

    window.addEventListener('beforeunload', () => {
      try { chrome.storage.local.set({ running: false }); } catch {}
    });

    function finalizarExecucao() {
      window.running = false;
      window.__EXT_JOB_RUNNER_ACTIVE = false;

      try { chrome.storage.local.set({ running: false }); } catch {}

      try { chrome.runtime.sendMessage({ action: 'fecharPopup' }); } catch {}
    }

    window.gerarCSV = async function () {
      // Envio em tempo real já foi feito durante o processamento
      // Apenas finaliza a execução
      finalizarExecucao();
    };

    (async () => {
      await carregarPlanilha();
      saveStatus();
      loopLista1();
    })();

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
        } catch {}

        aguardarAriaCurrent(item, () => {
          processarVaga(item, () => {
            index1++;
            saveStatus();
            setTimeout(loopLista1, 300);
          });
        });
      } else {
        setTimeout(loopLista1, 3000);
      }
    }

    function aguardarAriaCurrent(elemento, callback) {
      const verificar = () => {
        try {
          const ativo = elemento.children[0]?.children[0]?.getAttribute('aria-current');
          if (ativo) callback();
          else setTimeout(verificar, 2000);
        } catch {
          setTimeout(verificar, 2000);
        }
      };
      verificar();
    }

    function processarVaga(itemElemento, callback) {
      if (!window.running) return;

      let palavrasTitulo = [];
      let palavrasDescricao = [];

      let tit = '';
      try { tit = itemElemento.querySelector('strong')?.textContent || ''; } catch {}

      const tituloVaga = tit.toLowerCase();

      try {
        palavrasTitulo = (wordsTitle || []).filter(p => tituloVaga.includes(p));
      } catch {}

      const tentarDescricao = () => {
        let jaFinalizou = false;

        try {
          const desc = document.querySelector('#job-details')?.querySelector('p');
          if (!desc) return setTimeout(tentarDescricao, 1000);

          const descriptionText = (desc.innerText || '').toLowerCase();

          if (descriptionText) {
            palavrasDescricao.push(...(words || []).filter(p => descriptionText.includes(p)));
          } else {
            palavrasDescricao.push('Sem descrição');
          }

          palavrasTitulo = [...new Set(palavrasTitulo)];
          palavrasDescricao = [...new Set(palavrasDescricao)];

          let salary = '', candidatos = '', anuncia = '', candidaturaSimplificada = '', nomeEmpresa = '', indexURL = '', modalidade = '';

          try { salary = itemElemento.children[0].children[0].children[0].children[0].children[1].children[3]?.innerText || ''; } catch {}
          try { modalidade = itemElemento.querySelectorAll("ul")[0]?.innerText || ''; } catch {}
          try { candidatos = document.querySelector('.t-black--light.mt2')?.children[0]?.children[4]?.textContent || ''; } catch {}
          try { anuncia = document.querySelector('.t-black--light.mt2')?.children[0]?.children[2]?.textContent || ''; } catch {}
          try { if (document.querySelector('.jobs-apply-button--top-card')?.innerText.includes('Candidatura simplificada')) candidaturaSimplificada = 'TRUE'; } catch {}
          try { nomeEmpresa = itemElemento.children[0].children[0].children[0].children[0].children[1].children[1].children[0]?.innerText || ''; } catch {}
          indexURL = itemElemento.querySelector('a')?.href || '';

          const idVaga = extrairIdLinkedin(indexURL);

          if (useSheet && idVaga && sheetLinksSet.has(idVaga)) {
            jaFinalizou = true;

            try {
              itemElemento.querySelector("button")?.click();
            } catch {}

            saveStatus();
            return callback();
          }

          if ((palavrasTitulo.length > 0 || palavrasDescricao.length > 0 || saveAll) && indexURL) {
            const vagaObj = {
              dataHora: new Date().toLocaleString(),
              titulo: '"' + tit.replace(/\n+/g, ' ') + '"',
              empresa: "'" + nomeEmpresa,
              modalidade,
              palavrasTitulo: palavrasTitulo.join('; '),
              palavrasDescricao: palavrasDescricao.join('; '),
              salary,
              candidatos,
              anuncia,
              candidatura: candidaturaSimplificada,
              link: indexURL,
              descricao: '"' + desc.innerText.replace(/\n+/g, '\n').replace(/"/g, '').trim() + '"'
            };
            window.vagasStorage.push(vagaObj);

            // Envio em tempo real
            if (isScriptUrl(scriptUrl)) {
              chrome.runtime.sendMessage({
                action: 'sendRowsToSheet',
                url: scriptUrl,
                rows: [vagaObj]
              }, (resp) => {
                if (resp && resp.ok) {
                  console.log('Vaga enviada:', vagaObj.titulo);
                } else {
                  console.warn('Falha ao enviar vaga:', resp?.error);
                }
              });
            }
          }

        } catch (e) {
          console.error('Erro processando vaga:', e);
        } finally {
          if (!jaFinalizou) {
            saveStatus();
            callback();
          }
        }
      };

      tentarDescricao();
    }

    function loopLista2() {
      if (!window.running) return;

      try {
        const footer = document.getElementById('jobs-search-results-footer');
        const lista = footer ? Array.from(footer.querySelectorAll('li.jobs-search-pagination__indicator')) : [];

        if (!lista.length) {
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
          window.gerarCSV();
        }

      } catch (e) {
        window.gerarCSV();
      }
    }

  } catch (err) {
    console.error('executarScript erro:', err);
    try { chrome.storage.local.set({ running: false }); } catch {}
  }
}