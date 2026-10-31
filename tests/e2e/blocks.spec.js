// Нижние блоки: «Сейчас / с Metal Designer», «Как работаем», «Виталий», карточка ссылки, кнопка на телефоне
const {test, expect} = require('@playwright/test');

const TG = 'https://t.me/SHVA_1984';
const SITE = 'https://vitalishaklach.github.io/metal-designer-landing/';

// дословно из спеки, разделы 4 и 5
const ROWS = [
  ['Пара дней', '1 день'],
  ['Нужно толковое ТЗ', 'Достаточно подробных фото и описания словами'],
  ['Размеры потом не подвинуть', 'Двигаете сами'],
  ['Правка: снова к проектировщику и ждать', 'Правите сами'],
  ['Пересчёт вручную', 'Детали, раскрой, масса, DXF пересчитываются сами'],
  ['Другому клиенту — новый заказ', 'Другой размер для другого клиента: сами, бесплатно, в любой момент'],
];
const STEPS = [
  'Присылаете подробные фото и описание словами.',
  'Я проектирую: 3D, размеры, раскрой, DXF, чертёж и план сборки.',
  'Завтра получаете ссылку на свой проект.',
  'Нужен такой же другому клиенту, но другого размера, или надо поправить — делаете сами, бесплатно, в любой момент, и сразу получаете готовый проект.',
];

const texts = (page, sel) => page.locator(sel).evaluateAll(els => els.map(e => e.textContent.trim().replace(/\s+/g, ' ')));

test('copy: таблица, шаги и строка под ними — дословно из спеки', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('#vs .col-old h3')).toHaveText('Проектировщик на стороне');
  await expect(page.locator('#vs .col-new h3')).toHaveText('Metal Designer');
  expect(await texts(page, '#vs .col-old li')).toEqual(ROWS.map(r => r[0]));
  expect(await texts(page, '#vs .col-new li')).toEqual(ROWS.map(r => r[1]));
  expect(await texts(page, '#how .steps li')).toEqual(STEPS);
  await expect(page.locator('#how .note')).toHaveText('Обычно 1 день. Срочно сделаю быстрее. Бесплатно, пока запускаюсь');
  await expect(page.locator('#me')).toContainText('Виталий');
  await expect(page.locator('#me a.btn-main')).toHaveText('Прислать описание изделия');
});

test('noDemo: на странице нет ссылок на демо', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('a[href*="demo.html"]')).toHaveCount(0);
});

test('tg: все кнопки ведут в Telegram и открываются в новой вкладке', async ({page}) => {
  await page.goto('/');
  const links = await page.locator('a[href^="https://"], a[href^="http://"], a[href^="tg:"]').evaluateAll(els =>
    els.map(a => ({href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel')})));
  expect(links.filter(l => l.href === TG).length).toBeGreaterThanOrEqual(3);
  for (const l of links) expect(l).toEqual({href: TG, target: '_blank', rel: 'noopener'});
});

test('og: карточка ссылки — заголовок, описание, абсолютный адрес картинки', async ({page}) => {
  await page.goto('/');
  const meta = sel => page.locator(sel).getAttribute('content');
  const desc = 'Мангал под размер клиента: двигаете размеры — 3D, раскрой, чертежи и DXF пересчитываются сразу';
  expect(await meta('meta[property="og:title"]')).toBe('Metal Designer для цеха');
  expect(await meta('meta[property="og:description"]')).toBe(desc);
  expect(await meta('meta[name="description"]')).toBe(desc);
  expect(await meta('meta[property="og:image"]')).toBe(SITE + 'img/og.png');
  expect(await meta('meta[property="og:url"]')).toBe(SITE);
  expect(await meta('meta[property="og:type"]')).toBe('website');
  expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image');
  // картинка лежит в репозитории и открывается
  const r = await page.request.get('/img/og.png');
  expect(r.status()).toBe(200);
});

test('layout: без горизонтальной прокрутки; кнопка внизу не закрывает блок «Виталий»', async ({page, isMobile}) => {
  await page.goto('/');
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForFunction(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 1);
  const m = await page.evaluate(() => {
    const last = [...document.querySelectorAll('#me a')].pop().getBoundingClientRect();
    const bar = document.querySelector('.cta-bar');
    return {
      scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
      barShown: getComputedStyle(bar).display !== 'none',
      barTop: bar.getBoundingClientRect().top, lastBottom: last.bottom,
    };
  });
  expect(m.scrollW).toBeLessThanOrEqual(m.innerW);
  if (isMobile) {
    expect(m.barShown).toBe(true);
    expect(m.lastBottom).toBeLessThanOrEqual(m.barTop);
  }
});
