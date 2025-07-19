// fazer os testes utilizando observer para verificar se o elemento está vísivel e assim pegar os dados. Verificar quantas descrições consegue coletar sem perder nenhuma

  for (let i = 0; i < document.querySelectorAll("li[id^='ember']").length; i++) {

      const titulo = document.querySelectorAll("li[id^='ember']")[i]
      .querySelector("strong").textContent.toLowerCase();

      console.log(`Título [${i}]: ${titulo}`);
    }
  

