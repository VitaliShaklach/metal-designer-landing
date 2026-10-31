// Листы А3 мангала по образцу листов собаки (C:\dev\metal-designer\art\js\sheets.js): общий вид, порядок сборки,
// детали, спецификация. Всё — по текущим настройкам; виды рисует сама 3D-модель (views.js), без WebGL вместо видов — надпись.
// Задача 9 добавит раскрой; итоговый порядок: общий вид → сборка → детали → спецификация → раскрой.

const SPEC_ROWS = 32;   // строк спецификации на листе
const kgTxt = v => v ? v.toFixed(2).replace('.', ',') : '—';

// Картинка вида, приставленная левым верхним углом к (x, y); P — точка модели (см) в мм листа
function placeView(img, x, y) {
  const P = p => { const q = img.toPaper(p); return [x + q[0], y + q[1]]; };
  return {
    P, box: [x, y, x + img.wMm, y + img.hMm],
    svg: `<image href="${img.url}" x="${r2(x)}" y="${r2(y)}" width="${r2(img.wMm)}" height="${r2(img.hMm)}" preserveAspectRatio="none"/>`,
  };
}

// Подпись вида под ним, по середине
const viewCap = (b, t, dy = 5) => `<text class="sm" x="${r2((b[0] + b[2]) / 2)}" y="${r2(b[3] + dy)}" text-anchor="middle">${t}</text>`;

// Размер для справок: мм модели со звёздочкой
const refDim = cm => Math.round(cm * 10) + '*';

/* ---------- 1. общий вид ---------- */
// Слева — вид спереди, справа от него — вид слева, под ним — вид сверху; справа — параметры, изометрия, техтребования
function sheetGeneral(d) {
  const mt = metalRows(), fullLen = XR() + HX - XL();   // длина с ручкой, см
  const rows = [
    ['Жаровня, длина × ширина', `${d.len} × ${d.wid} мм`],
    ['Верх от земли', `${d.top} мм`],
    ['Длина с ручкой', `${Math.round(fullLen * 10)} мм`],
    ['Металл', `сталь ${d.t} мм`],
    ['Деталей под лазер', String(d.parts)],
    ['Длина реза', `${fmt(d.cutM)} м`],
    ['Отверстий / прорезей', `${d.holes} / ${d.slots}`],
    ['Масса металла', `≈ ${d.kg} кг`],
  ];
  let s = svgTable(295, 22, [{t: 'Параметр', w: 60}, {t: 'Значение', w: 55}], rows, 5.6);

  // технические требования — внизу справа, над штампом
  const TR = ['Технические требования', ...[
    ...mt.filter(([n]) => /^Лист/.test(n)).map(([n, , w]) => `${n}: ${w}.`),
    'Трубы, уголки и перфолист — по спецификации.',
    `Масса металла ≈ ${d.kg} кг (без колёс и покупных изделий).`,
    '*Размеры для справок.',
  ].flatMap((q, i) => wrapTxt(`${i + 1}. ${q}`, 58).map((l, k) => k ? '    ' + l : l))];
  const trY = 270 - (TR.length - 1) * 5.4;
  s += TR.map((t, i) => `<text class="${i ? 'trq' : 'trh'}" x="295" y="${r2(trY + i * 5.4 + (i ? 2 : 0))}">${shEsc(t)}</text>`).join('');

  // главные виды — в поле x 45…285, y 32…272: между ними 25 мм под размеры и подписи.
  // Нет 3D (или не создался рендер снимков) — вместо видов надпись, остальное на листе есть
  const bf = modelBoxMm('front'), bl = modelBoxMm('left'), bt = modelBoxMm('top'), bi = modelBoxMm('iso');
  const n = bf && pickScale([bf.w + bl.w, bf.h + bt.h], [200, 200]);
  const front = bf && renderView('front', n), left = front && renderView('left', n), top = left && renderView('top', n);
  if (!top) {
    s += `<text class="h2" x="157" y="140" text-anchor="middle">Общий вид недоступен без 3D на этом устройстве</text>`
      + `<text class="sm" x="157" y="147" text-anchor="middle">Размеры — в таблице справа, детали — в спецификации</text>`;
    return {title: 'Общий вид', scale: '—', body: s};
  }

  const F = placeView(front, 45, 32), Lv = placeView(left, F.box[2] + 25, 32), Tv = placeView(top, 45, F.box[3] + 22);
  s += F.svg + Lv.svg + Tv.svg;

  // размеры: высота — слева от вида спереди, длина жаровни — над ним; ширина и глубина жаровни — на виде слева;
  // длина с ручкой — под видом сверху
  const dV = (a, b, xl, t) => dimV(a[0], a[1], b[0], b[1], xl, t), dH = (a, b, yl, t) => dimH(a[0], a[1], b[0], b[1], yl, t);
  s += dV(F.P([XL(), 0, 0]), F.P([XL(), T, 0]), F.box[0] - 8, refDim(T));
  s += dH(F.P([0, T, 0]), F.P([L1, T, 0]), F.box[1] - 5, refDim(L1));
  s += dH(Lv.P([0, T, 0]), Lv.P([0, T, W]), Lv.box[1] - 5, refDim(W));
  s += dV(Lv.P([0, T - H1, W]), Lv.P([0, T, W]), Lv.box[2] + 7, refDim(H1));
  s += dH(Tv.P([XL(), 0, W]), Tv.P([XR() + HX, 0, W]), Tv.box[3] + 8, refDim(fullLen));
  s += viewCap(F.box, 'Вид спереди') + viewCap(Lv.box, 'Вид слева') + viewCap(Tv.box, 'Вид сверху', 15);

  // изометрия — между таблицей и техтребованиями, по середине столбца
  const iy0 = 22 + 5.6 * (rows.length + 1) + 6, ih = trY - 10 - iy0;
  const ni = pickScale([bi.w, bi.h], [112, ih - 6]), iso = renderView('iso', ni);
  if (iso) {
    const I = placeView(iso, 295 + (115 - iso.wMm) / 2, iy0 + (ih - 6 - iso.hMm) / 2);
    s += I.svg + viewCap(I.box, `Изометрия, ${scaleTxt(ni)}`, 4);
  }
  return {title: 'Общий вид', scale: scaleTxt(n), body: s};
}

/* ---------- 2. порядок сборки ---------- */
// Шаги из спеки, id деталей — метки tag(...) в model.js. Шаги 4 и 5 спеки объединены: площадка под ножку,
// патрубок и труба ножки — одна деталь 'legs', по отдельности их не подсветить
const ASM_STEPS = [
  {title: 'Дно и боковины', parts: ['gBot', 'side0', 'side1']},
  {title: 'Торцы', parts: ['gEnd', 'gEnd0', 'logo']},
  {title: 'Уголки в жаровне и опоры колосника', parts: ['gAng', 'cgrAngB', 'cgrAngF']},
  {title: 'Площадки и патрубки ножек — к дну; ножки, площадки колёс, колёса', parts: ['legs', 'legTw', 'pads', 'feet', 'wheels']},
  {title: 'Скобы и задвижки поддува', parts: ['hook', 'air']},
  {title: 'Ручка', parts: ['handle']},
  {title: 'Колосник и решётки — кладутся', parts: ['cgr1', 'cgr2', 'g2', 'gGrate', 'div']},
];

// id деталей текущей модели: с 3D — те, что попадают на снимок (views.js), без 3D — из раскроя и деталей под лазер.
// Составные (cgr, cgrAng — «обе половины», «оба уголка») — не детали модели, вместо них их части
function modelParts() {
  if (ok && group) return new Set(shotParts(null).top.map(o => o.userData.part));
  const ids = [...cutList().flatMap(r => (r.pt || []).flatMap(expand)), ...laserParts().map(p => p.pt)];
  return new Set(ids.filter(id => !PART_SET[id]));
}

// Шаги без деталей, которых нет в модели, и без пустых шагов
function asmSteps() {
  const have = modelParts();
  return ASM_STEPS.map(s => ({title: s.title, parts: s.parts.filter(p => have.has(p))})).filter(s => s.parts.length);
}

// Имена деталей в списке шага: где имени из PARTS нет или оно про выбор на 3D; null — в список не пишем (пометка)
const ASM_NAME = {
  legs: 'Ножки: площадка под дно, патрубок, труба', legTw: null, feet: 'Пятки ножек',
  cgrAngB: 'Опора колосника задняя — уголок', cgrAngF: 'Опора колосника передняя — уголок',
  gGrate: 'Решётка в жаровне', g2: 'Решётки сверху',
};
const asmName = id => id in ASM_NAME ? ASM_NAME[id] : partName(id);

const ASM_PER = 4;   // шагов на листе: сетка 2 × 2

// Листы по ASM_PER шагов: изометрия, детали шага — акцентом, прошлых шагов — белые, будущих нет.
// Масштаб у всех шагов один, и мангал стоит в клетке на одном месте: картинки сдвинуты по точке (0, 0, 0) модели
// Стрелки «ножка откручивается» (legTw) на снимках нет: это пометка, не деталь — подсвеченная, она похожа на кольцо
function sheetsAsm() {
  const steps = asmSteps(), CW = 190, CH = 124, IW = 184, IH = 104;   // клетка шага и поле картинки, мм
  const bi = modelBoxMm('iso'), n = bi && pickScale([bi.w, bi.h], [IW, IH]);
  const imgs = steps.map((s, i) => bi && renderView('iso', n, {
    pxPerMm: 6, highlight: new Set(s.parts), hide: new Set(['legTw', ...steps.slice(i + 1).flatMap(x => x.parts)]),
  }));
  const full = imgs[imgs.length - 1];   // последний шаг — вся модель: по нему место мангала в клетке
  const anchor = full && full.toPaper([0, 0, 0]).map((v, k) => v + ([IW, IH][k] - [full.wMm, full.hMm][k]) / 2);
  const out = [];
  for (let i = 0; i < steps.length; i += ASM_PER) {
    let s = '';
    steps.slice(i, i + ASM_PER).forEach((st, j) => {
      const x = 25 + (j % 2) * (CW + 5), y = 21 + Math.floor(j / 2) * (CH + 3), img = imgs[i + j];
      s += `<rect class="t" x="${x}" y="${y}" width="${CW}" height="${CH}"/>`;
      if (img && anchor) {
        const o = img.toPaper([0, 0, 0]);
        s += placeView(img, x + 3 + anchor[0] - o[0], y + 3 + anchor[1] - o[1]).svg;
      } else {
        s += `<text class="sm" x="${x + CW / 2}" y="${y + IH / 2}" text-anchor="middle">Вид недоступен без 3D на этом устройстве</text>`;
      }
      let ty = y + IH + 7;
      s += `<text class="h2" x="${x + 3}" y="${ty}">${shEsc(`Шаг ${i + j + 1}. ${st.title}`)}</text>`;
      wrapTxt(st.parts.map(asmName).filter(Boolean).join(', ') + '.', 110).forEach(l => {
        ty += 4.2;
        s += `<text class="td" x="${x + 3}" y="${r2(ty)}">${shEsc(l)}</text>`;
      });
    });
    out.push({title: 'Порядок сборки', scale: n && full ? scaleTxt(n) : '—', body: s});
  }
  return out;
}

/* ---------- 3. детали ---------- */
// Развёртки всех деталей под лазер в одном масштабе: контур и отверстия, гибы пунктиром, габаритные размеры,
// подпись — имя, толщина, количество, габарит, отверстия. Рядами слева направо, не влезли — новый лист
const mmTxt = v => String(Math.round(v * 10) / 10).replace('.', ',');

// Отверстия детали: «4 отв. Ø 9, 2 отв. Ø 20», прорези и вырезы — числом
function holesTxt(m) {
  const by = new Map();
  m.circles.forEach(c => { const d = mmTxt(c[2] * 2); by.set(d, (by.get(d) || 0) + 1); });
  const r = [...by].map(([d, k]) => `${k} отв. Ø ${d}`);
  if (m.loops.length > 1) r.push(`${m.loops.length - 1} прорез.`);
  return r.join(', ');
}

// Развёртка в клетке: x, y — левый верхний угол контура на листе, n — масштаб
function partSvg(m, x, y, n) {
  const P = ([px, py]) => `${r2(x + px / n)},${r2(y + (m.h - py) / n)}`;
  let s = m.loops.map(l => `<path class="l" d="M${l.map(P).join('L')}Z"/>`).join('');
  s += m.circles.map(([cx, cy, r]) => `<circle class="l" cx="${r2(x + cx / n)}" cy="${r2(y + (m.h - cy) / n)}" r="${r2(r / n)}"/>`).join('');
  s += m.bends.map(([a, b]) => `<path class="dash" d="M${P(a)}L${P(b)}"/>`).join('');
  const w = m.w / n, h = m.h / n;
  return s + dimH(x, y, x + w, y, y - 5, mmTxt(m.w)) + dimV(x, y, x, y + h, x - 5, mmTxt(m.h));
}

function sheetsParts() {
  const ps = laserParts().map(p => ({p, m: partMM(p)}));
  if (!ps.length) return [];
  const n = pickScale([Math.max(...ps.map(q => q.m.w)), Math.max(...ps.map(q => q.m.h))], [180, 110]);   // две длинные детали в ряд
  const X0 = 25, X1 = 410, Y0 = 21, Y1 = 272, out = [];
  let s = '', x = X0, y = Y0, rowH = 0;
  ps.forEach(({p, m}, i) => {
    const cap = [
      `Лист ${p.mm} мм, ${p.q} шт. Габарит ${mmTxt(m.w)} × ${mmTxt(m.h)} мм`,
      ...wrapTxt([holesTxt(m), p.note].filter(Boolean).join('; '), 52),
    ];
    const w = Math.max(m.w / n + 12, 78), h = 9 + m.h / n + 6 + 4.2 * (cap.length + 1);   // клетка детали
    if (x + w > X1) { x = X0; y += rowH + 4; rowH = 0; }
    if (y + h > Y1) { out.push(s); s = ''; x = X0; y = Y0; rowH = 0; }
    const yb = y + 9 + m.h / n + 6;   // подпись — под контуром
    s += partSvg(m, x + 10, y + 9, n)
      + `<text class="td tg" x="${r2(x + 3)}" y="${r2(yb)}">${shEsc(`${i + 1}. ${p.name}`)}</text>`
      + cap.map((t, k) => `<text class="td" x="${r2(x + 3)}" y="${r2(yb + 4.2 * (k + 1))}">${shEsc(t)}</text>`).join('');
    x += w + 4; rowH = Math.max(rowH, h);
  });
  out.push(s);
  return out.map(body => ({title: 'Детали', scale: scaleTxt(n), body}));
}

/* ---------- 4. спецификация ---------- */
// Все строки раскроя по SPEC_ROWS на лист, заголовки групп — отдельной строкой; на последнем — итог и металл
function sheetsSpec(d) {
  const cols = [{t: 'Поз.', w: 12, r: 1}, {t: 'Наименование', w: 140}, {t: 'Размер, мм', w: 62}, {t: 'Кол.', w: 14, r: 1}, {t: 'Масса, кг', w: 22, r: 1}];
  let no = 0;
  const rows = cutList().map(r => r.grp ? ['', r.grp, '', '', ''] : [String(++no), r.n, r.s, String(r.q), kgTxt(r.kg)]);
  const out = [];
  for (let i = 0; i < rows.length; i += SPEC_ROWS) {
    let s = svgTable(25, 22, cols, rows.slice(i, i + SPEC_ROWS));
    if (i + SPEC_ROWS >= rows.length) {
      s += `<text class="h2" x="285" y="28">Итого металла ≈ ${d.kg} кг</text><text class="sm" x="285" y="32.5">без колёс и покупных изделий (болты, гайки)</text>`
        + `<text class="h2" x="285" y="44">Металл</text>`;
      let y = 50;
      metalRows().forEach(([n, q, w]) => {
        s += `<text class="td tg" x="285" y="${r2(y)}">${shEsc(n)} — ${shEsc(q)}</text>`;
        y += 3.6;
        wrapTxt(w, 80).forEach(l => { s += `<text class="sm" x="288" y="${r2(y)}">${shEsc(l)}</text>`; y += 3; });
        y += 1.6;
      });
    }
    out.push({title: 'Спецификация', body: s});
  }
  return out;
}

// Изделие в штампе и в имени PDF
const sheetName = d => `Мангал ${d.len} × ${d.wid} × ${d.top}, ${d.t} мм`;

// Все листы: {title, svg} — svg А3 со штампом «Мангал L × W × H, t мм»
function buildSheets() {
  const d = statsData(), date = shDate();
  const L = [sheetGeneral(d), ...sheetsAsm(), ...sheetsParts(), ...sheetsSpec(d)];
  const b0 = {name: sheetName(d), mass: `${d.kg} кг`, metal: `сталь ${d.t} мм`};
  return L.map((b, i) => ({title: b.title, svg: wrapSheet({...b0, ...b}, {n: i + 1, N: L.length, date})}));
}
