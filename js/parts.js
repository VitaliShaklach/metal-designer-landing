// Общее для изделий из листа (мангал, печь): контуры деталей, ряды отверстий, площадь, размер и масса детали.
// Деталь: { key, name, qty, w, h, loops, circles, bends, notes }, мм, начало в левом нижнем углу (см. js/unfold.js).
(function (MD) {
  // Ряд одинаковых элементов с шагом step по центру длины, крайние не ближе margin к краю.
  function row(length, step, margin) {
    const n = Math.floor((length - 2 * margin) / step) + 1;
    const start = (length - (n - 1) * step) / 2;
    return Array.from({ length: n }, (_, i) => start + i * step);
  }

  // Прямоугольный контур: от (x, y) шириной w и высотой h, замкнутый.
  const rect = (w, h, x = 0, y = 0) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];

  // Площадь замкнутого контура по формуле шнурования, мм².
  const loopArea = loop => Math.abs(loop.reduce((sum, [x, y], i) => {
    const [nx, ny] = loop[(i + 1) % loop.length];
    return sum + x * ny - nx * y;
  }, 0)) / 2;

  // Дописать детали площадь (м²), размер для спецификации и массу всех штук.
  // Первый контур — наружный, остальные контуры и круги — вырезы. Деталь без контура — круг (заглушка).
  function finish(parts, t) {
    return parts.map(p => {
      const circles = (p.circles || []).reduce((sum, [, , r]) => sum + Math.PI * r * r, 0);
      const [outer, ...cutouts] = p.loops;
      const mm2 = outer ? loopArea(outer) - cutouts.reduce((sum, l) => sum + loopArea(l), 0) - circles : circles;
      const area = mm2 / 1e6;
      return {
        bends: [], notes: [], ...p,
        area,
        size: outer ? `${p.w} × ${p.h} × ${t}` : `Ø${p.w} × ${t}`,
        mass: area * MD.metal.sheetKgPerM2(t) * p.qty,
      };
    });
  }

  // Длинномерные детали (трубы, уголок, полоса): размер и масса всех штук.
  const finishBars = bars => bars.map(p => ({ ...p, size: `${p.profile.name} · L ${p.length}`, mass: p.profile.kgPerM * p.length / 1000 * p.qty }));

  // Сводка изделия из листа: площадь металла и оценка листов stock = { w, h, fill }.
  function stockEstimate(sheets, stock) {
    const area = sheets.reduce((sum, p) => sum + p.area * p.qty, 0);
    return { area, stockSheets: Math.ceil(area / (stock.w * stock.h / 1e6 * stock.fill)) };
  }

  MD.parts = { row, rect, finish, finishBars, stockEstimate };
})(window.MD = window.MD || {});
