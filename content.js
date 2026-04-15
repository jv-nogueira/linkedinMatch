'use strict';

if (!window.__EXT_JOB_RUNNER_INITIALIZED) {
  window.__EXT_JOB_RUNNER_INITIALIZED = true;

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.action) return;

    if (msg.action === 'start') {
      executarScript(msg.words, msg.saveAll);
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
            window.__EXT_JOB_RUNNER_ACTIVE = false;

            try {
              if (typeof window.gerarCSV === 'function') window.gerarCSV();
            } catch (e) {
              console.error('Erro ao gerar CSV no stop:', e);
            }

            // limpa dados antigos após gerar o arquivo
            try {
              window.vagasStorage = [];
              chrome.storage.local.remove(['vagasStorage']);
            } catch (e) {
              console.error(e);
            }

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
            try { nomeEmpresa = itemElemento.children[0].children[0].children[0].children[0].children[1].children[1].children[0]?.innerText || ''; } catch {}
            indexURL = itemElemento.querySelector('a')?.href || '';

            if ((palavrasEncontradas.length > 0 || saveAll) && indexURL) {
              window.vagasStorage.push({
                dataHora: new Date().toLocaleString(),
                titulo: '"' + (tit || '').replace(/\n+/g, ' ') + '"',
                empresa: "'" + nomeEmpresa,
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