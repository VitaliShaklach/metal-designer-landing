// Расчёт печи под казан: параметры с экрана → описание изделия (название, геометрия для эскиза, листовые детали
// с развёртками, прокат, покупки, площадь металла и масса). Конструкция и размеры — из Metal Designer Виталия, в мм.
// Корпус под покупную плиту 450 × 450: дно, две боковины по длине, перегородка в глухом торце. Открытый торец — топка:
// сверху полоса до плиты и глухой верх, ниже дверца на петлях. В дне отверстия поддувала, под ними шибер в направляющих.
// Колосник покупной, лежит на уголках. Труба 60 × 60 выходит из задней боковины и коленом идёт вверх.
(function (MD) {
  const { rect } = MD.parts;
  const { tube, pipe, angle, square, strip, rod } = MD.metal;
  const fmt = v => v.toLocaleString('ru-RU', { maximumFractionDigits: 1 });

  // Плита с кольцами: проём Ø390, кольца с проёмами Ø300, Ø210, Ø120 и заглушка.
  const OPENINGS = [390, 300, 210, 120];
  // Узбекские казаны: r — радиус по верху, d — глубина (дно — часть сферы), lid — высота крышки. Из Metal Designer.
  const KAZANS = { 6: { r: 165, d: 140, lid: 60 }, 8: { r: 177.5, d: 160, lid: 65 }, 10: { r: 190, d: 150, lid: 70 }, 12: { r: 210, d: 160, lid: 70 } };

  // Постоянные размеры (как в Metal Designer): корпус всегда под плиту, казан его не меняет.
  const FIXED = {
    length: 600,        // от открытого торца до перегородки
    width: 440,         // по наружным граням боковин: плита 450 ложится на них рёбрами
    body: 500,          // корпус от низа дна до верха
    plate: 450,         // плита 450 × 450 × 5 с отбортовкой вниз 15
    plateRib: 15,
    plateOver: 5,       // плита выходит за перегородку
    tie: 150,           // полоса у дверцы сверху: закрывает верх от торца до плиты
    lintel: 150,        // глухой верх топки над дверцей
    chimney: { size: 60, fromWall: 150, belowTop: 110, out: 150 },   // отверстие в задней боковине: центр от перегородки, верх ниже верха стенки; горизонтальный кусок
    deflector: { length: 300, reach: 140, rise: 60 },   // наклонный отсекатель пламени у перегородки: в глубину топки 140, подъём 60
    draft: { d: 20, step: 45, rows: [-67.5, -22.5, 22.5, 67.5], from: 55 },   // отверстия поддувала в дне: от открытого торца, ряды от середины
    grate: { gap: 40, angleIn: 15, shelf: 60 },   // колосник короче печи на 40, уголок короче на 15, верх полки над дном
    shiber: { length: 560, width: 180 },
    handle: 190,        // ручка дверцы: пруток 140 + 2 × 25 на отгибы
    legInset: 75,
    foot: 100,
    stock: { w: 2500, h: 1250, fill: 0.7 },
  };

  const LIMITS = {
    kazan: { options: [6, 8, 10, 12], labels: ['6 л', '8 л', '10 л', '12 л'], def: 12 },
    height: { min: 700, max: 1000, step: 10, def: 850 },     // от земли до верха корпуса, плита ложится сверху
    chimney: { min: 500, max: 2000, step: 50, def: 1000 },   // вертикальный кусок трубы от колена
    deflector: { options: [1, 0], labels: ['есть', 'нет'], def: 1 },
    thickness: { options: [3, 4, 5], labels: ['3 мм', '4 мм', '5 мм'], def: 5 },
  };

  // Казан садится в самый большой проём, в который не проваливается (запас 10 мм на сторону).
  function kazanFit(volume) {
    const k = KAZANS[volume];
    const R = (k.r ** 2 + k.d ** 2) / (2 * k.d);                    // радиус сферы дна
    const opening = OPENINGS.find(o => o / 2 <= k.r - 10) || OPENINGS[OPENINGS.length - 1];
    const sink = R - Math.sqrt(R ** 2 - (opening / 2) ** 2);        // насколько дно ниже плиты
    const removed = OPENINGS.filter(o => o < opening);               // эти кольца снять
    return { volume, ...k, R, opening, sink, removed };
  }

  function calc({ kazan, height, chimney, deflector, thickness: t }) {
    const F = FIXED, C = F.chimney, D = F.draft, G = F.grate;
    const wallH = F.body - t;                                        // боковины и перегородка стоят на дне
    const inner = F.width - 2 * t;                                   // между боковинами
    const holeX = F.length - C.fromWall;                             // центр отверстия трубы от открытого торца
    const holeTop = wallH - C.belowTop;                              // верх отверстия от низа боковины
    const draftX = Array.from({ length: Math.floor((F.length - 2 * D.from) / D.step) + 1 }, (_, i) => D.from + i * D.step);
    const draftHoles = draftX.flatMap(x => D.rows.map(dy => [x, F.width / 2 + dy, D.d / 2]));
    const deflectorW = Math.round(Math.hypot(F.deflector.reach, F.deflector.rise));
    const doorH = F.body - F.lintel;
    const legLength = height - F.body - t;
    const kz = kazanFit(kazan);

    const sheets = MD.parts.finish([
      {
        key: 'side-back', name: 'Боковина задняя', qty: 1, w: F.length, h: wallH,
        loops: [rect(F.length, wallH), rect(C.size, C.size, holeX - C.size / 2, holeTop - C.size)],
        notes: [`отверстие трубы ${C.size} × ${C.size}: центр в ${C.fromWall} от перегородки, верх в ${C.belowTop} ниже верха`],
      },
      { key: 'side-front', name: 'Боковина передняя', qty: 1, w: F.length, h: wallH, loops: [rect(F.length, wallH)] },
      { key: 'wall', name: 'Перегородка', qty: 1, w: inner, h: wallH, loops: [rect(inner, wallH)], notes: ['глухой торец, между боковинами, на дне'] },
      {
        key: 'bottom', name: 'Дно', qty: 1, w: F.length, h: F.width, loops: [rect(F.length, F.width)], circles: draftHoles,
        notes: [`${draftHoles.length} отв. Ø${D.d} поддувала: ${D.rows.length} ряда по ${draftX.length}, шаг ${D.step}, первые в ${fmt(draftX[0])} от открытого торца`],
      },
      { key: 'tie', name: 'Полоса у дверцы', qty: 1, w: F.tie, h: inner, loops: [rect(F.tie, inner)], notes: ['сверху у открытого торца, между боковинами, вровень с верхом'] },
      { key: 'lintel', name: 'Глухой верх топки', qty: 1, w: inner, h: F.lintel - t, loops: [rect(inner, F.lintel - t)], notes: ['в открытом торце под полосой, между боковинами'] },
      { key: 'door', name: 'Дверца', qty: 1, w: F.width, h: doorH, loops: [rect(F.width, doorH)], notes: ['под глухим верхом до низа печи, петли со стороны задней боковины'] },
      ...(deflector ? [{
        key: 'deflector', name: 'Пламяотражатель', qty: 1, w: F.deflector.length, h: deflectorW, loops: [rect(F.deflector.length, deflectorW)],
        notes: [`у перегородки, наклонно: от задней боковины под отверстием трубы на ${F.deflector.reach} в топку с подъёмом ${F.deflector.rise}`],
      }] : []),
      { key: 'shiber', name: 'Шибер поддувала', qty: 1, w: F.shiber.length, h: F.shiber.width, loops: [rect(F.shiber.length, F.shiber.width)], notes: ['сплошной, край у торца отогнуть вниз на 25 — ручка'] },
      { key: 'foot', name: 'Пятка ножки', qty: 4, w: F.foot, h: F.foot, loops: [rect(F.foot, F.foot)], notes: ['к низу ножки'] },
    ], t);

    const bars = MD.parts.finishBars([
      { name: 'Ножка', profile: pipe(40, 3), length: legLength, qty: 4 },
      { name: 'Труба: горизонтальный кусок', profile: tube(60, 60, 2), length: C.out, qty: 1 },
      { name: 'Труба: вертикальный кусок', profile: tube(60, 60, 2), length: chimney, qty: 1 },
      { name: 'Опора колосника', profile: angle(40, 4), length: F.length - t - G.angleIn, qty: 2 },
      { name: 'Направляющая шибера: проставка', profile: square(6), length: F.shiber.length, qty: 2 },
      { name: 'Направляющая шибера: полка', profile: strip(20, 3), length: F.shiber.length, qty: 2 },
      { name: 'Ручка дверцы', profile: rod(12), length: F.handle, qty: 1 },
    ]);

    const keep = OPENINGS.filter(o => o >= kz.opening && o !== OPENINGS[0]).map(o => `Ø${o}`);
    const buy = [
      {
        name: `Плита ${F.plate} × ${F.plate} × 5 с кольцами`, qty: 1,
        note: kz.removed.length === OPENINGS.length - 1
          ? `под казан ${kazan} л проём Ø${kz.opening}: снять все кольца`
          : `под казан ${kazan} л проём Ø${kz.opening}: снять кольца ${kz.removed.map(o => `Ø${o}`).join(', ')} и заглушку, оставить ${keep.join(', ')}`,
      },
      { name: 'Колосник', qty: 1, note: `под проём ${F.length - G.gap} × ${inner - 10}, лежит на уголках, верх полки в ${G.shelf} от дна` },
      { name: 'Петля сварная с шаром Ø14 × 70', qty: 2, note: 'дверца к задней боковине' },
    ];

    const parts = [...sheets.map(({ name, size, qty, mass }) => ({ name, size, qty, mass })), ...bars];

    return {
      // Общие поля описания изделия, по ним собирается лист чертежа (js/sheet.js).
      title: `Печь под казан ${kazan} л, ${F.length} × ${F.width} × ${height}`,
      note: `Лист ${t} мм по ГОСТ 19903-2015, трубы по ГОСТ 8639-82 и 10704-91, уголок по ГОСТ 8509-93. Без плиты и колосника.`,
      kazan: kz, height, chimney, deflector, thickness: t,
      wallH, holeX, holeTop, legLength, doorH,
      sheets, bars, buy, parts,
      ...MD.parts.stockEstimate(sheets, F.stock),
      mass: parts.reduce((sum, p) => sum + p.mass, 0),
    };
  }

  MD.pech = { calc, LIMITS, FIXED, kazanFit };
})(window.MD = window.MD || {});
