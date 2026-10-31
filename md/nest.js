// Раскрой на лист металла: детали под лазер каждой толщины — на свой лист, компактно к одному краю,
// остаток листа — целый кусок. Размеры листов и зазоры — как у собаки (C:\dev\metal-designer\art).
// Детали мангала — прямоугольники, поэтому раскладываются их рамки (MaxRects), контуры рисуются внутри рамок.

// Листы, мм: [ширина, длина]; по умолчанию — 1250 × 2500
const SHEETS = [[1000, 2000], [1250, 2500], [1500, 3000], [1500, 6000]];
const NEST_GAP = 5;    // между деталями: лазеру хватает 3–5 мм
const NEST_EDGE = 10;  // от края листа

// Свободные прямоугольники листа: рамка детали занимает w + зазор, поэтому рабочее поле шире на зазор
const freshSheet = (L, W) => [{x: NEST_EDGE, y: NEST_EDGE, w: L - 2 * NEST_EDGE + NEST_GAP, h: W - 2 * NEST_EDGE + NEST_GAP}];

// Куда положить рамку w × h: место, где её правый край ближе всего к началу листа, затем ниже. Поворот — если так ближе
function bestSpot(free, w, h) {
  let best = null;
  for (const [bw, bh, rot] of [[w, h, false], [h, w, true]]) {
    const W2 = bw + NEST_GAP, H2 = bh + NEST_GAP;
    for (const f of free) {
      if (W2 > f.w + 1e-6 || H2 > f.h + 1e-6) continue;
      const c = {x: f.x, y: f.y, w: bw, h: bh, rot};
      if (!best || c.x + c.w < best.x + best.w - 1e-6 || (Math.abs(c.x + c.w - best.x - best.w) < 1e-6 && c.y < best.y)) best = c;
    }
  }
  return best;
}

// Занять место: свободные прямоугольники, которые задевает рамка, режутся на куски вокруг неё; вложенные — выбрасываются
function occupy(free, r) {
  const R = {x: r.x, y: r.y, w: r.w + NEST_GAP, h: r.h + NEST_GAP}, out = [];
  for (const f of free) {
    if (R.x >= f.x + f.w || R.x + R.w <= f.x || R.y >= f.y + f.h || R.y + R.h <= f.y) { out.push(f); continue; }
    if (R.x > f.x) out.push({x: f.x, y: f.y, w: R.x - f.x, h: f.h});
    if (R.x + R.w < f.x + f.w) out.push({x: R.x + R.w, y: f.y, w: f.x + f.w - R.x - R.w, h: f.h});
    if (R.y > f.y) out.push({x: f.x, y: f.y, w: f.w, h: R.y - f.y});
    if (R.y + R.h < f.y + f.h) out.push({x: f.x, y: R.y + R.h, w: f.w, h: f.y + f.h - R.y - R.h});
  }
  const inside = (a, b) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
  return out.filter((a, i) => !out.some((b, j) => j !== i && inside(a, b) && (!inside(b, a) || j < i)));
}

// Раскладка рамок на листы L × W (мм): каждый экземпляр (q) — отдельная запись; не влезло на открытые листы — новый лист
function nest(items, L, W) {
  const all = items.flatMap(o => Array.from({length: o.q}, () => o))
    .sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h);
  const sheets = [], frees = [], too = [];
  for (const o of all) {
    let k = frees.findIndex(f => bestSpot(f, o.w, o.h));
    if (k < 0) {
      if (!bestSpot(freshSheet(L, W), o.w, o.h)) { too.push(o.id); continue; }
      sheets.push([]);
      frees.push(freshSheet(L, W));
      k = sheets.length - 1;
    }
    const r = bestSpot(frees[k], o.w, o.h);
    frees[k] = occupy(frees[k], r);
    sheets[k].push({id: o.id, ...r});
  }
  return {sheets, too};
}

// Листы для вкладки «Лазер · DXF»: детали — те же и в том же порядке, что в таблице DXF (с учётом выбранной детали),
// no — позиция в таблице; первым — главный лист (больше всего металла: стенки жаровни), дальше — мелочь.
// len — занятая полоса по длине листа, fill — доля площади
function laserSheets(sz) {
  const [W, L] = SHEETS[sz];
  const parts = laserParts().filter(p => inSel(PDF_ELEM(p.pt), p.pt)).map((p, i) => ({no: i + 1, p, m: partMM(p)}));
  const area = mm => parts.filter(o => o.p.mm === mm).reduce((a, o) => a + o.m.w * o.m.h * o.p.q, 0);
  const out = [];
  [...new Set(parts.map(o => o.p.mm))].sort((a, b) => area(b) - area(a)).forEach(mm => {
    const grp = parts.filter(o => o.p.mm === mm);
    const r = nest(grp.map((o, id) => ({id, w: o.m.w, h: o.m.h, q: o.p.q})), L, W);
    const too = r.too.map(id => grp[id].p.name);
    r.sheets.forEach((sh, i) => {
      const items = sh.map(b => ({...grp[b.id], x: b.x, y: b.y, w: b.w, h: b.h, rot: b.rot}));
      const len = Math.ceil(Math.max(...items.map(it => it.x + it.w)));
      const fill = items.reduce((a, it) => a + it.w * it.h, 0) / (L * W);
      out.push({mm, i: i + 1, n: r.sheets.length, L, W, items, len, fill, too: i ? [] : too});
    });
  });
  return out;
}

// Точка детали (мм от её угла) → точка листа: повёрнутая деталь — (x, y) → (h − y, x)
const onSheet = it => ([x, y]) => it.rot ? [it.x + it.m.h - y, it.y + x] : [it.x + x, it.y + y];
// Номер позиции: крупно, но внутри детали
const noSize = it => Math.max(8, Math.min(60, 0.45 * Math.min(it.w, it.h)));

// DXF листа (R12): контуры и отверстия — CUT, гибы — BEND (их пишет dxfText движка); рамка листа и подпись — SHEET,
// номера позиций — MARK (лазер их не режет). Текст в R12 — латиницей
function sheetDxf(s) {
  const loops = [], circles = [], bends = [], extra = [];
  const r2 = v => Math.round(v * 100) / 100;
  const text = (x, y, h, t, lay) => extra.push('0', 'TEXT', '8', lay, '10', r2(x), '20', r2(y), '30', 0, '40', r2(h), '1', t, '72', 1, '73', 2, '11', r2(x), '21', r2(y), '31', 0);
  const frame = [[0, 0], [s.L, 0], [s.L, s.W], [0, s.W], [0, 0]];
  frame.slice(1).forEach((b, i) => extra.push('0', 'LINE', '8', 'SHEET', '10', frame[i][0], '20', frame[i][1], '30', 0, '11', b[0], '21', b[1], '31', 0));
  text(s.L / 2, s.W + 40, 30, `SHEET ${s.mm} MM ${s.W}x${s.L} ${s.i}/${s.n}`, 'SHEET');
  s.items.forEach(it => {
    const P = onSheet(it), p2 = q => P(q).map(r2);
    it.m.loops.forEach(l => loops.push(l.map(p2)));
    it.m.circles.forEach(([x, y, r]) => circles.push([...p2([x, y]), r]));
    it.m.bends.forEach(b => bends.push(b.map(p2)));
    text(it.x + it.w / 2, it.y + it.h / 2, noSize(it), String(it.no), 'MARK');
  });
  return dxfText({loops, circles, bends}).replace(/0\r\nENDSEC\r\n0\r\nEOF\r\n$/, [...extra, '0', 'ENDSEC', '0', 'EOF'].join('\r\n') + '\r\n');
}

// Имя файла листа: mangal_list_5mm_1250x2500_1.dxf
const sheetFile = s => `mangal_list_${s.mm}mm_${s.W}x${s.L}_${s.i}.dxf`;

// Превью листа: рамка, детали контурами, номера позиций, граница занятой полосы пунктиром. y вверх, как в DXF
function sheetSvg(s) {
  const f = v => +v.toFixed(1), pt = ([x, y]) => `${f(x)},${f(s.W - y)}`;
  let g = `<rect class="sh" x="0" y="0" width="${s.L}" height="${s.W}"/>`;
  if (s.len < s.L - NEST_EDGE) g += `<line class="strip" x1="${s.len}" y1="0" x2="${s.len}" y2="${s.W}"/>`;
  s.items.forEach(it => {
    const P = onSheet(it);
    g += '<g class="pc">';
    it.m.loops.forEach(l => { g += `<polyline points="${l.map(q => pt(P(q))).join(' ')}"/>`; });
    it.m.circles.forEach(([x, y, r]) => { const [cx, cy] = P([x, y]); g += `<circle cx="${f(cx)}" cy="${f(s.W - cy)}" r="${r}"/>`; });
    it.m.bends.forEach(([a, b]) => { const [x1, y1] = P(a), [x2, y2] = P(b); g += `<line class="bd" x1="${f(x1)}" y1="${f(s.W - y1)}" x2="${f(x2)}" y2="${f(s.W - y2)}"/>`; });
    g += `<text x="${f(it.x + it.w / 2)}" y="${f(s.W - it.y - it.h / 2)}" font-size="${f(noSize(it))}">${it.no}</text></g>`;
  });
  return `<svg class="nestsk" viewBox="-6 -6 ${s.L + 12} ${s.W + 12}" role="img" aria-label="Лист ${s.mm} мм, ${s.W} × ${s.L}">${g}</svg>`;
}
