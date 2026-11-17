// Листы А3 «Чертежей» мангала (#67, печь и «оба» — #69): общий вид, порядок сборки, детали, спецификация, раскрой.
// Порт md/sheets.js (лендинг) под детали редактора: таблицы — из massRows и metalRows («Раскрой и масса»), детали и номера — из nestJob
// («Лазер · DXF»), раскрой — раскладка «С листа» (nestRun). Всё — по текущим настройкам; виды рисует сама 3D-модель (views.js),
// без WebGL вместо видов — надпись. Считается по кнопке «Рассчитать» (editor/common/calc.js), в конце файла — вкладка.

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
  const mt = metalRows(), fullLen = XR() + HX - XL(), g = gOn(), k = sOn();   // длина с ручкой, см
  const rows = [
    g && ['Жаровня, длина × ширина', `${d.len} × ${d.wid} мм`],
    k && ['Печь, длина × ширина', `${d.klen} × ${d.kwid} мм`],
    ['Верх от земли', `${d.top} мм`],
    ['Длина с ручкой', `${Math.round(fullLen * 10)} мм`],
    ['Металл', d.metal],
    ['Деталей под лазер', String(d.parts)],
    ['Длина реза', `${fmt(d.cutM)} м`],
    g && ['Отверстий / прорезей', `${d.holes} / ${d.slots}`],
    ['Масса металла', `≈ ${d.kg} кг`],
  ].filter(Boolean);
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
  // (печь — слева от перегородки, длина L2, шире жаровни на 2 см; глубина — H2)
  const zb = k ? ZK1 : W, za = k ? ZK0 : 0, wd = k ? WK : W, depth = g ? H1 : H2;
  s += dV(F.P([XL(), 0, 0]), F.P([XL(), T, 0]), F.box[0] - 8, refDim(T));
  if (g) s += dH(F.P([0, T, 0]), F.P([L1, T, 0]), F.box[1] - 5, refDim(L1));
  if (k) s += dH(F.P([-L2, T, 0]), F.P([0, T, 0]), F.box[1] - 5, refDim(L2));
  s += dH(Lv.P([0, T, za]), Lv.P([0, T, zb]), Lv.box[1] - 5, refDim(wd));
  s += dV(Lv.P([0, T - depth, zb]), Lv.P([0, T, zb]), Lv.box[2] + 7, refDim(depth));
  s += dH(Tv.P([XL(), 0, zb]), Tv.P([XR() + HX, 0, zb]), Tv.box[3] + 8, refDim(fullLen));
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
// патрубок и труба ножки — одна деталь 'legs', по отдельности их не подсветить.
// Печь (#69) — после жаровни и до ножек: тело, труба с отсекателем, глухой верх с полосой и уголками, направляющие шибера,
// дверца; колосник и шибер кладутся последними. Покупное (плита, казан) и дрова в шаги не входят
const ASM_STEPS = [
  {title: 'Дно и боковины', parts: ['gBot', 'side0', 'side1']},
  {title: 'Торцы', parts: ['gEnd', 'gEnd0', 'logo']},
  {title: 'Уголки в жаровне и опоры колосника', parts: ['gAng', 'cgrAngB', 'cgrAngF']},
  {title: 'Дно, боковины и перегородка печи', parts: ['sBot', 'sK0', 'sK1', 'wall']},
  {title: 'Труба, заслонка и отсекатель пламени', parts: ['chim', 'chimX', 'damper', 'fb']},
  {title: 'Полоса у дверцы, глухой верх и уголки колосника', parts: ['tie', 'lintel', 'angles']},
  {title: 'Направляющие шибера — к дну снизу', parts: ['guides']},
  {title: 'Дверца с ручкой, крючком и проушиной', parts: ['door']},
  {title: 'Площадки и патрубки ножек — к дну; ножки, площадки колёс, колёса', parts: ['legs', 'legTw', 'pads', 'feet', 'wheels']},
  {title: 'Скобы и задвижки поддува', parts: ['hook', 'air']},
  {title: 'Ручка', parts: ['handle', 'sHandle']},
  {title: 'Колосник и перегородка — кладутся', parts: ['cgr1', 'cgr2', 'cgrH', 'div']},
  {title: 'Колосник и шибер печи — вставляются', parts: ['grate', 'shib']},
];
// На снимках сборки не нужны: пометка «ножка откручивается», покупные плита с казаном (закрывают верх печи)
// и решётки — только показ на 3D, их не делаем и не покупаем (#117)
const ASM_HIDE = ['legTw', 'plate', 'kazan', 'gGrate', 'g2'];

// id деталей текущей модели: с 3D — те, что попадают на снимок (views.js), без 3D — из раскроя и деталей под лазер.
// Составные (cgr, cgrAng — «обе половины», «оба уголка») — не детали модели, вместо них их части
function modelParts() {
  if (ok && group) return new Set(shotParts(null).top.map(o => o.userData.part));
  const ids = [...massRows().rows.flatMap(r => [].concat(r.pt || []).flatMap(expand)), ...laserParts().map(p => p.pt)];
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
    pxPerMm: 6, highlight: new Set(s.parts), hide: new Set([...ASM_HIDE, ...steps.slice(i + 1).flatMap(x => x.parts)]),
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
// Развёртки всех деталей под лазер (те же, что в «Лазер · DXF», с теми же номерами) в одном масштабе: контур и отверстия, гибы пунктиром,
// габаритные размеры, подпись — номер, имя, толщина, количество, габарит, отверстия. Рядами слева направо, не влезли — новый лист
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
// eng — штрихи гравировки номера [x1,y1,x2,y2] в координатах детали (карта: «Как режут»; листы чертежей без номера)
function partSvg(m, x, y, n, eng) {
  const P = ([px, py]) => `${r2(x + px / n)},${r2(y + (m.h - py) / n)}`;
  let s = m.loops.map(l => `<path class="l" d="M${l.map(P).join('L')}Z"/>`).join('');
  s += m.circles.map(([cx, cy, r]) => `<circle class="l" cx="${r2(x + cx / n)}" cy="${r2(y + (m.h - cy) / n)}" r="${r2(r / n)}"/>`).join('');
  s += m.bends.map(([a, b]) => `<path class="dash" d="M${P(a)}L${P(b)}"/>`).join('');
  if (eng && eng.length) s += `<path class="engr" d="${eng.map(z => `M${P([z[0], z[1]])}L${P([z[2], z[3]])}`).join('')}"/>`;
  const w = m.w / n, h = m.h / n;
  return s + dimH(x, y, x + w, y, y - 5, mmTxt(m.w)) + dimV(x, y, x, y + h, x - 5, mmTxt(m.h));
}

function sheetsParts(N) {
  const ps = N.groups.flatMap(G => G.types.map(ty => ({ty, p: ty.p, m: ty.m})));
  if (!ps.length) return [];
  const n = pickScale([Math.max(...ps.map(q => q.m.w)), Math.max(...ps.map(q => q.m.h))], [180, 110]);   // две длинные детали в ряд
  const X0 = 25, X1 = 410, Y0 = 21, Y1 = 272, out = [];
  let s = '', x = X0, y = Y0, rowH = 0;
  ps.forEach(({ty, p, m}) => {
    const cap = [
      `Лист ${p.mm} мм, ${p.q} шт. Габарит ${mmTxt(m.w)} × ${mmTxt(m.h)} мм`,
      ...wrapTxt([holesTxt(m), p.note].filter(Boolean).join('; '), 52),
    ];
    const w = Math.max(m.w / n + 12, 78), h = 9 + m.h / n + 6 + 4.2 * (cap.length + 1);   // клетка детали
    if (x + w > X1) { x = X0; y += rowH + 4; rowH = 0; }
    if (y + h > Y1) { out.push(s); s = ''; x = X0; y = Y0; rowH = 0; }
    const yb = y + 9 + m.h / n + 6;   // подпись — под контуром
    s += partSvg(m, x + 10, y + 9, n)
      + `<text class="td tg" x="${r2(x + 3)}" y="${r2(yb)}">${shEsc(`${ty.no}. ${p.name}`)}</text>`
      + cap.map((t, k) => `<text class="td" x="${r2(x + 3)}" y="${r2(yb + 4.2 * (k + 1))}">${shEsc(t)}</text>`).join('');
    x += w + 4; rowH = Math.max(rowH, h);
  });
  out.push(s);
  return out.map(body => ({title: 'Детали', scale: scaleTxt(n), body}));
}

/* ---------- 4. спецификация ---------- */
// Все строки «Раскрой и масса» (massRows) по SPEC_ROWS на лист, заголовки групп — отдельной строкой; на последнем — итог и металл (metalRows)
function sheetsSpec(d) {
  const cols = [{t: 'Поз.', w: 12, r: 1}, {t: 'Наименование', w: 140}, {t: 'Размер, мм', w: 62}, {t: 'Кол.', w: 14, r: 1}, {t: 'Масса, кг', w: 22, r: 1}];
  let no = 0, grp = null;
  const rows = [];
  massRows().rows.forEach(r => {
    if (r.grp !== grp) { grp = r.grp; rows.push(['', r.grp, '', '', '']); }
    rows.push([String(++no), r.n, String(r.s).replace(/\d+\.\d+/g, v => fmt(+v, 1)), String(r.q), kgTxt(r.m * r.q)]);
  });
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

/* ---------- 5. раскрой ---------- */
// По листу А3 на каждый лист металла каждой толщины (раскладка «С листа» — res из nestRun, лист и угол — как в «Лазер · DXF»):
// контуры деталей с отверстиями и гибами на своих местах (повёрнутые — повёрнутыми), номера — как на листах «Детали», справа — что лежит на листе.
// Координаты листа металла — как в DXF, y вверх; N.W — длинная сторона листа, N.H — короткая
function sheetsNest(N, res) {
  const out = [], LW = N.W, SW = N.H, n = pickScale([LW, SW], [255, 200]), x0 = 35, y0 = 42, pt = ([x, y]) => `${r2(x)},${r2(y)}`;
  const X = x => x0 + x / n, Y = y => y0 + (SW - y) / n;
  N.groups.forEach((G, gi) => {
    const R = res[gi];
    if (!R) return;
    const ns = R.sheets.length;
    R.sheets.forEach((sh, si) => {
      let s = `<text class="h2" x="25" y="26">${shEsc(`Лист ${G.mm} мм, ${N.H} × ${N.W}${ns > 1 ? `, № ${si + 1} из ${ns}` : ''} · заполнение ${Math.round(sh.used * 100)} %`)}</text>`
        + `<text class="td" x="25" y="31.5">${shEsc(`Деталей на листе ${sh.items.length}. Зазор между деталями ${String(N.gap).replace('.', ',')} мм, от края листа ${NEST_EDGE} мм.`)}</text>`
        + `<rect class="l" x="${x0}" y="${y0}" width="${r2(LW / n)}" height="${r2(SW / n)}"/>`;
      const edge = N.corner[0] === 'r' ? LW - sh.len : sh.len;   // граница полосы с деталями; дальше — целый кусок листа
      if (sh.len < LW - NEST_EDGE) s += `<path class="dash" d="M${r2(X(edge))},${y0}V${r2(y0 + SW / n)}"/>`;
      sh.items.forEach(it => {
        const ty = G.items[it.id].ty, m = ty.m, tr = it.tr, Q = q => [X(tr.c * q[0] - tr.s * q[1] + tr.x), Y(tr.s * q[0] + tr.c * q[1] + tr.y)];
        s += `<path class="t" data-no="${ty.no}" d="M${it.pts.map(q => pt([X(q[0]), Y(q[1])])).join('L')}Z"/>`;
        s += m.loops.slice(1).map(l => `<path class="t" d="M${l.map(q => pt(Q(q))).join('L')}Z"/>`).join('');
        s += m.circles.map(([x, y, r]) => { const [cx, cy] = Q([x, y]); return `<circle class="t" cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r / n)}"/>`; }).join('');
        s += m.bends.map(([a, b]) => `<path class="dash" d="M${pt(Q(a))}L${pt(Q(b))}"/>`).join('');
        const fs = r2(Math.max(2.5, Math.min(7, Math.min(it.bb[2] - it.bb[0], it.bb[3] - it.bb[1]) / n * .6)));
        s += `<text class="tg" x="${r2(X((it.bb[0] + it.bb[2]) / 2))}" y="${r2(Y((it.bb[1] + it.bb[3]) / 2) + fs * .35)}" text-anchor="middle" style="font-size:${fs}px">${ty.no}</text>`;
      });
      // размеры листа: длина — под ним, ширина — слева
      s += dimH(x0, y0 + SW / n, x0 + LW / n, y0 + SW / n, y0 + SW / n + 8, String(LW)) + dimV(x0, y0, x0, y0 + SW / n, x0 - 6, String(SW));
      // что на листе: позиция, деталь, сколько штук
      const by = new Map();
      sh.items.forEach(it => { const ty = G.items[it.id].ty, r = by.get(ty.no) || [ty.no, ty.p.name, 0]; r[2]++; by.set(ty.no, r); });
      const rows = [...by.values()].sort((a, b) => a[0] - b[0]).map(r => [String(r[0]), r[1], String(r[2])]);
      s += `<text class="h2" x="295" y="${y0 - 3}">На листе</text>`
        + svgTable(295, y0, [{t: 'Поз.', w: 12, r: 1}, {t: 'Деталь', w: 88}, {t: 'Кол.', w: 15, r: 1}], rows);
      if (R.too.length && si === 0) {
        const c = {};
        R.too.forEach(o => { c[o.no] = (c[o.no] || 0) + 1; });
        s += `<text class="h2" x="25" y="${r2(y0 + SW / n + 20)}">${shEsc(`Не поместилось в лист ${N.H} × ${N.W}: ${Object.keys(c).map(no => `${no} ${G.types.find(t => t.no === +no).p.name}${c[no] > 1 ? ` × ${c[no]}` : ''}`).join(', ')}`)}</text>`;
      }
      out.push({title: 'Раскрой', scale: scaleTxt(n), body: s});
    });
  });
  return out;
}

/* ---------- комплект ---------- */
// Изделие в штампе и в имени PDF
// (мангал — лист 5 мм; печь — 3, 5 и 15 мм; «оба» — мангал с печью, длина обоих, ширина печи)
const sheetName = () => S.mode === 'grill' ? `Мангал ${Math.round(L1 * 10)} × ${Math.round(W * 10)} × ${Math.round(T * 10)}, 5 мм`
  : `${S.mode === 'both' ? 'Мангал с печью' : 'Печь под казан'} ${Math.round((S.mode === 'both' ? L1 + L2 : L2) * 10)} × ${Math.round(WK * 10)} × ${Math.round(T * 10)}, 3–15 мм`;

// Цифры «Общего вида»: из тех же источников, что «Раскрой и масса» и «Лазер · DXF»
function sheetData(N, res) {
  const tot = listTotals(N, res);
  return {
    len: Math.round(L1 * 10), wid: Math.round(W * 10), klen: Math.round(L2 * 10), kwid: Math.round(WK * 10), top: Math.round(T * 10),
    metal: sOn() ? 'сталь 3, 5 и 15 мм' : 'сталь 5 мм',
    parts: N.groups.reduce((a, G) => a + G.types.reduce((q, ty) => q + ty.q, 0), 0),
    cutM: tot.reduce((a, g) => a + g.cut, 0) / 1000,
    holes: holes().length * 2, slots: slots().length * 2, kg: kg1(massRows().tot),
  };
}

// Шаги сборки комплекта: каждый — функция, возвращает листы {title, scale, body}. Виды листов — заметная работа, поэтому шаги
// идут по одному, между ними страница отвечает (sheetsRun)
function sheetsSteps(N, res) {
  const d = sheetData(N, res);
  return [() => [sheetGeneral(d)], sheetsAsm, () => sheetsParts(N), () => sheetsSpec(d), () => sheetsNest(N, res)];
}

// Штамп и номера листов — на готовый комплект: {title, svg}
function sheetsWrap(bodies, d) {
  const date = shDate(), b0 = {name: sheetName(), mass: `${d.kg} кг`, metal: d.metal};
  return bodies.map((b, i) => ({title: b.title, svg: wrapSheet({...b0, ...b}, {n: i + 1, N: bodies.length, date})}));
}

// Весь комплект сразу (тесты)
function sheetsBuild(N, res) {
  return sheetsWrap(sheetsSteps(N, res).flatMap(f => f()), sheetData(N, res));
}

/* ---------- вкладка «Чертежи»: «Рассчитать», листы, PDF ---------- */
// Задание: раскладка «Лазер · DXF» (ключ), строки «Раскрой и масса» и металл, галочки модели. Размеры на модели и выбор детали
// листы не меняют (вращения в S нет вовсе)
function sheetsKey() {
  const N = nestJob();
  return JSON.stringify([N.key, massRows().rows.map(r => [r.n, r.s, r.q, Math.round(r.m * 1000), r.note]), metalRows(), UNIT,
    JSON.stringify(S, (k, v) => k === 'dims' || k === 'sel' || k === 'parts' ? undefined : v)]);
}

const SHEETS = {list: [], c: null};
const sheetFig = (s, i, n) => `<figure class="shprev"><figcaption>Лист ${i + 1} из ${n} · ${s.title}</figcaption>${s.svg}</figure>`;

// Расчёт: раскрой (готовый из «Лазер · DXF», если он свежий, иначе свой — «Чертежи» запускают его сами), потом шаги комплекта по одному
function sheetsRun(done, live) {
  const fail = () => SHEETS.calc().stale();
  const build = (N, res) => {
    const steps = sheetsSteps(N, res), bodies = [];
    const step = () => {
      if (!live()) return;
      try {
        if (steps.length) { bodies.push(...steps.shift()()); setTimeout(step, 0); return; }
        const list = sheetsWrap(bodies, sheetData(N, res));
        if (done(list.map((s, i) => sheetFig(s, i, list.length)).join(''))) SHEETS.list = list;
      } catch (e) { fail(); throw e; }
    };
    setTimeout(step, 0);
  };
  nestInit();   // поля «Лист», «Зазор», «Угол» — из памяти браузера, даже если «Лазер · DXF» ещё не открывали
  const N0 = nestJob(), have = LIST.calc().ready() && LIST.cur && LIST.cur.N.key === N0.key;
  if (have) build(LIST.cur.N, LIST.cur.res); else nestRun(live, build, fail);
}

SHEETS.calc = () => SHEETS.c || (SHEETS.c = makeCalc({
  btn: document.getElementById('shRun'), box: document.getElementById('shBox'), save: document.getElementById('shPdf'),
  wait: document.getElementById('shWait'), key: sheetsKey, run: sheetsRun,
}));

// Печать по образцу printSvgs рыси: листы — в #printBox, размер страницы — @page, после печати всё убирается
// a4 — карты деталей (А4 книжно), иначе чертежи (А3 альбомно)
function printSheets(list, a4 = false) {
  const pb = document.getElementById('printBox'), pg = document.createElement('style');
  pb.innerHTML = list.map(s => s.svg).join('');
  pb.classList.toggle('a4', a4);
  pg.textContent = `@media print{@page{size:${a4 ? 'A4 portrait' : 'A3 landscape'};margin:0}}`;
  document.head.appendChild(pg);
  const t = document.title;
  document.title = sheetName() + (a4 ? ' — карты деталей' : ' — чертежи');   // имя файла PDF по умолчанию
  const done = () => { document.title = t; pb.innerHTML = ''; pg.remove(); removeEventListener('afterprint', done); };
  addEventListener('afterprint', done);
  window.print();
}

// Что-то поменялось (nestUI, через 0,3 с после правки) или показали вкладку: ключ другой — листы убраны
function sheetsUI() {
  const c = SHEETS.calc();
  if (c.held()) c.check();
}

function sheetsInit() {
  const pdf = document.getElementById('shPdf');
  if (!pdf) return;
  pdf.addEventListener('click', () => {
    const c = SHEETS.calc();
    c.check();   // правка могла быть меньше 0,3 с назад: устаревшие листы не печатаем
    if (c.ready() && SHEETS.list.length) printSheets(SHEETS.list);
  });
}
