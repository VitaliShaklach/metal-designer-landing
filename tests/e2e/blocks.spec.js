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
  'Присылаете фото или эскиз (даже на салфетке), описание текстом или даже голосовым сообщением. Чем больше описания — тем точнее будет результат.',
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
  // срок — рядом с «бесплатно» в контактах, под шагами строки нет (решение 02.11)
  await expect(page.locator('#how .note')).toHaveCount(0);
  await expect(page.locator('#me h2')).toHaveCount(0);                      // без заголовка с именем
  await expect(page.locator('#me .contacts a[href="viber://chat?number=%2B375295751190"]')).toHaveText('написать в Viber');
  await expect(page.locator('#me')).not.toContainText('575');                // номер на странице не показываем
  await expect(page.locator('#me .contacts a[href="mailto:vashaklach@gmail.com"]')).toHaveText('vashaklach@gmail.com');
  await expect(page.locator('#me .lead')).toHaveText('Спроектирую ваше изделие бесплатно. Обычно за 1 день, срочно — быстрее. Пришлите фото и пожелания в Telegram — отвечу и назову точный срок.');
  await expect(page.locator('#me .lead strong')).toHaveText('Спроектирую ваше изделие бесплатно.');
  await expect(page.locator('#me a.btn-main')).toHaveText('Прислать фото и пожелания в Telegram');
  await expect(page.locator('.cta-bar a.btn-main')).toHaveText('Прислать фото и пожелания в Telegram');
  await expect(page.locator('.cta-bar')).not.toContainText('бесплатно');   // полоса на телефоне — только кнопка
});

test('proj: «Ползунки — это только начало» — после «Сейчас / с Metal Designer», перед «Как работаем»', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('#proj h2')).toHaveText('Ползунки — это только начало');
  await expect(page.locator('#proj p')).toHaveText('Размеры меняете сами — бесплатно. В редакторе правите не только размеры, а саму форму и всё про металл:');
  await expect(page.locator('#proj .checks li')).toHaveCount(4);
  await expect(page.locator('#proj .checks li >> nth=1')).toContainText('гильотина или лазер');
  const a = page.locator('#proj a');
  await expect(a).toHaveCount(1);
  await expect(a).toHaveText('Открыть в редакторе →');
  await expect(a).toHaveAttribute('href', 'editor/');
  // вторая кнопка — обводкой, заметно слабее главной
  await expect(a).toHaveClass(/\bbtn\b/);
  await expect(a).not.toHaveClass(/btn-main/);
  const bg = await page.evaluate(() => [
    getComputedStyle(document.querySelector('#proj a')).backgroundColor,
    getComputedStyle(document.querySelector('#me a.btn-main')).backgroundColor,
  ]);
  expect(bg[0]).not.toBe(bg[1]);
  const [vs, proj, how] = await Promise.all(['.vs', '#proj', '#how'].map(s => page.locator(s).boundingBox()));
  expect(proj.y).toBeGreaterThanOrEqual(vs.y + vs.height);
  expect(how.y).toBeGreaterThanOrEqual(proj.y + proj.height);
});

test('noDemo: ни в тексте, ни в ссылках нет «демо», старых призывов нет', async ({page}) => {
  await page.goto('/');
  const {text, hrefs} = await page.evaluate(() => ({
    text: document.body.textContent,
    hrefs: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')),
  }));
  expect(text).not.toMatch(/демо|demo/i);
  for (const h of hrefs) expect(h).not.toMatch(/демо|demo/i);
  expect(text).not.toContain('пока запускаюсь');
  expect(text).not.toContain('Прислать описание изделия');
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

test('layout: без горизонтальной прокрутки; кнопка внизу не закрывает контакты, вторых таких же кнопок нет', async ({page, isMobile}) => {
  await page.goto('/');
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForFunction(() => Math.ceil(scrollY + innerHeight) >= document.documentElement.scrollHeight - 1);
  const m = await page.evaluate(() => {
    const last = [...document.querySelectorAll('#me a')].filter(a => a.offsetParent).pop().getBoundingClientRect();
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
    await expect(page.locator('#me a.btn-main')).toBeHidden();
    await expect(page.locator('.lynx a.btn-main')).toBeHidden();
    expect(m.lastBottom).toBeLessThanOrEqual(m.barTop);
  }
});
