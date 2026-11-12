// Тесты страницы в браузере: npx playwright test. Сервер поднимается сам (tests/serve.py, порт 8000).
// Порт 8000 занят сервером из другой папки — STUDIO_E2E_PORT=8010 npx playwright test: свой сервер на своём порту
// (иначе reuseExistingServer молча возьмёт чужой и тесты проверят не те файлы).
// WebGL в Chromium без видеокарты — через SwiftShader.
const {defineConfig} = require('@playwright/test');
const PORT = process.env.STUDIO_E2E_PORT || '8000';

module.exports = defineConfig({
  testDir: 'tests/e2e',
  // 3D рисуется на процессоре (SwiftShader), раскрой рыси считается минутами: в 2 потока браузеры отнимают процессор
  // друг у друга, и каждый прогон какой-нибудь тест не укладывался в 30 с (13.11: blocks, tabs, mangal — каждый раз разный).
  // В 1 поток — 209 из 209 за 20,6 мин, столько же, сколько в 2 потока (18,6–20,4 мин)
  workers: 1,
  webServer: {command: 'python tests/serve.py', url: `http://localhost:${PORT}/`, reuseExistingServer: true, stderr: 'ignore'},
  use: {
    baseURL: `http://localhost:${PORT}/`,
    browserName: 'chromium',
    launchOptions: {args: ['--enable-unsafe-swiftshader']},
  },
  projects: [
    {name: 'desktop', use: {viewport: {width: 1440, height: 900}}},
    {name: 'phone', use: {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}},
  ],
});
