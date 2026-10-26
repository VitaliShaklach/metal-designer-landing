// Интерфейс песочницы: вкладки, ползунки, живой эскиз, кнопка «В производство», лист чертежа и его сохранение.
(function (MD) {
  const $ = sel => document.querySelector(sel);
  const fmt = (v, d = 0) => v.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });

  const L = MD.naves.LIMITS;
  const state = { width: L.width.def, height: L.height.def, produced: false };
  let sheet = null;   // текущий лист: { title, svg }

  // Айфон и айпад: там картинка может открыться вкладкой вместо скачивания. Айпад притворяется Маком, выдаёт его тач.
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function setTab(name) {
    document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    document.querySelectorAll('.panel').forEach(p => { p.hidden = p.dataset.panel !== name; });
  }

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
      <p class="note">${r.note}</p>`;
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
    el.addEventListener('input', () => { state[key] = Number(el.value); update(); });
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

  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  slider('#naves-width', 'width');
  slider('#naves-height', 'height');
  $('#naves-produce').addEventListener('click', () => {
    state.produced = true;
    update();
    $('#naves-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  shopField();
  saveButtons();

  setTab('naves');
  renderFixed();
  update();
})(window.MD = window.MD || {});
