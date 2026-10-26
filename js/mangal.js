// Расчёт мангала: параметры с экрана → описание изделия (название, геометрия для эскиза, листовые детали с развёртками,
// трубы ножек, покупки, площадь металла и масса). Конструкция и формулы — из Metal Designer Виталия, переведены в мм.
// Жаровня: дно, на нём две боковины по длине и два торца между боковинами. Ножки из трубы по углам. Все размеры в мм.
(function (MD) {
  const LEG = MD.metal.pipe(40, 3);   // ножка и патрубок под неё
  const fmt = v => v.toLocaleString('ru-RU', { maximumFractionDigits: 1 });

  // Постоянные размеры (решение исполнителя, см. дизайн): глубина жаровни постоянная.
  const FIXED = {
    depth: 130,        // жаровня от низа дна до края
    hole: 15,          // отверстия поддува в боковинах: Ø15
    holeStep: 45,      // шаг отверстий
    holeY: 25,         // центр отверстий над низом дна
    holeMargin: 30,    // от торца до крайнего отверстия, не меньше
    slot: { w: 2, d: 10, step: 30, margin: 20 },   // прорези под шампуры по верху боковин
    legInset: 75,      // центр ножки от края корпуса: площадка колеса 150 × 150 не выходит за корпус
    mount: 80,         // площадка под ножку на дне снизу, квадрат
    socket: 30,        // патрубок с гайкой М16 под площадкой: в него вкручивается ножка
    foot: 100,         // пятка ножки без колеса, квадрат
    pad: 150,          // площадка под колесо, квадрат
    wheel: 126,        // колесо TOR SC 42: Ø100, от пола до площадки 126
    wheelD: 100,
    stock: { w: 2500, h: 1250, fill: 0.7 },   // лист для оценки и заполнение
  };

  const LIMITS = {
    length: { min: 500, max: 1200, step: 50, def: 800 },
    width: { min: 300, max: 500, step: 10, def: 420 },
    height: { min: 700, max: 1100, step: 10, def: 970 },   // от земли до края жаровни
    thickness: { options: [3, 4, 5], labels: ['3 мм', '4 мм', '5 мм'], def: 5 },
    blow: { options: [1, 0], labels: ['есть', 'нет'], def: 1 },
    legs: { options: ['bolt', 'weld'], labels: ['на болтах', 'вваренные'], def: 'bolt' },
    wheels: { options: [0, 1], labels: ['нет', 'есть'], def: 0 },
  };

  // Ряд одинаковых элементов с шагом step по центру длины, крайние не ближе margin к краю.
  function row(length, step, margin) {
    const n = Math.floor((length - 2 * margin) / step) + 1;
    const start = (length - (n - 1) * step) / 2;
    return Array.from({ length: n }, (_, i) => start + i * step);
  }

  const rect = (w, h) => [[0, 0], [w, 0], [w, h], [0, h], [0, 0]];

  // Боковина: прямоугольник с прорезями под шампуры по верхнему краю (обход против часовой, начало в левом нижнем углу).
  function sideLoop(w, h, slots, S) {
    const top = [];
    [...slots].reverse().forEach(x => top.push([x + S.w / 2, h], [x + S.w / 2, h - S.d], [x - S.w / 2, h - S.d], [x - S.w / 2, h]));
    return [[0, 0], [w, 0], [w, h], ...top, [0, h], [0, 0]];
  }

  function calc({ length, width, height, thickness: t, blow, legs, wheels }) {
    const F = FIXED;
    const wallH = F.depth - t;                        // боковины и торцы стоят на дне
    const slots = row(length, F.slot.step, F.slot.margin);
    const holes = blow ? row(length, F.holeStep, F.holeMargin) : [];
    const holeY = F.holeY - t;                        // центр отверстия от низа боковины
    const bolted = legs === 'bolt';

    // Под ножкой снизу пятка или площадка колеса с колесом; у ножки на болтах сверху ещё площадка на дне и патрубок.
    const under = height - F.depth;                   // от земли до низа дна
    const bottomPart = wheels ? F.wheel + t : t;
    const legLength = under - bottomPart - (bolted ? t + F.socket : 0);

    // Листовые детали: развёртка в мм, начало в левом нижнем углу. Все из листа выбранной толщины.
    const sheets = [
      {
        key: 'side', name: 'Боковина', qty: 2, w: length, h: wallH,
        loops: [sideLoop(length, wallH, slots, F.slot)],
        circles: holes.map(x => [x, holeY, F.hole / 2]),
        notes: [
          `${slots.length} прорезей ${F.slot.w} × ${F.slot.d} под шампуры, шаг ${F.slot.step}, крайние в ${fmt(slots[0])} от торца`,
          ...(holes.length ? [`${holes.length} отв. Ø${F.hole} поддува, шаг ${F.holeStep}, центр в ${fmt(holeY)} от низа, крайние в ${fmt(holes[0])} от торца`] : []),
        ],
      },
      { key: 'bottom', name: 'Дно', qty: 1, w: length, h: width, loops: [rect(length, width)], circles: [], notes: [] },
      { key: 'end', name: 'Торец', qty: 2, w: width - 2 * t, h: wallH, loops: [rect(width - 2 * t, wallH)], circles: [], notes: ['между боковинами, на дне'] },
      ...(bolted ? [
        { key: 'mount', name: 'Площадка под ножку', qty: 4, w: F.mount, h: F.mount, loops: [rect(F.mount, F.mount)], circles: [], notes: ['приварить к дну снизу, центр в ' + F.legInset + ' от краёв'] },
        { key: 'cap', name: 'Заглушка ножки', qty: 4, w: 40, h: 40, loops: [], circles: [[20, 20, 20]], notes: ['вварить в верх ножки, в центр — шпилька М16'] },
      ] : []),
      wheels
        ? { key: 'pad', name: 'Площадка под колесо', qty: 4, w: F.pad, h: F.pad, loops: [rect(F.pad, F.pad)], circles: [], notes: ['к низу ножки; 4 отв. под колесо сверлить по факту'] }
        : { key: 'foot', name: 'Пятка ножки', qty: 4, w: F.foot, h: F.foot, loops: [rect(F.foot, F.foot)], circles: [], notes: ['к низу ножки'] },
    ];

    // Площадь детали в м²: у заглушки контура нет, она сама круг; у остальных круги — отверстия, ещё вычитаем прорези.
    sheets.forEach(p => {
      const circles = p.circles.reduce((sum, [, , r]) => sum + Math.PI * r * r, 0);
      const slotArea = p.key === 'side' ? slots.length * F.slot.w * F.slot.d : 0;
      p.area = (p.loops.length ? p.w * p.h - circles - slotArea : circles) / 1e6;
      p.size = p.key === 'cap' ? `Ø${p.w} × ${t}` : `${p.w} × ${p.h} × ${t}`;
      p.mass = p.area * MD.metal.sheetKgPerM2(t) * p.qty;
    });

    const tubes = [
      { name: 'Ножка', profile: LEG, length: legLength, qty: 4 },
      ...(bolted ? [{ name: 'Патрубок ножки с гайкой М16', profile: LEG, length: F.socket, qty: 4 }] : []),
    ].map(p => ({ ...p, size: `${p.profile.name} · L ${p.length}`, mass: p.profile.kgPerM * p.length / 1000 * p.qty }));

    const buy = [
      ...(bolted ? [
        { name: 'Гайка М16', qty: 4, note: 'вварить в патрубок' },
        { name: 'Шпилька М16 × 40', qty: 4, note: 'вварить в заглушку ножки: ножка вкручивается в патрубок' },
      ] : []),
      ...(wheels ? [
        { name: 'Колесо TOR SCb 42, поворотное Ø100, с тормозом', qty: 2, note: 'у одного торца' },
        { name: 'Колесо TOR SC 42, поворотное Ø100, без тормоза', qty: 2, note: 'у другого торца' },
        { name: 'Болт М8 × 20 с гайкой и шайбой', qty: 16, note: 'по 4 на колесо' },
      ] : []),
    ];

    const area = sheets.reduce((s, p) => s + p.area * p.qty, 0);
    const stockArea = F.stock.w * F.stock.h / 1e6;
    const parts = [...sheets.map(({ name, size, qty, mass }) => ({ name, size, qty, mass })), ...tubes];

    return {
      // Общие поля описания изделия, по ним собирается лист чертежа (js/sheet.js).
      title: `Мангал ${length} × ${width} × ${height}`,
      note: `Лист ${t} мм по ГОСТ 19903-2015, труба по ГОСТ 10704-91. Без колёс и крепежа.`,
      length, width, height, thickness: t, blow, legs, wheels,
      depth: F.depth, wallH, holes, holeY, slots, legLength, under,
      sheets, tubes, buy, parts,
      area,
      stockSheets: Math.ceil(area / (stockArea * F.stock.fill)),
      mass: parts.reduce((sum, p) => sum + p.mass, 0),
    };
  }

  MD.mangal = { calc, LIMITS, FIXED };
})(window.MD = window.MD || {});
