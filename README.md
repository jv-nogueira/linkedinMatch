# Automação para match nas vagas do LinkedIn

## Descrição
Este projeto percorre automaticamente as vagas do LinkedIn, filtra pela palavra-chave e exporta para uma planilha

## Observações
A extensão visa potencializar a aderência do seu perfil com as vagas, mas isso não te garante conseguir recolocação profissional

O LinkedIn deve estar no idioma português (Brasil), caso contrário a extensão não vai funcionar adequadamente

O LinkedIn tem políticas de uso contra bots, então use a extensão por conta e risco

## Contato
- E-mail: <a href="mailto:jvnogueira2010@gmail.com">jvnogueira2010@gmail.com</a>
- LinkedIn: [www.linkedin.com/in/nogueira-jv](https://www.linkedin.com/in/nogueira-jv/)
- Youtube: [www.youtube.com/@JoviProgramador](https://www.youtube.com/@JoviProgramador)

## Enviar dados para Google Sheets (rápido)

1. Abra o Google Sheets e crie uma planilha nova.
2. Copie o ID da planilha (parte do URL entre `/d/` e `/edit`).
3. Crie um novo projeto em https://script.google.com e cole o conteúdo de `apps_script.gs`.
4. Atualize `SHEET_ID` no `apps_script.gs` com o ID da sua planilha e, se desejar, ajuste `SHEET_NAME`.
5. Publique → Implantar como aplicativo da web (Deploy → New deployment). Configure "Executar como: EU" e "Quem tem acesso" conforme necessário.
6. Copie a URL do Apps Script (deve conter `/exec`) e cole no campo "Link da planilha CSV ou URL do Apps Script" no popup da extensão.
7. Abra o popup da extensão e use a seção "Enviar teste para Planilha" para enviar uma linha de exemplo.

Observação: este é um método simples que evita autenticação OAuth no cliente — use com cuidado e ajuste permissões do Apps Script conforme sua política.
