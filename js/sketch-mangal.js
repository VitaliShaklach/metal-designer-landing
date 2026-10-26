// Эскиз мангала: вид спереди и сбоку с размерами, SVG в миллиметрах. Геометрию берёт из расчёта, сам ничего не считает.
(function (MD) {
  function mangal(r) {
    const { length, width, height, depth, thickness: t, holes, slots, legs, wheels } = r;
    const F = MD.mangal.FIXED;
    const fs = Math.max(34, (length + width) * 0.036);
    const k = MD.sketchKit(fs, 'mg-arr');
    const gap = fs * 4.2;                       // между видами
    const sideX = length + gap;                 // начало вида сбоку
    const ground = height;                      // край жаровни — 0, земля — height
    const legW = 40, bolted = legs === 'bolt';
    const out = [];

    out.push(k.ground(-fs * 1.5, sideX + width + fs * 1.5, ground));

    // Ножка на оси x: сверху площадка и патрубок (на болтах), снизу пятка или площадка с колесом.
    function leg(x) {
      let y = depth;
      if (bolted) {
        out.push(k.rect(x - F.mount / 2, y, F.mount, t, { width: k.thin }));
        y += t;
        out.push(k.rect(x - legW / 2, y, legW, F.socket, { width: k.thin }));
        y += F.socket;
      }
      const bottom = ground - (wheels ? F.wheel + t : t);
      out.push(k.rect(x - legW / 2, y, legW, bottom - y));
      if (wheels) {
        const cy = ground - F.wheelD / 2;
        out.push(k.rect(x - F.pad / 2, bottom, F.pad, t, { width: k.thin }));
        out.push(`<path d="M${x - 35} ${bottom + t}L${x - 25} ${cy}M${x + 35} ${bottom + t}L${x + 25} ${cy}" stroke="${k.INK}" stroke-width="${k.stroke}" fill="none"/>`);
        out.push(k.circle(x, cy, F.wheelD / 2, { fill: k.PAPER }));
        out.push(k.circle(x, cy, 8, { width: k.thin }));
      } else {
        out.push(k.rect(x - F.foot / 2, bottom, F.foot, t, { width: k.thin }));
      }
    }

    // Вид спереди: боковина с прорезями и отверстиями, ножки у торцов.
    [F.legInset, length - F.legInset].forEach(leg);
    out.push(k.rect(0, 0, length, depth, { fill: k.PAPER }));
    out.push(k.line(0, depth - t, length, depth - t, k.thin));
    out.push(`<path d="${slots.map(x => `M${x} 0v${F.slot.d * 1.6}`).join('')}" stroke="${k.INK}" stroke-width="${k.thin}"/>`);
    holes.forEach(x => out.push(k.circle(x, depth - F.holeY, F.hole / 2, { width: k.thin })));

    // Вид сбоку: торец, ножки у боковин.
    [sideX + F.legInset, sideX + width - F.legInset].forEach(leg);
    out.push(k.rect(sideX, 0, width, depth, { fill: k.PAPER }));
    out.push(k.line(sideX + t, 0, sideX + t, depth - t, k.thin));
    out.push(k.line(sideX + width - t, 0, sideX + width - t, depth - t, k.thin));
    out.push(k.line(sideX, depth - t, sideX + width, depth - t, k.thin));

    out.push(k.label(length / 2, -fs * 0.7, 'спереди'));
    out.push(k.label(sideX + width / 2, -fs * 0.7, 'сбоку'));

    // Размеры: длина и ширина под землёй, высота слева, глубина жаровни справа.
    const yDim = ground + fs * 1.9;
    out.push(k.hDim(0, length, yDim, ground + fs * 0.6));
    out.push(k.hDim(sideX, sideX + width, yDim, ground + fs * 0.6));
    out.push(k.vDim(0, ground, -fs * 1.6, -fs * 0.4));
    out.push(k.vDim(0, depth, sideX + width + fs * 1.4, sideX + width + fs * 0.4));

    const box = [-fs * 3, -fs * 1.8, sideX + width + fs * 6, height + fs * 4.4];
    return k.svg(box, out, `Эскиз мангала: длина ${length} мм, ширина ${width} мм, высота ${height} мм`);
  }

  MD.sketch = Object.assign(MD.sketch || {}, { mangal });
})(window.MD = window.MD || {});
