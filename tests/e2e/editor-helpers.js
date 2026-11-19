// Общие помощники e2e-тестов редактора (editor-mangal / editor-lynx / editor-home .spec.js)

const HOST = 'localhost:8000';

// Открывает страницу и собирает за всё время: запросы не на свой сервер, ответы 4xx/5xx, ошибки страницы и консоли.
async function openEditor(page, path) {
  const r = {external: [], failed: [], errors: []};
  page.on('request', q => { if (!/^(data|blob):/.test(q.url()) && new URL(q.url()).host !== HOST) r.external.push(q.url()); });
  page.on('response', s => { if (s.status() >= 400) r.failed.push(s.status() + ' ' + s.url()); });
  page.on('pageerror', e => r.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') r.errors.push(m.text()); });
  await page.goto(path, {waitUntil: 'load'});
  return r;
}

module.exports = {HOST, openEditor};
