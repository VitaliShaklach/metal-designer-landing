// Интерфейс песочницы: вкладки, ползунки, живой эскиз, кнопка «В производство».
(function (MD) {
  const $ = sel => document.querySelector(sel);
  const fmt = (v, d = 0) => v.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });

  const L = MD.naves.LIMITS;
  const state = { width: L.width.def, height: L.height.def, produced: false };

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
    $('#naves-result').innerHTML = `
      <h3>Длины реза</h3>
      <ul class="parts">${rows}</ul>
      <p class="total">Масса металла: <b>${fmt(r.mass, 1)} кг</b></p>
      <p class="note">Масса профильной трубы по ГОСТ 8639-82 и 8645-68.</p>`;
  }

  function renderFixed() {
    const F = MD.naves.FIXED;
    $('#naves-height-hint').textContent = `По переднему краю, до верха балки. Скат назад, задний край ниже на ${fmt(F.drop)} мм.`;
    $('#naves-fixed').textContent = `Глубина ${fmt(F.depth)} мм. Хозблок ${fmt(F.shed)} мм с дверью, дровница ${fmt(F.wood)} мм, остальное — под мангал. Открытая часть шире ${fmt(F.maxSpan)} мм получает промежуточные стойки.`;
  }

  function update() {
    const r = MD.naves.calc(state);
    $('#naves-width-out').textContent = fmt(state.width) + ' мм';
    $('#naves-height-out').textContent = fmt(state.height) + ' мм';
    $('#naves-sketch').innerHTML = MD.sketch.naves(r);
    if (state.produced) renderResult(r);
  }

  function slider(id, key) {
    const el = $(id);
    Object.assign(el, { min: L[key].min, max: L[key].max, step: L[key].step, value: state[key] });
    el.addEventListener('input', () => { state[key] = Number(el.value); update(); });
  }

  document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
  slider('#naves-width', 'width');
  slider('#naves-height', 'height');
  $('#naves-produce').addEventListener('click', () => {
    state.produced = true;
    update();
    $('#naves-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  setTab('naves');
  renderFixed();
  update();
})(window.MD = window.MD || {});
