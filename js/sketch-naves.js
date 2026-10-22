// Эскиз навеса: вид спереди с размерами, SVG в миллиметрах. Геометрию берёт из расчёта, сам ничего не считает.
// Подписи и толщины линий растут вместе с шириной, чтобы на телефоне читались одинаково.
(function (MD) {
  // Цвета заданы числами, а не CSS-переменными: SVG потом рисуется в PNG через холст, а там var() не работает.
  const INK = '#1c2a40', LINE = '#2a3d5e', ACCENT = '#c4480c', PAPER = '#f6f7f3';
  const MONO = 'ui-monospace, Consolas, Menlo, monospace';
  const BOARD = 130;   // ширина доски обшивки на эскизе

  function naves(r) {
    const { width, height, frontPost, backPost, sections, axes, postLeft, door, bars } = r;
    const { post, rail, door: { gap } } = MD.naves.FIXED;
    const fontSize = Math.max(150, width * 0.05);
    const stroke = fontSize * 0.07, thin = stroke * 0.5;
    const ground = height;                       // ось Y вниз, верх балки — 0
    const xWood = sections.shed, xOpen = sections.shed + sections.wood;
    const out = [];

    // Земля со штриховкой
    out.push(`<line x1="${-fontSize * 2}" y1="${ground}" x2="${width + fontSize * 2}" y2="${ground}" stroke="${INK}" stroke-width="${stroke}"/>`);
    let hatch = '';
    for (let x = -fontSize * 2; x < width + fontSize * 2; x += fontSize * 1.2) hatch += `M${x + fontSize} ${ground}l${-fontSize * 0.6} ${fontSize * 0.6}`;
    out.push(`<path d="${hatch}" stroke="${LINE}" stroke-width="${thin}" opacity=".5"/>`);

    // Дровница: прутки у задней стенки, видны в глубине
    bars.forEach(x => out.push(`<line x1="${x}" y1="${ground - rail}" x2="${x}" y2="${ground - backPost}" stroke="${LINE}" stroke-width="${thin}" opacity=".7"/>`));
    out.push(`<line x1="${postLeft[1] + post}" y1="${ground - rail / 2}" x2="${postLeft[2]}" y2="${ground - rail / 2}" stroke="${LINE}" stroke-width="${stroke}" opacity=".7"/>`);

    // Хозблок: обшивка доской, коробка, перемычка и дверь. Дверь стоит на обвязке, коробка — от обвязки до перемычки.
    const shX0 = postLeft[0] + post, shX1 = postLeft[1];
    const doorBottom = ground - rail - gap, doorTop = doorBottom - door.height;
    const lintelTop = doorTop - gap - rail;
    const jambX0 = door.jambs[0], jambX1 = door.jambs[1] + rail;
    let boards = '';
    for (let y = ground - BOARD; y > post; y -= BOARD) {
      boards += y > lintelTop ? `M${shX0} ${y}H${jambX0}M${jambX1} ${y}H${shX1}` : `M${shX0} ${y}H${shX1}`;
    }
    out.push(`<path d="${boards}" stroke="${LINE}" stroke-width="${thin}" opacity=".6"/>`);
    out.push(`<rect x="${shX0}" y="${ground - rail}" width="${shX1 - shX0}" height="${rail}" fill="none" stroke="${INK}" stroke-width="${thin}"/>`);
    door.jambs.forEach(x => out.push(`<rect x="${x}" y="${lintelTop + rail}" width="${rail}" height="${doorBottom + gap - lintelTop - rail}" fill="none" stroke="${INK}" stroke-width="${thin}"/>`));
    out.push(`<rect x="${shX0}" y="${lintelTop}" width="${shX1 - shX0}" height="${rail}" fill="none" stroke="${INK}" stroke-width="${thin}"/>`);
    out.push(`<rect x="${door.x0}" y="${doorTop}" width="${door.width}" height="${door.height}" fill="${PAPER}" stroke="${INK}" stroke-width="${stroke}"/>`);
    const handleX = door.x0 + door.width - 90, handleY = doorTop + door.height / 2;
    out.push(`<line x1="${handleX}" y1="${handleY - 60}" x2="${handleX}" y2="${handleY + 60}" stroke="${INK}" stroke-width="${stroke * 1.4}"/>`);

    // Стойки, передняя балка, кромка кровли
    postLeft.forEach(x => out.push(`<rect x="${x}" y="${post}" width="${post}" height="${frontPost}" fill="none" stroke="${INK}" stroke-width="${stroke}"/>`));
    out.push(`<rect x="0" y="0" width="${width}" height="${post}" fill="none" stroke="${INK}" stroke-width="${stroke}"/>`);
    out.push(`<line x1="-100" y1="${-stroke * 2}" x2="${width + 100}" y2="${-stroke * 2}" stroke="${LINE}" stroke-width="${stroke * 2.5}"/>`);

    // Подписи секций: моноширинная буква ≈ 0,6 кегля, подпись не шире своей секции
    const label = (x, span, text) => {
      const size = Math.min(fontSize * 0.8, (span - 2 * post) / (text.length * 0.62));
      return `<text x="${x}" y="${post + fontSize * 1.6}" text-anchor="middle" font-family="${MONO}" font-size="${size}" fill="${LINE}">${text}</text>`;
    };
    out.push(label(xWood / 2, sections.shed, 'хозблок'));
    out.push(label(xWood + sections.wood / 2, sections.wood, 'дровница'));
    out.push(label(xOpen + sections.open / 2, sections.open, 'под мангал'));

    // Размеры
    const dimLine = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ACCENT}" stroke-width="${thin * 1.6}" marker-start="url(#nv-arr)" marker-end="url(#nv-arr)"/>`;
    const extLine = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${LINE}" stroke-width="${thin}"/>`;
    const dimText = (x, y, text, vertical) => `<text x="${x}" y="${y}"${vertical ? ` transform="rotate(-90 ${x} ${y})"` : ''} text-anchor="middle" font-family="${MONO}" font-size="${fontSize}" font-weight="700" fill="${ACCENT}">${text}</text>`;

    // Цепочка секций и общая ширина
    const chain = [0, xWood, xOpen, width];
    const yChain = ground + fontSize * 1.9, yTotal = ground + fontSize * 3.5;
    chain.forEach(x => out.push(extLine(x, ground + fontSize * 0.6, x, (x === 0 || x === width) ? yTotal + fontSize * 0.4 : yChain + fontSize * 0.4)));
    for (let i = 0; i < chain.length - 1; i++) {
      out.push(dimLine(chain[i], yChain, chain[i + 1], yChain));
      out.push(dimText((chain[i] + chain[i + 1]) / 2, yChain - fontSize * 0.3, chain[i + 1] - chain[i]));
    }
    out.push(dimLine(0, yTotal, width, yTotal));
    out.push(dimText(width / 2, yTotal - fontSize * 0.3, width));

    // Высота по переднему краю, до верха балки
    const xHeight = -fontSize * 2.2;
    out.push(extLine(-fontSize * 0.4, 0, xHeight - fontSize * 0.4, 0));
    out.push(extLine(xHeight - fontSize * 0.4, ground, -fontSize * 0.4, ground));
    out.push(dimLine(xHeight, 0, xHeight, ground));
    out.push(dimText(xHeight - fontSize * 0.35, ground / 2, height, true));

    const viewBox = [-fontSize * 3.4, -fontSize * 1.2, width + fontSize * 4.6, height + fontSize * 5.1].map(Math.round).join(' ');
    return `<svg viewBox="${viewBox}" width="100%" role="img" aria-label="Эскиз навеса: ширина ${width} мм, высота ${height} мм">
  <defs><marker id="nv-arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="${fontSize * 0.9}" markerHeight="${fontSize * 0.9}" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,1.8 L10,5 L0,8.2 Z" fill="${ACCENT}"/></marker></defs>
  ${out.join('\n  ')}
</svg>`;
  }

  MD.sketch = Object.assign(MD.sketch || {}, { naves });
})(window.MD = window.MD || {});
