let running = false;
let index1 = 0;
let question2;
let vagasStorage = [];

document.addEventListener("keydown", function(event) {
  if (event.keyCode === 113) { // F2
    if (!running) {
      if (document.getElementById('ext-modal-overlay')) return;

      const overlay = document.createElement('div');
      overlay.id = 'ext-modal-overlay';
      overlay.style = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.4); z-index: 99999;
        display: flex; justify-content: center; align-items: center;
        font-family: Arial, sans-serif;
      `;

      const box = document.createElement('div');
      box.style = `
        background: #fff; color: black; padding: 20px;
        border-radius: 10px; width: 350px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2); position: relative;
      `;

      box.innerHTML = `
        <button id="ext-modal-close" style="
          position: absolute; top: 10px; right: 10px;
          background: none; border: none; font-size: 20px; cursor: pointer;
          color: #666;
        " title="Fechar">&times;</button>

        <div style="margin-bottom: 20px;">
          <label for="ext-q2" style="display: block; margin-bottom: 5px; color: black;">Quais palavras procurar? (Separe por vírgula)</label>
          <input id="ext-q2" type="text" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; color: black;" />
        </div>

        <div style="text-align: right;">
          <button id="ext-modal-confirm" style="
            background-color: #007bff; color: white;
            padding: 8px 16px; border: none;
            border-radius: 4px; cursor: pointer;
          ">Confirmar</button>
        </div>
      `;

      overlay.appendChild(box);
      document.body.appendChild(overlay);

      const close = () => overlay.remove();
      document.getElementById('ext-modal-close').onclick = close;

      const confirm = () => {
        const q2 = document.getElementById('ext-q2').value.trim().toLowerCase();
        if (!q2) {
          alert("Preencha o campo de palavras-chave.");
          return;
        }
        question2 = q2.split(',').map(p => p.trim()).filter(Boolean);
        running = true;
        console.log("Script iniciado.");
        close();
        loopLista1();
      };

      document.getElementById('ext-modal-confirm').onclick = confirm;

      overlay.querySelector('input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') confirm();
      });

    } else {
      running = false;
      console.log("Script interrompido.");
      gerarCSV();
    }
  }
});

function loopLista1() {
  if (!running) return;

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
  let palavrasEncontradas = [];

  let tituloVaga = "";
  try {
    tituloVaga = indexLista.querySelector("strong").textContent.toLowerCase();
  } catch (e) {
    palavrasEncontradas.push("Sem título");
  }

  palavrasEncontradas = question2.filter(p => tituloVaga.includes(p));
  let descriptionText = "";

  const tentarDescricao = () => {
    const desc = document.querySelector("#job-details").querySelector("p");
    if (!desc) {
      setTimeout(tentarDescricao, 1000);
      return;
    }

    descriptionText = desc.innerText.toLowerCase();
    if (descriptionText) {
      palavrasEncontradas.push(...question2.filter(p => descriptionText.includes(p)));
    } else {
      palavrasEncontradas.push("Não encontrado o sobre a vaga");
    }

    palavrasEncontradas = [...new Set(palavrasEncontradas)];

    let salary = "", candidatos = "", anuncia = "", candidaturaSimplificada = "", nomeEmpresa = "", indexURL = "";

    try {
      salary = indexLista.children[0].children[0].children[0].children[0].children[1].children[3].innerText;
    } catch {}

    try {
      candidatos = document.getElementsByClassName("t-black--light mt2")[0].children[0]?.children[4]?.textContent;
    } catch {}

    try {
      anuncia = document.getElementsByClassName("t-black--light mt2")[0].children[0].children[2].textContent;
    } catch {}

    try {
      if (document.getElementsByClassName("jobs-apply-button--top-card")[0]?.children[0]?.children[1]?.innerText === "Candidatura simplificada") {
        candidaturaSimplificada = "TRUE";
      }
    } catch {}

    try {
      nomeEmpresa = indexLista.children[0].children[0].children[0].children[0].children[1].children[1].children[0]?.innerText;
    } catch {}

    indexURL = indexLista.querySelector('a')?.href;

    if (palavrasEncontradas.length > 0 && indexURL) {
      vagasStorage.push({
        dataHora: new Date().toLocaleString(),
        titulo: tituloVaga,
        empresa: "'" + nomeEmpresa,
        palavras: palavrasEncontradas.join("; "),
        salary: salary,
        candidatos: candidatos,
        anuncia: anuncia,
        candidatura: candidaturaSimplificada,
        link: indexURL,
        descricao:  '"' + desc.innerText.replace(/\n+/g, '\n').replace(/"/g, '').trim() + '"'
      });
    }

    callback();
  };

  tentarDescricao();
}

function loopLista2() {
  if (!running) return;

  const lista = Array.from(document.querySelectorAll("[id='jobs-search-results-footer']")[0].querySelectorAll("li.jobs-search-pagination__indicator"))

  if (!lista || lista.length === 0) return gerarCSV();

  const indexAtual = Array.from(lista).findIndex(btn => btn.children[0].getAttribute("aria-current") === "page");

  if (indexAtual >= 0 && indexAtual + 1 < lista.length) {
    lista[indexAtual + 1].children[0].click();
    index1 = 0;
    setTimeout(loopLista1, 2000);
  } else {
    console.log("Fim da navegação.");
    gerarCSV();
  }
}

function gerarCSV() {
  let csvContent = "\uFEFFData e Hora\tTítulo da Vaga\tEmpresa\tPalavras-Chave Encontradas\tSalário\tCandidatos\tAnuncio da vaga\tCandidatura Simplificada\tLink\tDescrição\n";
  vagasStorage.forEach(vaga => {
    csvContent += `${vaga.dataHora}\t${vaga.titulo}\t${vaga.empresa}\t${vaga.palavras}\t${vaga.salary}\t${vaga.candidatos}\t${vaga.anuncia}\t${vaga.candidatura}\t${vaga.link}\t${vaga.descricao}\n`;
  });

  let blob = new Blob([csvContent], { type: "text/plain" });
  let link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "vagasStorage.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log("CSV gerado com sucesso.");
}
