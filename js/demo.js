// Интерфейс песочницы: вкладки, ползунки, живой эскиз, кнопка «В производство», лист чертежа и его сохранение.
(function (MD) {
  const $ = sel => document.querySelector(sel);
  const fmt = (v, d = 0) => v.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });

  const L = MD.naves.LIMITS;
  const state = { ...MD.link.defaults(L), produced: false };
  let sheet = null;   // текущий лист: { title, svg }

  // Адрес полной версии. Пока пусто — кнопка «Полная версия — скоро» и не нажимается. Вписали адрес — кнопка ожила.
  const FULL_VERSION_URL = '';

  // Вкладки и их параметры для ссылки на вариант. У вкладок «скоро» параметров пока нет.
  const TABS = { naves: L, mangal: {}, pech: {}, custom: {} };

  // Айфон и айпад: там картинка может открыться вкладкой вместо скачивания. Айпад притворяется Маком, выдаёт его тач.
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function setTab(name) {
    document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    document.querySelectorAll('.panel').forEach(p => { p.hidden = p.dataset.panel !== name; });
  }

  // Адрес в строке браузера показывает открытую вкладку. Параметры из открытой ссылки после правки уже не те, их убираем.
  const showTabInAddress = name => history.replaceState(null, '', MD.link.make(name));

  function renderResult(r) {
    const rows = r.parts.map(p => `
      <li>
        <span class="part-name">${p.name}</span>
        <span class="part-meta">${p.profile.name} · ${fmt(p.length)} мм × ${p.qty} шт · ${fmt(p.mass, 1)} кг</span>
      </li>`).join('');
    $('#naves-parts').innerHTML = `
      <h3>Длины реза</h3>
      <ul class="parts">${rows}</ul>
      <p class="total">Масса металла: <b>${fmt(r.mass, 1)} кг</b></p>
      <p class="note">${r.note}</p>
      ${renderCutting(r.parts)}
      ${renderAreas(r.areas)}`;
  }

  // 1 хлыст, 2 хлыста, 5 хлыстов.
  function plural(n, one, few, many) {
    const t = n % 100, u = n % 10;
    return t > 10 && t < 20 ? many : u === 1 ? one : u >= 2 && u <= 4 ? few : many;
  }
  const barsWord = n => plural(n, 'хлыст', 'хлыста', 'хлыстов');

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

  function renderSheet(r, sketch) {
    const svg = MD.sheet.svg({ ...r, sketch, caption: 'Навес. Вид спереди', shop: MD.shop.get(), date: new Date().toLocaleDateString('ru-RU') });
    sheet = { title: r.title, svg };
    $('#naves-sheet').src = $('#print-sheet').src = MD.sheet.url(svg);
  }

  function renderFixed() {
    const F = MD.naves.FIXED;
    $('#naves-height-hint').textContent = `По переднему краю, до верха балки. Скат назад, задний край ниже на ${fmt(F.drop)} мм.`;
    $('#naves-fixed').textContent = `Глубина ${fmt(F.depth)} мм. Хозблок ${fmt(F.shed)} мм с дверью, дровница ${fmt(F.wood)} мм, остальное — под мангал. Открытая часть шире ${fmt(F.maxSpan)} мм получает промежуточные стойки.`;
  }

  function update() {
    const r = MD.naves.calc(state);
    const sketch = MD.sketch.naves(r);
    $('#naves-width-out').textContent = fmt(state.width) + ' мм';
    $('#naves-height-out').textContent = fmt(state.height) + ' мм';
    $('#naves-sketch').innerHTML = sketch;
    $('#naves-result').hidden = !state.produced;
    if (state.produced) {
      renderResult(r);
      renderSheet(r, sketch);
    }
  }

  function slider(id, key) {
    const el = $(id);
    Object.assign(el, { min: L[key].min, max: L[key].max, step: L[key].step, value: state[key] });
    el.addEventListener('input', () => {
      state[key] = Number(el.value);
      showTabInAddress('naves');
      update();
    });
  }

  // Открыть то, что записано в адресе: вариант по ссылке сразу с результатом, иначе готовый пример.
  function openFromAddress() {
    const { tab, values } = MD.link.read(location.hash, TABS);
    Object.assign(state, MD.link.defaults(L), tab === 'naves' && values ? values : {}, { produced: Boolean(tab === 'naves' && values) });
    $('#naves-width').value = state.width;
    $('#naves-height').value = state.height;
    setTab(tab || 'naves');
    update();
  }

  // «Ссылка на вариант»: копируем адрес. Не дал браузер — показываем ссылку в поле, выделенной, чтобы скопировать руками.
  function linkButtons() {
    const status = $('#naves-link-status'), field = $('#naves-link-field');
    $('#naves-link').addEventListener('click', () => {
      const url = MD.link.make('naves', state, L);
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

    const full = $('#naves-full');
    if (FULL_VERSION_URL) {
      full.disabled = false;
      full.textContent = 'Открыть полную версию';
      full.addEventListener('click', () => { location.href = FULL_VERSION_URL; });
    }
  }

  // «Цех и телефон» общий на всю песочницу: вписали в одном поле — появилось во всех и в штампе.
  function shopField() {
    const inputs = document.querySelectorAll('.shop-input');
    inputs.forEach(el => {
      el.value = MD.shop.get();
      el.addEventListener('input', () => {
        MD.shop.set(el.value.trim());
        inputs.forEach(other => { if (other !== el) other.value = el.value; });
        update();
      });
    });
  }

  function saveButtons() {
    const png = $('#naves-png');
    png.addEventListener('click', () => {
      png.disabled = true;
      MD.sheet.png(sheet.svg, MD.sheet.fileName(sheet.title) + '.png')
        .catch(err => alert(err.message))
        .finally(() => { png.disabled = false; });
    });
    // Печать браузера: на странице печати виден только лист (стили @media print). Заголовок вкладки станет именем PDF.
    $('#naves-pdf').addEventListener('click', () => {
      const title = document.title;
      document.title = MD.sheet.fileName(sheet.title);
      window.addEventListener('afterprint', () => { document.title = title; }, { once: true });
      window.print();
    });
    document.querySelectorAll('.ios-hint').forEach(el => { el.hidden = !isIOS; });
  }

  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
    setTab(b.dataset.tab);
    showTabInAddress(b.dataset.tab);
  }));
  slider('#naves-width', 'width');
  slider('#naves-height', 'height');
  $('#naves-produce').addEventListener('click', () => {
    state.produced = true;
    update();
    $('#naves-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  shopField();
  saveButtons();
  linkButtons();

  renderFixed();
  openFromAddress();
  // Ссылку вставили в адрес уже открытой страницы: браузер её не перезагружает, открываем сами.
  window.addEventListener('hashchange', openFromAddress);
})(window.MD = window.MD || {});
