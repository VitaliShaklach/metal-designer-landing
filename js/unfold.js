// Развёртка листовой детали: SVG с контуром, отверстиями, линиями гиба и габаритными размерами.
// Деталь общая для мангала, печи и DXF: { key, w, h, loops: [[[x, y], …]], circles: [[x, y, r]], bends: [[[x, y], [x, y]]] },
// мм, начало в левом нижнем углу, ось Y вверх, как в DXF. На экране Y переворачивается.
(function (MD) {
  function svg(part) {
    const { key, w, h, loops = [], circles = [], bends = [] } = part;
    const fs = Math.max(w, h) * 0.09;
    const k = MD.sketchKit(fs, `uf-${key}`);
    const Y = y => h - y;
    const out = [];

    loops.forEach(loop => out.push(`<polyline points="${loop.map(([x, y]) => `${x},${Y(y)}`).join(' ')}" fill="none" stroke="${k.INK}" stroke-width="${k.stroke}"/>`));
    circles.forEach(([x, y, r]) => out.push(k.circle(x, Y(y), r, { width: loops.length ? k.thin * 1.5 : k.stroke })));
    bends.forEach(([[x1, y1], [x2, y2]]) => out.push(`<line x1="${x1}" y1="${Y(y1)}" x2="${x2}" y2="${Y(y2)}" stroke="${k.LINE}" stroke-width="${k.thin}" stroke-dasharray="${fs * 0.5} ${fs * 0.3}"/>`));

    // Ширина снизу, высота слева. У круглой детали без контура хватает одного размера — диаметра.
    out.push(k.hDim(0, w, h + fs * 1.6, h + fs * 0.3));
    if (loops.length) out.push(k.vDim(0, h, -fs * 1.6, -fs * 0.3));
    return k.svg([-fs * 3, -fs * 0.6, w + fs * 3.6, h + fs * 2.8], out, `Развёртка: ${w} × ${h} мм`);
  }

  MD.unfold = { svg };
})(window.MD = window.MD || {});
