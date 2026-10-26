// Эскиз «Вашего изделия» для листа: обведённые линии в мм, без фото, с номерами и длинами. Ось Y вниз, как на фото.
// Труба рисуется толщиной своего профиля, поэтому рама выглядит как рама.
(function (MD) {
  const fmt = v => v.toLocaleString('ru-RU', { maximumFractionDigits: 0 });

  function custom(r) {
    if (!r.scale) {
      return '<svg viewBox="0 0 400 120" width="100%" role="img" aria-label="Эскиза пока нет"><text x="200" y="65" text-anchor="middle" font-family="system-ui, sans-serif" font-size="16" fill="#4b5a70">Поставьте линии и впишите длину одной из них</text></svg>';
    }
    const s = r.scale, pts = r.lines.flatMap(l => [l.a, l.b]).map(p => ({ x: p.x * s, y: p.y * s }));
    const x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x));
    const y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
    const size = Math.max(x1 - x0, y1 - y0, 300);
    const fs = size * 0.04;
    const k = MD.sketchKit(fs, 'cu-arr');
    const tubeW = parseFloat(r.profile.name);
    const out = [];

    r.lines.forEach(l => {
      const a = { x: l.a.x * s, y: l.a.y * s }, b = { x: l.b.x * s, y: l.b.y * s };
      out.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${k.INK}" stroke-width="${Math.max(tubeW, k.stroke)}" stroke-linecap="square" opacity=".85"/>`);
    });
    r.lines.forEach(l => {
      const mx = (l.a.x + l.b.x) / 2 * s, my = (l.a.y + l.b.y) / 2 * s;
      const label = `${l.n}${l.length ? ` · ${fmt(l.length)}` : ''}`;
      out.push(`<text x="${mx}" y="${my - fs * 0.5}" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-size="${fs}" font-weight="700" fill="#c4480c" stroke="#fff" stroke-width="${fs * 0.25}" paint-order="stroke">${label}</text>`);
    });

    // Поля под подписи: подпись стоит по центру линии и выходит за её концы на полдлины текста.
    const padX = fs * 4, padY = fs * 2;
    return k.svg([x0 - padX, y0 - padY, x1 - x0 + 2 * padX, y1 - y0 + 2 * padY], out, `Эскиз каркаса по фото: ${r.lines.length} линий`);
  }

  MD.sketch = Object.assign(MD.sketch || {}, { custom });
})(window.MD = window.MD || {});
