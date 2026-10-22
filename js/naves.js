// Расчёт навеса: параметры с экрана → описание изделия (геометрия для эскиза, трубы с длинами реза, масса).
// Навес по фото в docs/superpowers/specs/assets/naves-photo.png: односкатный, скат назад,
// слева направо хозблок, дровница, открытая часть под мангал. Все размеры в мм.
(function (MD) {
  const { tube } = MD.metal;

  const PROFILE = {
    post: tube(60, 60, 2),     // стойки и продольные балки
    rafter: tube(60, 40, 2),   // поперечины по скату
    rail: tube(40, 40, 2),     // нижняя обвязка, коробка и перемычка двери
    light: tube(40, 20, 1.5),  // обрешётка под профлист, стойки под обшивку, рама двери
    bar: tube(20, 20, 1.5),    // прутки дровницы
  };

  // Постоянные размеры (решение исполнителя, см. дизайн): человек меняет только ширину и высоту.
  const FIXED = {
    depth: 2000,      // глубина навеса
    drop: 300,        // задний край ниже переднего: уклон ≈ 8,5°, минимум для профлиста
    shed: 1000,       // ширина хозблока (по осям стоек)
    wood: 600,        // ширина дровницы
    post: 60,         // сечение стойки и балки
    rail: 40,         // высота нижней обвязки и перемычки
    maxSpan: 2000,    // открытая часть шире — ставим промежуточную стойку
    purlinStep: 600,  // шаг обрешётки по скату
    studStep: 600,    // шаг стоек под обшивку доской
    barStep: 100,     // шаг прутков дровницы
    door: { width: 800, maxHeight: 1900, gap: 5, frame: 40 },  // полотно, зазор до коробки, ширина профиля рамы
  };

  const LIMITS = {
    width: { min: 2600, max: 6000, step: 100, def: 3000 },   // открытая часть не уже 1000
    height: { min: 2000, max: 2800, step: 50, def: 2000 },   // по переднему краю, до верха балки
  };

  // Оси стоек: границы хозблока и дровницы, промежуточные в открытой части, края.
  function postAxes(width) {
    const F = FIXED, start = F.shed + F.wood, open = width - start;
    const mids = Math.ceil(open / F.maxSpan) - 1;
    const axes = [0, F.shed, start];
    for (let k = 1; k <= mids; k++) axes.push(Math.round(start + open * k / (mids + 1)));
    axes.push(width);
    return axes;
  }

  function calc({ width, height }) {
    const F = FIXED, p = F.post, D = F.door;
    const axes = postAxes(width);
    const last = axes.length - 1;
    // Крайние стойки стоят заподлицо с габаритом, остальные — по оси.
    const postLeft = axes.map((x, i) => (i === 0 ? 0 : i === last ? width - p : x - p / 2));
    const spans = axes.slice(0, -1).map((_, i) => postLeft[i + 1] - postLeft[i] - p);   // просветы между стойками

    const frontPost = height - p;                    // стойка под передней балкой
    const backPost = height - F.drop - p;            // стойка под задней балкой
    const rafter = Math.round(Math.hypot(F.depth, F.drop));
    const purlinRows = Math.ceil(rafter / F.purlinStep) + 1;
    const side = F.depth - 2 * p;                    // просвет между передней и задней стойкой

    // Хозблок: дверь с коробкой из 40×40 и перемычкой, обшивка доской по стойкам 40×20.
    const shedSpan = spans[0];
    const doorHeight = Math.min(D.maxHeight, frontPost - 2 * F.rail - 2 * D.gap);
    const doorX0 = postLeft[0] + p + (shedSpan - D.width) / 2;
    const jambs = [doorX0 - D.gap - F.rail, doorX0 + D.width + D.gap];
    const backStuds = Math.ceil(shedSpan / F.studStep) - 1;
    const sideStuds = Math.ceil(side / F.studStep) - 1;
    // Стойка под обшивкой сбоку упирается в поперечину, которая идёт по скату: чем дальше от фасада, тем короче.
    const sideStudLengths = Array.from({ length: sideStuds }, (_, k) => {
      const z = p + side * (k + 1) / (sideStuds + 1);
      return Math.round(frontPost - F.rail - F.drop * z / F.depth);
    });

    // Дровница: прутки сзади, равномерно в просвете.
    const woodSpan = spans[1];
    const barCount = Math.floor(woodSpan / F.barStep);
    const bars = Array.from({ length: barCount }, (_, k) => Math.round(postLeft[1] + p + woodSpan * (k + 1) / (barCount + 1)));

    const parts = [
      { name: 'Стойка передняя', profile: PROFILE.post, length: frontPost, qty: axes.length },
      { name: 'Стойка задняя', profile: PROFILE.post, length: backPost, qty: axes.length },
      { name: 'Балка продольная', profile: PROFILE.post, length: width, qty: 2 },
      { name: 'Поперечина по скату', profile: PROFILE.rafter, length: rafter, qty: axes.length },
      { name: 'Обрешётка под кровлю', profile: PROFILE.light, length: width, qty: purlinRows },
      { name: 'Хозблок: обвязка спереди и сзади', profile: PROFILE.rail, length: shedSpan, qty: 2 },
      { name: 'Хозблок: обвязка по бокам', profile: PROFILE.rail, length: side, qty: 2 },
      { name: 'Хозблок: коробка двери', profile: PROFILE.rail, length: doorHeight + 2 * D.gap, qty: 2 },
      { name: 'Хозблок: перемычка над дверью', profile: PROFILE.rail, length: shedSpan, qty: 1 },
      { name: 'Хозблок: стойки под обшивку сзади', profile: PROFILE.light, length: backPost - F.rail, qty: backStuds },
      ...sideStudLengths.map(length => ({ name: 'Хозблок: стойки под обшивку по бокам', profile: PROFILE.light, length, qty: 2 })),
      { name: 'Дверь: стойки рамы', profile: PROFILE.light, length: doorHeight, qty: 2 },
      { name: 'Дверь: перекладины рамы', profile: PROFILE.light, length: D.width - 2 * D.frame, qty: 2 },
      { name: 'Дровница: обвязка сзади', profile: PROFILE.rail, length: woodSpan, qty: 1 },
      { name: 'Дровница: прутки', profile: PROFILE.bar, length: backPost - F.rail, qty: barCount },
    ].filter(part => part.qty > 0)
     .map(part => ({ ...part, mass: part.profile.kgPerM * part.length / 1000 * part.qty }));

    return {
      width, height,
      sections: { shed: F.shed, wood: F.wood, open: width - F.shed - F.wood },
      axes, postLeft,
      frontPost, backPost,
      door: { x0: doorX0, width: D.width, height: doorHeight, jambs },
      bars,
      parts,
      mass: parts.reduce((sum, part) => sum + part.mass, 0),
    };
  }

  MD.naves = { calc, LIMITS, FIXED };
})(window.MD = window.MD || {});
