let running = false; // Variável para controlar o estado do script
let index1 = 0;
let question1, question2;
let vagasStorage = []; // Armazena as vagas coletadas

document.addEventListener("keydown", function(event) {
  if (event.keyCode === 113) { // F2 para iniciar/parar
    if (!running) {
      // Inicia o script
      question1 = prompt("Quantos segundos para percorrer cada vaga?");
      question2 = prompt("Quais palavras procurar? (Separe por vírgula)").toLowerCase();
      
      if (question1 > 0) {
        // Converte a string de palavras separadas por vírgula em um array de palavras
        question2 = question2.split(",");
        running = true;
        console.log("Script iniciado.");
        loopLista1();
      }
    } else {
      // Para o script e gera o CSV
      running = false;
      console.log("Script interrompido.");
      gerarCSV(); // Gera o arquivo CSV ao interromper o script
    }
  }
});

function loopLista1() {
  if (!running) return; // Interrompe o loop se running for false
  const span = Array.from(document.querySelectorAll('span')).find(el => el.textContent.trim() === 'Configurar alerta');
console.log("O index agora é: "+index1)
  var listaElementos = span.parentNode.parentNode.parentNode.parentNode.parentNode.children[1].children[3].children;
  
  if (index1 < listaElementos.length) {
    if(!listaElementos[index1].textContent.includes("Refinar")){
    var indexLista = listaElementos[index1];
    indexLista.children[0].children[0].click();
    indexLista.scrollIntoView();
    
    setTimeout(() => {
      if (!running) return; // Interrompe o loop se running for false
      
      let descriptionText1, descriptionText2;
      let palavrasEncontradas = [];

      try {
        // Extrair o título da vaga
        var tituloVaga = listaElementos[index1].children[0].children[0].children[0].children[0].children[1].children[0].children[0].children[0].children[0].textContent.toLowerCase();
      } catch (e) {
        palavrasEncontradas.push("Sem título 1");
      }

      // Verifica se alguma das palavras-chave está no título
      palavrasEncontradas = question2.filter(palavra => tituloVaga.includes(palavra));

      try {
        // Primeira descrição
        descriptionText1 = document.getElementsByClassName("text-heading-large")[1].parentNode.textContent.toLowerCase();
      } catch (e) {
        console.log("Sem descrição 1");
      }

      try {
        // Segunda descrição
        descriptionText2 = document.getElementsByClassName("text-heading-large")[0].parentNode.textContent.toLowerCase();
      } catch (e) {
        console.log("Sem descrição 2");
      }

      // Adiciona palavras encontradas nas descrições, se existirem
      if (descriptionText1) {
        if (descriptionText1.includes("sobre a vaga")) {
          palavrasEncontradas.push(...question2.filter(palavra => descriptionText1.includes(palavra)));
        }
      } else if (descriptionText2) {
        if (descriptionText2.includes("sobre a vaga")) {
          palavrasEncontradas.push(...question2.filter(palavra => descriptionText2.includes(palavra)));
        }
      } else {
        palavrasEncontradas.push("Sem descrição 3");
      }

      // Remove duplicatas das palavras encontradas
      palavrasEncontradas = [...new Set(palavrasEncontradas)];


      let salary = "";
      try {
        salary = document.querySelectorAll('.scaffold-layout__list-container')[0].children[index1].children[0]?.children[0]?.children[0]?.children[0]?.children[1]?.children[3].innerText
      } catch (e) {
        console.log("Elemento de salário não encontrado.");
      }

      let candidatos = "";
      try {
        candidatos = document.getElementsByClassName("t-black--light mt2")[0].children[4]?.textContent;
      } catch (e) {
        console.log("Elemento de candidatos não encontrado.");
      }

      let anuncia = "";
      try {
        anuncia = document.getElementsByClassName("t-black--light mt2")[0].children[2]?.textContent;
      } catch (e) {
        console.log("Elemento de anuncia não encontrado.");
      }

      let candidaturaSimplificada = "";
      try {
        if (document.getElementsByClassName("jobs-apply-button--top-card")[0]?.children[0]?.children[1]?.innerText === "Candidatura simplificada") {
          candidaturaSimplificada = "TRUE";
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
          empresa: nomeEmpresa,
          palavras: palavrasEncontradas.join(", "),
          salary: salary,
          candidatos: candidatos,
          anuncia: anuncia,
          candidatura: candidaturaSimplificada,
          link: indexURL
        });
      }
      
      index1++;
      loopLista1();
    }, question1 * 1000);
  }else{
    index1++;
    loopLista1();
  }
  } else {
    loopLista2();
  }

}

function loopLista2() {
  if (!running) return; // Interrompe o loop se running for false
  
  var listaHorizontal = document.querySelector(".artdeco-pagination__pages--number")?.children;
  
  if (listaHorizontal && listaHorizontal.length > 0) {
    var indexButton = Array.from(listaHorizontal).findIndex(button => button.children[0].getAttribute("aria-current") === "true");
    
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
  let csvContent = "\uFEFFTítulo da Vaga\tEmpresa\tPalavras-Chave Encontradas\tSalário\tCandidatos\tAnuncio da vaga\tCandidatura Simplificada\tLink\n";
  
  // Preenche o conteúdo do CSV com os dados das vagas
  vagasStorage.forEach(vaga => {
    csvContent += `${vaga.titulo}\t${vaga.empresa}\t${vaga.palavras}\t${vaga.salary}\t${vaga.candidatos}\t${vaga.anuncia}\t${vaga.candidatura}\t${vaga.link}\n`;
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
