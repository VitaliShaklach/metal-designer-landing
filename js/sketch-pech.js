// Эскиз печи под казан: вид сбоку и с торца топки, с плитой, казаном и трубой. SVG в мм, геометрию берёт из расчёта.
(function (MD) {
  function pech(r) {
    const F = MD.pech.FIXED, C = F.chimney;
    const { height, chimney, kazan: kz, doorH, thickness: t } = r;
    const bodyBottom = height - F.body;
    const plateTop = height + F.plateRib;
    const rim = plateTop - kz.sink + kz.R - Math.sqrt(kz.R ** 2 - kz.r ** 2);   // край казана над землёй
    const holeBottom = height - C.belowTop - C.size;
    const chimneyTop = holeBottom + chimney;
    const top = Math.max(chimneyTop, rim + kz.lid);

    const endX = F.length + F.width * 0.55 + 140;          // начало вида с торца
    const fs = Math.max(30, (endX + F.width + C.out) * 0.035);
    const k = MD.sketchKit(fs, 'pc-arr');
    const Y = h => top - h;                                 // высота над землёй → ось Y вниз, верх рисунка — 0
    const ground = Y(0);
    const out = [];

    out.push(k.ground(-fs * 1.5, endX + F.width + C.out + fs * 1.5, ground));

    // Ножки с пятками у углов.
    const legs = (x0, w) => [x0 + F.legInset, x0 + w - F.legInset].forEach(x => {
      out.push(k.rect(x - 20, Y(bodyBottom), 40, bodyBottom - t));
      out.push(k.rect(x - F.foot / 2, Y(t), F.foot, t, { width: k.thin }));
    });

    // Казан в проёме плиты: дно — дуга сферы от проёма до края, сверху крышка-купол.
    function kazanPath(cx) {
      const o = kz.opening / 2;
      return `<path d="M${cx - o} ${Y(plateTop)}A${kz.R} ${kz.R} 0 0 1 ${cx - kz.r} ${Y(rim)}A${kz.r} ${kz.lid} 0 0 1 ${cx + kz.r} ${Y(rim)}A${kz.R} ${kz.R} 0 0 1 ${cx + o} ${Y(plateTop)}Z" fill="${k.PAPER}" stroke="${k.INK}" stroke-width="${k.stroke}"/>`
        + k.line(cx - kz.r, Y(rim), cx + kz.r, Y(rim), k.thin);
    }

    // Вид сбоку: открытый торец слева, перегородка справа. Труба за печью, видна над корпусом.
    const plateX = F.length + F.plateOver - F.plate;
    legs(0, F.length);
    out.push(k.rect(r.holeX - C.size / 2, Y(chimneyTop), C.size, chimneyTop - holeBottom, { fill: k.PAPER }));
    out.push(k.rect(0, Y(height), F.length, F.body, { fill: k.PAPER }));
    out.push(k.line(0, Y(bodyBottom + t), F.length, Y(bodyBottom + t), k.thin));
    out.push(k.rect(plateX, Y(plateTop), F.plate, F.plateRib, { fill: k.PAPER, width: k.thin * 1.5 }));
    out.push(kazanPath(plateX + F.plate / 2));
    out.push(k.label(F.length / 2, Y(height) + fs * 1.6, 'топка ←'));

    // Вид с торца топки: дверца, над ней глухой верх, справа задняя боковина с трубой.
    legs(endX, F.width);
    out.push(k.rect(endX + F.width, Y(holeBottom + C.size), C.out, C.size, { fill: k.PAPER }));
    out.push(k.rect(endX + F.width + C.out - C.size, Y(chimneyTop), C.size, chimneyTop - holeBottom, { fill: k.PAPER }));
    out.push(k.rect(endX, Y(height), F.width, F.body, { fill: k.PAPER }));
    out.push(k.rect(endX + t, Y(bodyBottom + doorH), F.width - 2 * t, doorH - t, { width: k.thin }));
    out.push(k.line(endX + 40, Y(bodyBottom + doorH / 2 - 60), endX + 40, Y(bodyBottom + doorH / 2 + 60), k.stroke * 1.6));
    out.push(k.rect(endX + (F.width - F.plate) / 2, Y(plateTop), F.plate, F.plateRib, { fill: k.PAPER, width: k.thin * 1.5 }));
    out.push(kazanPath(endX + F.width / 2));

    out.push(k.label(F.length / 2, Y(top) - fs * 0.7, 'сбоку'));
    out.push(k.label(endX + F.width / 2, Y(top) - fs * 0.7, 'с торца топки'));
    out.push(k.label(endX + F.width / 2, Y(rim + kz.lid) - fs * 0.5, `казан ${kz.volume} л · проём Ø${kz.opening}`, fs * 0.7));

    // Размеры: длина и ширина под землёй, высота корпуса слева, верх трубы справа.
    const yDim = ground + fs * 1.9;
    out.push(k.hDim(0, F.length, yDim, ground + fs * 0.6));
    out.push(k.hDim(endX, endX + F.width, yDim, ground + fs * 0.6));
    out.push(k.vDim(Y(height), ground, -fs * 1.6, -fs * 0.4));
    const chimneyX = endX + F.width + C.out;
    out.push(k.vDim(Y(chimneyTop), ground, chimneyX + fs * 1.4, chimneyX + fs * 0.4));

    const box = [-fs * 3, -fs * 1.8, chimneyX + fs * 6, top + fs * 4.4];
    return k.svg(box, out, `Эскиз печи под казан ${kz.volume} л: высота ${height} мм, верх трубы ${chimneyTop} мм`);
  }

  MD.sketch = Object.assign(MD.sketch || {}, { pech });
})(window.MD = window.MD || {});
