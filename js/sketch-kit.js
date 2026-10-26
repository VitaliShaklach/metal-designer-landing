// Общее для эскизов мангала и печи: линии, размеры со стрелками и подписи в SVG. Всё в мм, ось Y вниз.
// Цвета заданы числами, а не CSS-переменными: SVG потом рисуется в PNG через холст, а там var() не работает.
(function (MD) {
  const INK = '#1c2a40', LINE = '#2a3d5e', ACCENT = '#c4480c', PAPER = '#f6f7f3';
  const MONO = 'ui-monospace, Consolas, Menlo, monospace';
  const fmt = v => v.toLocaleString('ru-RU', { maximumFractionDigits: 1 });

  // fs — кегль подписей размеров, от него толщины линий и отступы. id — свой у каждого эскиза: на странице их несколько.
  function kit(fs, id) {
    const stroke = fs * 0.07, thin = stroke * 0.5;
    const ext = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${LINE}" stroke-width="${thin}"/>`;
    const dimLine = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ACCENT}" stroke-width="${thin * 1.6}" marker-start="url(#${id})" marker-end="url(#${id})"/>`;
    const dimText = (x, y, value, vertical) => `<text x="${x}" y="${y}"${vertical ? ` transform="rotate(-90 ${x} ${y})"` : ''} text-anchor="middle" font-family="${MONO}" font-size="${fs}" font-weight="700" fill="${ACCENT}">${fmt(value)}</text>`;

    return {
      INK, LINE, PAPER, stroke, thin,
      rect: (x, y, w, h, { fill = 'none', width = stroke, color = INK } = {}) =>
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${color}" stroke-width="${width}"/>`,
      line: (x1, y1, x2, y2, width = stroke, color = INK) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"/>`,
      circle: (cx, cy, r, { fill = 'none', width = stroke } = {}) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${INK}" stroke-width="${width}"/>`,
      label: (x, y, text, size = fs * 0.8) => `<text x="${x}" y="${y}" text-anchor="middle" font-family="${MONO}" font-size="${size}" fill="${LINE}">${text}</text>`,
      // Земля со штриховкой от x0 до x1.
      ground(x0, x1, y) {
        let hatch = '';
        for (let x = x0; x < x1; x += fs * 1.2) hatch += `M${x + fs} ${y}l${-fs * 0.6} ${fs * 0.6}`;
        return `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${INK}" stroke-width="${stroke}"/><path d="${hatch}" stroke="${LINE}" stroke-width="${thin}" opacity=".5"/>`;
      },
      // Горизонтальный размер от x1 до x2 на высоте y, выносные линии от from.
      hDim: (x1, x2, y, from) => ext(x1, from, x1, y + fs * 0.4) + ext(x2, from, x2, y + fs * 0.4)
        + dimLine(x1, y, x2, y) + dimText((x1 + x2) / 2, y - fs * 0.3, x2 - x1),
      // Вертикальный размер от y1 до y2 на x, выносные линии от from.
      vDim: (y1, y2, x, from) => {
        const side = x < from ? -1 : 1;
        return ext(from, y1, x + side * fs * 0.4, y1) + ext(from, y2, x + side * fs * 0.4, y2)
          + dimLine(x, y1, x, y2) + dimText(x + side * fs * 0.35 + (side > 0 ? fs * 0.6 : 0), (y1 + y2) / 2, y2 - y1, true);
      },
      // Обёртка: viewBox [x, y, w, h] и маркер стрелки.
      svg: (box, body, aria) => `<svg viewBox="${box.map(Math.round).join(' ')}" width="100%" role="img" aria-label="${aria}">
  <defs><marker id="${id}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="${fs * 0.9}" markerHeight="${fs * 0.9}" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,1.8 L10,5 L0,8.2 Z" fill="${ACCENT}"/></marker></defs>
  ${body.join('\n  ')}
</svg>`,
    };
  }

  MD.sketchKit = kit;
})(window.MD = window.MD || {});
