// Playwright мастерской: npm run test:studio:e2e. Свой сервер мастерской на :8766 с рабочей папкой studio/tests/.work.
// Эталона src5 у тестовой копии нет (STUDIO_LYNX_REF → несуществующий файл): сборка эталона — минуты, тестам он не нужен.
// «Сохранить версию»: --repo — несуществующая папка вне репозитория, чтобы сервер тестов не мог дойти до настоящего репозитория
// и его origin (ветка drafts). Кнопку тесты жмут на подставном /api/version, git — в studio/tests/drafts.test.js на временном репозитории.
const {defineConfig}=require('@playwright/test');
const os=require('os'),path=require('path');
const PORT=8766,NO_REPO=path.join(os.tmpdir(),'studio-e2e-no-repo');
module.exports=defineConfig({
  testDir:'e2e',
  workers:1,
  timeout:90000,
  webServer:{command:`node studio/server.js --port ${PORT} --work studio/tests/.work --repo ${JSON.stringify(NO_REPO)} --no-open`,cwd:require('path').join(__dirname,'..','..'),url:`http://127.0.0.1:${PORT}/editor/lynx/`,reuseExistingServer:false,stderr:'pipe',
    env:{STUDIO_LYNX_REF:'нет-такого-файла.obj'}},
  use:{baseURL:`http://127.0.0.1:${PORT}/`,browserName:'chromium',viewport:{width:1440,height:900},launchOptions:{args:['--enable-unsafe-swiftshader']}},
});
