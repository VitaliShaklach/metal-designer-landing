// Главная лендинга убрана (код — в ветке landing-archive): корень и старые ссылки ведут в редактор
const {test, expect} = require('@playwright/test');

for (const path of ['/', '/#item=rys', '/#len=800&wid=420&top=970&t=4&deep=1']) {
  test(`корень ${path} → редактор`, async ({page}) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/editor\/$/);
  });
}
