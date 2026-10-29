// Цифры лендинга из движка: раскрой как на экране, детали под лазер, панель живых цифр.
// Чистые функции: читают состояние движка, ничего не рисуют.

// Строки раскроя с тем же отбором, что в drawCut(): элемент есть в режиме, деталь есть, количество > 0.
// Заголовок группы — перед первой видимой строкой группы. kg — масса всех штук строки.
function cutList() {
  const rows = [];
  let grp = null, skip = false;
  cutRows().forEach(p => {
    if (p.g) { grp = elOk(p.el) ? p.g : null; skip = !elOk(p.el); return; }
    const pt = [].concat(p.pt || []);
    if (skip || (pt.length && !pt.some(partOk)) || !p.q) return;
    if (grp) { rows.push({grp}); grp = null; }
    rows.push({
      n: p.n,
      s: String(p.s).replace(/\d+\.\d+/g, v => fmt(+v, 1)),   // как в таблице раскроя
      q: p.q,
      kg: Math.round(p.m * p.q * 1000) / 1000,
      note: p.note || '',
      pt,
    });
  });
  return rows;
}

// Листовые детали под лазер: габарит в мм, рез одной детали в мм, врезки, число контуров, отверстий и гибов
function laserList() {
  return laserParts().map(p => {
    const m = partMM(p);
    return {
      file: p.file, name: p.name, mm: p.mm, q: p.q, w: m.w, h: m.h,
      cutMm: Math.round(m.cut * 10) / 10, pierce: m.pierce,
      loops: m.loops.length, circles: m.circles.length, bends: m.bends.length,
    };
  });
}

// Панель цифр: размеры в мм, масса металла, детали под лазер (штук), рез в метрах, отверстия и прорези в боковинах
function statsData() {
  const laser = laserList();
  return {
    len: L1 * 10, wid: W * 10, top: T * 10, t: t * 10,
    kg: Math.round(cutList().reduce((a, r) => a + (r.kg || 0), 0)),
    parts: laser.reduce((a, p) => a + p.q, 0),
    cutM: Math.round(laser.reduce((a, p) => a + p.cutMm * p.q, 0) / 100) / 10,
    holes: holes().length * 2,
    slots: slots().length * 2,
    wheels: S.wheels,
  };
}
