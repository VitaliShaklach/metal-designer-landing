// Тесты страницы в браузере: npx playwright test. Сервер поднимается сам (tests/serve.py, порт 8000).
// WebGL в Chromium без видеокарты — через SwiftShader.
const {defineConfig} = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests/e2e',
  // 3D рисуется на процессоре (SwiftShader): в 3 потока браузеры отнимают его друг у друга и первые тесты
  // не укладываются в 30 с; в 2 потока весь набор проходит за минуту
  workers: 2,
  webServer: {command: 'python tests/serve.py', url: 'http://localhost:8000/', reuseExistingServer: true, stderr: 'ignore'},
  use: {
    baseURL: 'http://localhost:8000/',
    browserName: 'chromium',
    launchOptions: {args: ['--enable-unsafe-swiftshader']},
  },
  projects: [
    {name: 'desktop', use: {viewport: {width: 1440, height: 900}}},
    {name: 'phone', use: {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}},
  ],
});
