const PLAN_SHEET_NAME = 'VagaVisualizada';

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, status: 'Ativo' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    const type = e && e.postData && e.postData.type ? e.postData.type : '';

    let payload = {};

    if (typeof raw === 'string') {
      const trimmed = raw.trim();

      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        payload = JSON.parse(trimmed);
      } else if (trimmed.includes('payload=')) {
        const params = new URLSearchParams(trimmed);
        const payloadText = params.get('payload') || '{}';
        payload = JSON.parse(payloadText);
      } else if (type && type.indexOf('application/json') !== -1) {
        payload = JSON.parse(trimmed);
      } else {
        try {
          payload = JSON.parse(trimmed);
        } catch (err) {
          const params = new URLSearchParams(trimmed);
          const payloadText = params.get('payload') || '{}';
          payload = JSON.parse(payloadText);
        }
      }
    }

    const rows = Array.isArray(payload.rows) ? payload.rows : [];

    if (!rows.length) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'Sem dados para gravar' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName(PLAN_SHEET_NAME);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(PLAN_SHEET_NAME);
    }

    const headers = [
      'Data e Hora',
      'Título da Vaga',
      'Empresa',
      'Modalidade',
      'Palavras Título',
      'Palavras Descrição',
      'Salário',
      'Candidatos',
      'Anuncio da vaga',
      'Candidatura Simplificada',
      'Link',
      'Descrição'
    ];

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
    }

    rows.forEach((vaga) => {
      sheet.appendRow([
        vaga.dataHora || '',
        vaga.titulo || '',
        vaga.empresa || '',
        vaga.modalidade || '',
        vaga.palavrasTitulo || '',
        vaga.palavrasDescricao || '',
        vaga.salary || '',
        vaga.candidatos || '',
        vaga.anuncia || '',
        vaga.candidatura || '',
        vaga.link || '',
        vaga.descricao || ''
      ]);
    });

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, inserted: rows.length, sheet: PLAN_SHEET_NAME }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
