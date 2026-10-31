// Листы А3 мангала по образцу листов собаки (C:\dev\metal-designer\art\js\sheets.js): общий вид и спецификация.
// Всё — по текущим настройкам; виды рисует сама 3D-модель (views.js), без WebGL вместо видов — надпись.
// Задачи 8 и 9 вставляют свои листы; итоговый порядок: общий вид → сборка → детали → спецификация → раскрой.

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

/* ---------- 2. спецификация ---------- */
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
  const L = [sheetGeneral(d), ...sheetsSpec(d)];
  const b0 = {name: sheetName(d), mass: `${d.kg} кг`, metal: `сталь ${d.t} мм`};
  return L.map((b, i) => ({title: b.title, svg: wrapSheet({...b0, ...b}, {n: i + 1, N: L.length, date})}));
}
