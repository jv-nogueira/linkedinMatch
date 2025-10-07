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
  keywordsInput.disabled = false; // desbloqueia input
  saveAllCheckbox.disabled = false; // desbloqueia checkbox
  document.getElementById("layoutExecucao")?.classList.add("hidden"); // Oculta layout, se existir
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
  keywordsInput.disabled = true; // bloqueia input
  saveAllCheckbox.disabled = true; // bloqueia checkbox
  document.getElementById("layoutExecucao")?.classList.remove("hidden");

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

  resetInterface(); // reseta botões e layout
});

// Função principal executada na aba
function executarScript(words, saveAll) {
  window.running = true;
  window.vagasStorage = window.vagasStorage || [];
  let index1 = 0;
  console.log("Script iniciado com palavras:", words.join(", "), "| Salvar todas:", saveAll);

  window.gerarCSV = function () {
    if (!window.vagasStorage || window.vagasStorage.length === 0) return;
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

    // Reseta interface após gerar CSV
    const startBtn = document.getElementById("startBtn");
    const stopBtn = document.getElementById("stopBtn");
    const keywordsInput = document.getElementById("keywords");
    const saveAllCheckbox = document.getElementById("saveAll");

    startBtn.style.display = "block";
    stopBtn.style.display = "none";
    keywordsInput.disabled = false;
    saveAllCheckbox.disabled = false;
    document.getElementById("layoutExecucao")?.classList.add("hidden");
    window.running = false;
  };

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

      try { salary = indexLista.children[0].children[0].children[0].children[0].children[1].children[3].innerText; } catch {}
      try { modalidade = indexLista.children[0].children[0].children[0].children[0].children[1].children[2].children[0].children[0].children[0].innerText; } catch {}
      try { candidatos = document.getElementsByClassName("t-black--light mt2")[0].children[0]?.children[4]?.textContent; } catch {}
      try { anuncia = document.getElementsByClassName("t-black--light mt2")[0].children[0].children[2].textContent; } catch {}
      try { if (document.getElementsByClassName("jobs-apply-button--top-card")[0]?.children[0]?.children[1]?.innerText === "Candidatura simplificada") candidaturaSimplificada = "TRUE"; } catch {}
      try { nomeEmpresa = indexLista.children[0].children[0].children[0].children[0].children[1].children[1].children[0]?.innerText; } catch {}
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

    const lista = Array.from(document.querySelectorAll("[id='jobs-search-results-footer']")[0].querySelectorAll("li.jobs-search-pagination__indicator"));
    if (!lista || lista.length === 0) {
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
