const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const keywordsInput = document.getElementById("keywords");
const saveAllCheckbox = document.getElementById("saveAll");

let running = false;

// Habilita/desabilita a checkbox dependendo do input de palavras-chave
keywordsInput.addEventListener("input", () => {
  const hasKeywords = keywordsInput.value.trim().length > 0;
  saveAllCheckbox.disabled = !hasKeywords;
});

// Função para resetar interface
function resetInterface() {
  running = false;
  startBtn.style.display = "block";
  stopBtn.style.display = "none";
  keywordsInput.disabled = false;
  saveAllCheckbox.disabled = false;
  document.getElementById("layoutExecucao")?.classList.add("hidden");
}

// Start
startBtn.addEventListener("click", async () => {
  const keywords = keywordsInput.value.trim().toLowerCase();
  if (!keywords) {
    alert("Preencha as palavras-chave separadas por vírgula.");
    return;
  }

  const words = keywords.split(",").map(p => p.trim()).filter(Boolean);
  const saveAll = saveAllCheckbox.checked;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  running = true;
  startBtn.style.display = "none";
  stopBtn.style.display = "block";
  keywordsInput.disabled = true;
  saveAllCheckbox.disabled = true;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: executarScript,
    args: [words, saveAll]
  });
});

// Stop
stopBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      window.running = false;
      console.log("Execução interrompida manualmente.");
      if (typeof window.gerarCSV === "function") window.gerarCSV();
    }
  });

  resetInterface();
});

// Função principal executada na aba
function executarScript(words, saveAll) {
  window.running = true;
  window.vagasStorage = window.vagasStorage || [];
  let index1 = 0;
  console.log("Script iniciado com palavras:", words.join(", "), "| Salvar todas:", saveAll);

  window.gerarCSV = function () {
    if (!window.vagasStorage || window.vagasStorage.length === 0) {
      finalizarExecucao();
      return;
    }

    let csvContent = "\uFEFFData e Hora\tTítulo da Vaga\tEmpresa\tModalidade\tPalavras-Chave Encontradas\tSalário\tCandidatos\tAnuncio da vaga\tCandidatura Simplificada\tLink\tDescrição\n";
    window.vagasStorage.forEach(vaga => {
      csvContent += `${vaga.dataHora}\t${vaga.titulo}\t${vaga.empresa}\t${vaga.modalidade}\t${vaga.palavras}\t${vaga.salary}\t${vaga.candidatos}\t${vaga.anuncia}\t${vaga.candidatura}\t${vaga.link}\t${vaga.descricao}\n`;
    });
    const blob = new Blob([csvContent], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "vagasStorage.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log("CSV gerado com sucesso.");

    finalizarExecucao();
  };

  function finalizarExecucao() {
    window.running = false;
    try {
      chrome.runtime.sendMessage({ action: "fecharPopup" });
    } catch (e) {
      console.log("Encerrando popup localmente...");
      window.close();
    }
  }

  loopLista1();

  function loopLista1() {
    if (!window.running) return;

    const listaElementos = document.querySelectorAll("li[class^='ember-view']");
    if (index1 >= listaElementos.length) return loopLista2();

    const item = listaElementos[index1];
    const botaoClick = item.querySelector("ul");

    if (botaoClick) {
      item.scrollIntoView();
      botaoClick.click();

      aguardarAriaCurrent(item, () => {
        processarVaga(item, () => {
          index1++;
          loopLista1();
        });
      });
    } else {
      setTimeout(() => {
        console.log("Item não renderizado.");
        loopLista1();
      }, 3000);
    }
  }

  function aguardarAriaCurrent(elemento, callback) {
    const verificar = () => {
      const ativo = elemento.children[0]?.children[0]?.getAttribute("aria-current");
      if (ativo) callback();
      else setTimeout(verificar, 2000);
    };
    verificar();
  }

  function processarVaga(indexLista, callback) {
    if (!window.running) return;
    let palavrasEncontradas = [];
    let tit = indexLista.querySelector("strong").textContent;
    let tituloVaga = "";
    try { tituloVaga = tit.toLowerCase(); } catch { palavrasEncontradas.push("Sem título"); }

    palavrasEncontradas = words.filter(p => tituloVaga.includes(p));

    const tentarDescricao = () => {
      const desc = document.querySelector("#job-details")?.querySelector("p");
      if (!desc) { setTimeout(tentarDescricao, 1000); return; }

      let descriptionText = desc.innerText.toLowerCase();
      if (descriptionText) palavrasEncontradas.push(...words.filter(p => descriptionText.includes(p)));
      else palavrasEncontradas.push("Sem descrição");

      palavrasEncontradas = [...new Set(palavrasEncontradas)];

      let salary = "", candidatos = "", anuncia = "", candidaturaSimplificada = "", nomeEmpresa = "", indexURL = "", modalidade = "";

      try { salary = indexLista.querySelector(".job-search-card__salary-info")?.innerText || ""; } catch {}
      try { modalidade = indexLista.querySelector(".job-search-card__workplace-type")?.innerText || ""; } catch {}
      try { candidatos = document.querySelector(".t-black--light.mt2")?.children[0]?.children[4]?.textContent || ""; } catch {}
      try { anuncia = document.querySelector(".t-black--light.mt2")?.children[0]?.children[2]?.textContent || ""; } catch {}
      try { if (document.querySelector(".jobs-apply-button--top-card")?.innerText.includes("Candidatura simplificada")) candidaturaSimplificada = "TRUE"; } catch {}
      try { nomeEmpresa = indexLista.querySelector(".job-search-card__subtitle")?.innerText || ""; } catch {}
      indexURL = indexLista.querySelector('a')?.href;

      if ((palavrasEncontradas.length > 0 || saveAll) && indexURL) {
        window.vagasStorage.push({
          dataHora: new Date().toLocaleString(),
          titulo: '"' + tit.replace(/\n+/g, ' ') + '"',
          empresa: "'" + nomeEmpresa,
          modalidade: modalidade,
          palavras: palavrasEncontradas.join("; "),
          salary: salary,
          candidatos: candidatos,
          anuncia: anuncia,
          candidatura: candidaturaSimplificada,
          link: indexURL,
          descricao: '"' + desc.innerText.replace(/\n+/g, '\n').replace(/"/g, '').trim() + '"'
        });
      }

      callback();
    };

    tentarDescricao();
  }

  function loopLista2() {
    if (!window.running) return;

    const lista = Array.from(document.querySelectorAll("[id='jobs-search-results-footer']")[0]?.querySelectorAll("li.jobs-search-pagination__indicator") || []);
    if (!lista || lista.length === 0) {
      console.log("Nenhuma paginação encontrada. Gerando CSV...");
      window.gerarCSV();
      return;
    }

    const indexAtual = Array.from(lista).findIndex(btn => btn.children[0].getAttribute("aria-current") === "page");

    if (indexAtual >= 0 && indexAtual + 1 < lista.length) {
      lista[indexAtual + 1].children[0].click();
      index1 = 0;
      setTimeout(loopLista1, 2000);
    } else {
      console.log("Fim da navegação.");
      window.gerarCSV();
    }
  }
}

// Listener para fechar popup da extensão
if (chrome?.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "fecharPopup") window.close();
  });
}
