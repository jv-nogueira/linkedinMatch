'use strict';

// Background service worker: performs cross-origin fetch to Apps Script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;

  if (msg.action === 'sendRowsToSheet') {
    (async () => {
      const url = (msg.url || '').trim();
      const rows = msg.rows || [];
      if (!url || !rows.length) return sendResponse({ ok: false, error: 'missing_url_or_rows' });

      const payload = {
        source: 'linkedinMatch',
        sentAt: new Date().toISOString(),
        rows
      };

      const tentativas = [
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        },
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'Accept': 'application/json' },
          body: new URLSearchParams({ payload: JSON.stringify(payload) }).toString()
        }
      ];

      for (const tentativa of tentativas) {
        try {
          const resp = await fetch(url, tentativa);
          const text = await resp.text();
          let parsed = null;
          try { parsed = text ? JSON.parse(text) : null; } catch {}

          if (resp.ok && parsed && parsed.ok === true) {
            return sendResponse({ ok: true, parsed });
          }

          // continue to next tentativa
        } catch (e) {
          // network error, try next
        }
      }

      return sendResponse({ ok: false, error: 'all_attempts_failed' });
    })();

    // indicate we'll call sendResponse asynchronously
    return true;
  }
});
