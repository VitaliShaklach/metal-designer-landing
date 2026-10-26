// Интерфейс песочницы: вкладки, параметры, живой эскиз, кнопка «В производство», лист чертежа, сохранение и ссылка на вариант.
// Вкладка с изделием устроена одинаково: параметры [data-key] → расчёт → эскиз → результат из шаблона #result-tpl.
// Чем изделия отличаются, описано в PRODUCTS.
(function (MD) {
  const $ = sel => document.querySelector(sel);
  const fmt = (v, d = 0) => v.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });

  // Адрес полной версии. Пока пусто — кнопка «Полная версия — скоро» и не нажимается. Вписали адрес — кнопка ожила.
  const FULL_VERSION_URL = '';

  // Айфон и айпад: там картинка может открыться вкладкой вместо скачивания. Айпад притворяется Маком, выдаёт его тач.
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // 1 хлыст, 2 хлыста, 5 хлыстов.
  function plural(n, one, few, many) {
    const t = n % 100, u = n % 10;
    return t > 10 && t < 20 ? many : u === 1 ? one : u >= 2 && u <= 4 ? few : many;
  }
  const barsWord = n => plural(n, 'хлыст', 'хлыста', 'хлыстов');

  // Список деталей: у каждой строка meta (профиль и длина или размер листа), количество и масса; внизу общая масса.
  function renderParts(r, title) {
    const rows = r.parts.map(p => `
      <li>
        <span class="part-name">${p.name}</span>
        <span class="part-meta">${p.meta} × ${p.qty} шт · ${fmt(p.mass, 1)} кг</span>
      </li>`).join('');
    return `
      <h3>${title}</h3>
      <ul class="parts">${rows}</ul>
      <p class="total">Масса металла: <b>${fmt(r.mass, 1)} кг</b></p>
      <p class="note">${r.note}</p>`;
  }

  // Раскрой по профилям: на каждый хлыст полоска с кусками в масштабе (заштрихован обрезок) и строка длин.
  // Одинаково разрезанные хлысты идут одной строкой.
  function renderCutting(parts) {
    const { STOCK, KERF } = MD.cutting;
    const groups = MD.cutting.plan(parts).map(g => {
      const layouts = new Map();
      g.bars.forEach(bar => {
        const key = bar.cuts.map(c => fmt(c)).join(' + ');
        layouts.set(key, { bar, n: (layouts.has(key) ? layouts.get(key).n : 0) + 1 });
      });
      const rows = [...layouts].map(([key, { bar, n }]) => `
        <li>
          <div class="bar" aria-hidden="true">${bar.cuts.map(c => `<span style="width:${c / STOCK * 100}%"></span>`).join('')}</div>
          <p class="bar-text">${n > 1 ? `<b>${n} ${barsWord(n)}:</b> ` : ''}${key} · обрезок&nbsp;${fmt(bar.waste)}</p>
        </li>`).join('');
      const tooLong = g.tooLong.length
        ? `<p class="warn">Длиннее хлыста, варить из двух: ${g.tooLong.map(l => fmt(l)).join(', ')} мм</p>` : '';
      return `
        <div class="stock">
          <p class="stock-head"><b>${g.profileName}</b> — ${g.count} ${barsWord(g.count)} · нарезать&nbsp;${fmt(g.totalLength)}&nbsp;мм · обрезки&nbsp;${fmt(g.waste)}&nbsp;мм</p>
          <ul class="bars">${rows}</ul>
          ${tooLong}
        </div>`;
    }).join('');
    return `
      <div class="calc-block">
        <h3>Раскрой хлыстов по ${fmt(STOCK / 1000)} м</h3>
        <p class="hint">Длины в мм, каждая длина из списка выше — ровно один кусок. Обрезок — что остаётся после всех резов, каждый рез съедает ${KERF} мм, поэтому строка не добирает до ${fmt(STOCK)} несколько мм.</p>
        ${groups}
      </div>`;
  }

  function renderAreas(areas) {
    const F = MD.naves.FIXED;
    return `
      <div class="calc-block">
        <h3>Площади</h3>
        <ul class="parts">
          <li>
            <span class="part-name">Кровля, профлист: ${fmt(areas.roof, 2)} м²</span>
            <span class="part-meta">по скату, со свесом ${fmt(F.overhang)} мм с боков</span>
          </li>
          <li>
            <span class="part-name">Обшивка хозблока, доска: ${fmt(areas.cladding, 2)} м²</span>
            <span class="part-meta">фасад вместе с дверью, задняя стенка, наружный бок и стенка к дровнице</span>
          </li>
        </ul>
      </div>`;
  }

  // Развёртки листовых деталей: на каждую карточку с размером, количеством, картинкой и пометками для цеха.
  function renderUnfolds(sheets, thickness) {
    const cards = sheets.map(p => `
      <li class="unfold">
        <p class="part-name">${p.name} · ${p.qty} шт</p>
        <p class="part-meta">${p.size} мм</p>
        ${MD.unfold.svg(p)}
        ${p.notes.map(n => `<p class="hint">${n}</p>`).join('')}
      </li>`).join('');
    return `
      <div class="calc-block">
        <h3>Развёртки, лист ${thickness} мм</h3>
        <ul class="unfolds">${cards}</ul>
      </div>`;
  }

  // Покупки и оценка листа для изделий из листа.
  function renderBuy(buy) {
    if (!buy.length) return '';
    return `
      <div class="calc-block">
        <h3>Купить</h3>
        <ul class="parts">${buy.map(b => `
          <li>
            <span class="part-name">${b.name} — ${b.qty} шт</span>
            <span class="part-meta">${b.note}</span>
          </li>`).join('')}
        </ul>
      </div>`;
  }

  function renderStock(r, stock) {
    return `
      <div class="calc-block">
        <h3>Металл</h3>
        <ul class="parts">
          <li>
            <span class="part-name">Площадь листовых деталей: ${fmt(r.area, 2)} м²</span>
            <span class="part-meta">с учётом количества, за вычетом отверстий</span>
          </li>
          <li>
            <span class="part-name">Листов ${fmt(stock.h)} × ${fmt(stock.w)}: ${r.stockSheets} — оценка</span>
            <span class="part-meta">по площади при заполнении листа ${fmt(stock.fill * 100)} %, раскрой листа не считался</span>
          </li>
        </ul>
      </div>`;
  }

  // Строка детали: лист — размер, труба — профиль и длина.
  const partMeta = p => (p.profile ? `${p.profile.name} · ${fmt(p.length)} мм` : `${p.size} мм`);

  // Чем вкладки отличаются: расчёт, эскиз, подписи и что показать в результате.
  const PRODUCTS = {
    naves: {
      model: MD.naves,
      sketch: r => MD.sketch.naves(r),
      caption: 'Навес. Вид спереди',
      texts: F => ({
        heightHint: `По переднему краю, до верха балки. Скат назад, задний край ниже на ${fmt(F.drop)} мм.`,
        fixed: `Глубина ${fmt(F.depth)} мм. Хозблок ${fmt(F.shed)} мм с дверью, дровница ${fmt(F.wood)} мм, остальное — под мангал. Открытая часть шире ${fmt(F.maxSpan)} мм получает промежуточные стойки.`,
      }),
      result: r => renderParts({ ...r, parts: r.parts.map(p => ({ ...p, meta: partMeta(p) })) }, 'Длины реза')
        + renderCutting(r.parts) + renderAreas(r.areas),
    },
    mangal: {
      model: MD.mangal,
      sketch: r => MD.sketch.mangal(r),
      caption: 'Мангал. Вид спереди и сбоку',
      texts: F => ({
        heightHint: `От земли до края жаровни. Глубина жаровни постоянная — ${fmt(F.depth)} мм.`,
        fixed: `Ножки из трубы Ø40×3 по углам, центр в ${fmt(F.legInset)} мм от краёв. На болтах — ножка с шпилькой М16 вкручивается в патрубок под дном. Колёса — 4 поворотных Ø100, два с тормозом.`,
      }),
      result: r => renderParts({ ...r, parts: [...r.sheets, ...r.tubes].map(p => ({ ...p, meta: partMeta(p) })) }, 'Детали')
        + renderUnfolds(r.sheets, r.thickness) + renderCutting(r.tubes) + renderBuy(r.buy) + renderStock(r, MD.mangal.FIXED.stock),
    },
  };

  // Адрес в строке браузера показывает открытую вкладку.
  const showTabInAddress = name => history.replaceState(null, '', MD.link.make(name));

  // Одна вкладка с изделием: свои параметры, эскиз, результат и лист. Наружу — open(values) для ссылки и лист для печати.
  function setupTab(name, product) {
    const panel = $(`[data-panel="${name}"]`);
    const q = sel => panel.querySelector(sel);
    const limits = product.model.LIMITS;
    const state = { ...MD.link.defaults(limits), produced: false };
    let sheet = null;   // текущий лист: { title, svg, url }

    q('.result').append($('#result-tpl').content.cloneNode(true));
    const texts = product.texts(product.model.FIXED);
    panel.querySelectorAll('[data-text]').forEach(el => { el.textContent = texts[el.dataset.text]; });

    function renderSheet(r, sketch) {
      const svg = MD.sheet.svg({ ...r, sketch, caption: product.caption, shop: MD.shop.get(), date: new Date().toLocaleDateString('ru-RU') });
      sheet = { title: r.title, svg, url: MD.sheet.url(svg) };
      q('.sheet-preview').src = sheet.url;
      q('.sheet-preview').alt = `Лист чертежа: ${r.title}, эскиз, спецификация, масса и штамп`;
      if (!panel.hidden) $('#print-sheet').src = sheet.url;
    }

    function update() {
      const r = product.model.calc(state);
      const sketch = product.sketch(r);
      panel.querySelectorAll('[data-out]').forEach(el => { el.textContent = fmt(state[el.dataset.out]) + ' мм'; });
      panel.querySelectorAll('.choice button').forEach(b => {
        b.setAttribute('aria-pressed', String(String(state[b.closest('.choice').dataset.key]) === b.value));
      });
      q('.sketch-box').innerHTML = sketch;
      q('.result').hidden = !state.produced;
      if (state.produced) {
        q('.calc').innerHTML = product.result(r);
        renderSheet(r, sketch);
      }
    }

    // Параметр поменяли руками: адрес больше не совпадает с открытой ссылкой, оставляем в нём только вкладку.
    function change(key, value) {
      state[key] = value;
      showTabInAddress(name);
      update();
    }

    // Ползунки: диапазон и шаг из LIMITS.
    panel.querySelectorAll('input[type="range"][data-key]').forEach(el => {
      const l = limits[el.dataset.key];
      Object.assign(el, { min: l.min, max: l.max, step: l.step, value: state[el.dataset.key] });
      el.addEventListener('input', () => change(el.dataset.key, Number(el.value)));
    });
    // Переключатели: кнопки из вариантов LIMITS, подписи — labels.
    panel.querySelectorAll('.choice[data-key]').forEach(box => {
      const l = limits[box.dataset.key];
      l.options.forEach((option, i) => {
        const b = document.createElement('button');
        Object.assign(b, { type: 'button', value: String(option), textContent: l.labels[i] });
        b.addEventListener('click', () => change(box.dataset.key, option));
        box.append(b);
      });
    });

    q('.produce').addEventListener('click', () => {
      state.produced = true;
      update();
      q('.result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const png = q('.js-png');
    png.addEventListener('click', () => {
      png.disabled = true;
      MD.sheet.png(sheet.svg, MD.sheet.fileName(sheet.title) + '.png')
        .catch(err => alert(err.message))
        .finally(() => { png.disabled = false; });
    });
    // Печать браузера: на странице печати виден только лист (стили @media print). Заголовок вкладки станет именем PDF.
    q('.js-pdf').addEventListener('click', () => {
      const title = document.title;
      $('#print-sheet').src = sheet.url;
      document.title = MD.sheet.fileName(sheet.title);
      window.addEventListener('afterprint', () => { document.title = title; }, { once: true });
      window.print();
    });
    q('.ios-hint').hidden = !isIOS;

    // «Ссылка на вариант»: копируем адрес. Не дал браузер — показываем ссылку в поле, выделенной, чтобы скопировать руками.
    const status = q('.link-status'), field = q('.link-field');
    q('.js-link').addEventListener('click', () => {
      const url = MD.link.make(name, state, limits);
      const manual = () => {
        field.hidden = false;
        field.value = url;
        field.focus();
        field.select();
        status.textContent = 'Скопируйте ссылку вручную.';
      };
      field.hidden = true;
      if (!navigator.clipboard) return manual();
      navigator.clipboard.writeText(url).then(() => { status.textContent = 'Ссылка скопирована.'; }, manual);
    });

    const full = q('.js-full');
    if (FULL_VERSION_URL) {
      full.disabled = false;
      full.textContent = 'Открыть полную версию';
      full.addEventListener('click', () => { location.href = FULL_VERSION_URL; });
    }

    return {
      limits,
      update,
      // Вариант по ссылке — сразу с результатом; без values — готовый пример.
      open(values) {
        Object.assign(state, MD.link.defaults(limits), values || {}, { produced: Boolean(values) });
        panel.querySelectorAll('input[type="range"][data-key]').forEach(el => { el.value = state[el.dataset.key]; });
        update();
      },
      sheetUrl: () => (sheet ? sheet.url : ''),
    };
  }

  const tabs = Object.fromEntries(Object.entries(PRODUCTS).map(([name, product]) => [name, setupTab(name, product)]));

  function setTab(name) {
    document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    document.querySelectorAll('.panel').forEach(p => { p.hidden = p.dataset.panel !== name; });
    if (tabs[name] && tabs[name].sheetUrl()) $('#print-sheet').src = tabs[name].sheetUrl();
  }

  // Вкладки и их параметры для ссылки на вариант. У вкладок без изделия параметров нет.
  const LINK_TABS = Object.fromEntries([...document.querySelectorAll('.tab')].map(b => [b.dataset.tab, tabs[b.dataset.tab] ? tabs[b.dataset.tab].limits : {}]));

  // Открыть то, что записано в адресе: вариант по ссылке сразу с результатом, иначе готовый пример.
  function openFromAddress() {
    const { tab, values } = MD.link.read(location.hash, LINK_TABS);
    const name = tab || 'naves';
    Object.entries(tabs).forEach(([n, t]) => t.open(n === name ? values : null));
    setTab(name);
  }

  // «Цех и телефон» общий на всю песочницу: вписали в одном поле — появилось во всех и в штампе.
  function shopField() {
    const inputs = document.querySelectorAll('.shop-input');
    inputs.forEach((el, i) => {
      el.id = `shop-${i}`;
      el.closest('.field').querySelector('label').htmlFor = el.id;
      el.value = MD.shop.get();
      el.addEventListener('input', () => {
        MD.shop.set(el.value.trim());
        inputs.forEach(other => { if (other !== el) other.value = el.value; });
        Object.values(tabs).forEach(t => t.update());
      });
    });
  }

  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
    setTab(b.dataset.tab);
    showTabInAddress(b.dataset.tab);
  }));
  shopField();
  openFromAddress();
  // Ссылку вставили в адрес уже открытой страницы: браузер её не перезагружает, открываем сами.
  window.addEventListener('hashchange', openFromAddress);
})(window.MD = window.MD || {});
