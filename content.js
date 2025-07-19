let running = false; // Variável para controlar o estado do script
let index1 = 0;
let question1, question2;
let vagasStorage = []; // Armazena as vagas coletadas

document.addEventListener("keydown", function(event) {
  if (event.keyCode === 113) { // F2 para iniciar/parar
    if (!running) {
      if (document.getElementById('ext-modal-overlay')) return; // já está aberta

      const overlay = document.createElement('div');
      overlay.id = 'ext-modal-overlay';
      overlay.style = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.4);
        z-index: 99999;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: Arial, sans-serif;
      `;
      
      const box = document.createElement('div');
      box.style = `
        background: #fff;
        color: black;
        padding: 20px;
        border-radius: 10px;
        width: 350px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        position: relative;
      `;
      
      box.innerHTML = `
        <button id="ext-modal-close" style="
          position: absolute; top: 10px; right: 10px;
          background: none; border: none; font-size: 20px; cursor: pointer;
          color: #666;
        " title="Fechar">&times;</button>
      
        <div style="margin-bottom: 15px;">
          <label for="ext-q1" style="display: block; margin-bottom: 5px; color: black;">Quantos segundos para percorrer cada vaga?</label>
          <input id="ext-q1" type="number" min="1" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; color: black;" />
        </div>
      
        <div style="margin-bottom: 20px;">
          <label for="ext-q2" style="display: block; margin-bottom: 5px; color: black;">Quais palavras procurar? (Separe por vírgula)</label>
          <input id="ext-q2" type="text" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; color: black;" />
        </div>
      
        <div style="text-align: right;">
          <button id="ext-modal-confirm" style="
            background-color: #007bff;
            color: white;
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          ">Confirmar</button>
        </div>
      `;
      
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      

      overlay.appendChild(box);
      document.body.appendChild(overlay);

      const close = () => overlay.remove();

      document.getElementById('ext-modal-close').onclick = close;

      const confirm = () => {
        const q1 = document.getElementById('ext-q1').value.trim();
        const q2 = document.getElementById('ext-q2').value.trim().toLowerCase();

        if (!q1 || !q2) {
          alert("Preencha todos os campos.");
          return;
        }

        question1 = Number(q1);
        question2 = q2.split(',').map(p => p.trim()).filter(Boolean);

        if (question1 > 0) {
          running = true;
          console.log("Script iniciado.");
          close();
          loopLista1();
        }
      };

      document.getElementById('ext-modal-confirm').onclick = confirm;

      overlay.querySelectorAll('input').forEach(input => {
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') confirm();
        });
      });
    } else {
      running = false;
      console.log("Script interrompido.");
      gerarCSV();
    }
  }
});

function loopLista1() {
  if (!running) return; // Interrompe o loop se running for false
console.log("O index agora é: "+index1)
  var listaElementos = document.querySelectorAll("li[id^='ember']");
  
  if (index1 < listaElementos.length) {
    var indexLista = listaElementos[index1];
    indexLista.children[0].children[0].click();
    indexLista.scrollIntoView();
    
    setTimeout(() => {
      if (!running) return; // Interrompe o loop se running for false
      
      let palavrasEncontradas = [];

      try {
        // Extrair o título da vaga
        var tituloVaga = indexLista.querySelector("strong").textContent.toLowerCase();
      } catch (e) {
        palavrasEncontradas.push("Sem título 1");
      }

      // Verifica se alguma das palavras-chave está no título
      palavrasEncontradas = question2.filter(palavra => tituloVaga.includes(palavra));

      let descriptionText;
      try {
        descriptionText = document.querySelector("[id='job-details']").innerText.toLowerCase();
      } catch (e) {
        console.log("Sem descrição");
      }

      // Adiciona palavras encontradas nas descrições, se existirem
      if (descriptionText) {
        if (descriptionText.includes("sobre a vaga")) {
          palavrasEncontradas.push(...question2.filter(palavra => descriptionText.includes(palavra)));
        }else{
          palavrasEncontradas.push("Não encontrado o sobre a vaga");
        }
      } else {
        palavrasEncontradas.push("Não encontrado a descrição");
      }

      // Remove duplicatas das palavras encontradas
      palavrasEncontradas = [...new Set(palavrasEncontradas)];

      let salary = "";
      try {
        salary = indexLista.children[0].children[0].children[0].children[0].children[1].children[3].innerText
      } catch (e) {
        console.log("Elemento de salário não encontrado.");
      }

      let candidatos = "";
      try {
        candidatos = document.getElementsByClassName("t-black--light mt2")[0].children[0]?.children[4]?.textContent;
      } catch (e) {
        console.log("Elemento de candidatos não encontrado.");
      }

      let anuncia = "";
      try {
        anuncia = document.getElementsByClassName("t-black--light mt2")[0].children[0].children[2].textContent;
      } catch (e) {
        console.log("Elemento de anuncia não encontrado.");
      }

      let candidaturaSimplificada = "";
      try {
        if (document.getElementsByClassName("jobs-apply-button--top-card")[0]?.children[0]?.children[1]?.innerText === "Candidatura simplificada") {
          candidaturaSimplificada = "TRUE";
        }else{
          candidaturaSimplificada = "";
        }
      } catch (e) {
        console.log("Elemento de candidatura simplificada não encontrado.");
      }

      var indexURL = indexLista.querySelector('a')?.href;

      if (palavrasEncontradas.length > 0 && indexURL) {
        // Extrair informações do nome da empresa
        let nomeEmpresa = indexLista.children[0].children[0].children[0].children[0].children[1].children[1].children[0]?.innerText;

        // Armazena os dados no array, incluindo as palavras encontradas
        vagasStorage.push({
          titulo: tituloVaga,
          empresa: "'"+nomeEmpresa,
          palavras: palavrasEncontradas.join("; "),
          salary: salary,
          candidatos: candidatos,
          anuncia: anuncia,
          candidatura: candidaturaSimplificada,
          link: indexURL,
          descricao: '"'+descriptionText+'"'
        });
      }
      index1++;
      loopLista1();
    }, question1 * 1000);
  } else {
    loopLista2();
  }

}

function loopLista2() {
  if (!running) return; // Interrompe o loop se running for false
  
  var listaHorizontal = document.querySelector("[aria-label='Ver página anterior']").parentNode.children[1].children;
  
  if (listaHorizontal && listaHorizontal.length > 0) {
    var indexButton = Array.from(listaHorizontal).findIndex(button => button.children[0].getAttribute("aria-current") === "page")
    
    if (indexButton >= 0 && indexButton + 1 < listaHorizontal.length) {
      listaHorizontal[indexButton + 1].children[0].click();
      index1 = 0;
      setTimeout(loopLista1, 2000);
    } else {
      console.log("Fim da navegação ou botão de próxima página não encontrado.");
      gerarCSV(); // Gera o arquivo CSV ao final da navegação
    }
  } else {
    console.log("Elemento de paginação não encontrado.");
    gerarCSV(); // Gera o arquivo CSV se não houver paginação
  }
}

function gerarCSV() {
  // Cria o conteúdo do CSV com cabeçalhos
  let csvContent = "\uFEFFTítulo da Vaga\tEmpresa\tPalavras-Chave Encontradas\tSalário\tCandidatos\tAnuncio da vaga\tCandidatura Simplificada\tLink\tDescrição\n";
  
  // Preenche o conteúdo do CSV com os dados das vagas
  vagasStorage.forEach(vaga => {
    csvContent += `${vaga.titulo}\t${vaga.empresa}\t${vaga.palavras}\t${vaga.salary}\t${vaga.candidatos}\t${vaga.anuncia}\t${vaga.candidatura}\t${vaga.link}\t${vaga.descricao}\n`;
  });

  // Cria um Blob com o conteúdo do CSV
  let blob = new Blob([csvContent], { type: "text/plan" });
  
  // Cria um link para fazer o download do CSV
  let link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.download = "vagasStorage.txt";
  
  // Adiciona o link à página e clica automaticamente para iniciar o download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log("CSV gerado com sucesso.");
}
