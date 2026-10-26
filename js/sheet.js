// Лист чертежа: эскиз, спецификация, масса и штамп на листе A4 альбомом. SVG в миллиметрах.
// Собирается из общего описания изделия, поэтому подходит навесу, мангалу, печи и «Вашему изделию»:
//   { title, parts: [{ name, size, qty, mass }], mass, note, sketch: '<svg…>', caption, shop, date }.
// Из одного и того же SVG делаются картинка PNG (через холст браузера) и PDF (через печать браузера).
(function (MD) {
  // Цвета числами, а не CSS-переменными: SVG рисуется как картинка, там var() не работает.
  const INK = '#1c2a40', LINE = '#2a3d5e', MUTED = '#4b5a70';
  const SANS = 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
  const MONO = 'ui-monospace, Consolas, Menlo, monospace';
  const W = 297, H = 210;                                // A4 альбомом
  const PX = 8;                                          // точек на мм: 2376 × 1680, около 200 точек на дюйм
  const FRAME = { x0: 20, y0: 5, x1: 292, y1: 205 };     // рамка по ГОСТ 2.301: слева 20 мм под подшивку, остальные 5
  const STAMP = { x0: 107, y0: 165 };                    // штамп 185 × 40 в правом нижнем углу
  const SPEC_X = 187;                                    // спецификация справа от эскиза, до рамки
  const THICK = 0.6, THIN = 0.25;

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fmt = (v, d = 0) => v.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
  const line = (x1, y1, x2, y2, w = THIN) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${LINE}" stroke-width="${w}"/>`;

  // Ширину текста в SVG без страницы не измерить, поэтому оценка: буква ≈ 0,56 кегля, моноширинная 0,6.
  // Текст длиннее max сжимается до max, короткий не трогается.
  const textWidth = (str, size, mono) => String(str).length * size * (mono ? 0.6 : 0.56);
  function text(x, y, str, { size = 2.5, max, mono, bold, anchor = 'start', fill = INK } = {}) {
    const squeeze = max && textWidth(str, size, mono) > max ? ` textLength="${max}" lengthAdjust="spacingAndGlyphs"` : '';
    return `<text x="${x}" y="${y}" font-family="${mono ? MONO : SANS}" font-size="${size}"${bold ? ' font-weight="700"' : ''}`
      + ` text-anchor="${anchor}" fill="${fill}"${squeeze}>${esc(str)}</text>`;
  }
  const label = (x, y, str) => text(x, y, str, { size: 2.1, fill: MUTED });

  // Разбивка по словам на строки не шире max; что не влезло в последнюю строку, сожмётся при выводе.
  function wrap(str, size, max, maxLines) {
    const out = [];
    for (const word of str.split(/\s+/).filter(Boolean)) {
      const last = out.length - 1;
      if (last >= 0 && (out.length === maxLines || textWidth(out[last] + ' ' + word, size) <= max)) out[last] += ' ' + word;
      else out.push(word);
    }
    return out;
  }

  // Спецификация: № · наименование · размер · кол. · масса, внизу масса металла и пометка.
  function spec(parts, mass, note) {
    const x0 = SPEC_X, x1 = FRAME.x1, bottom = STAMP.y0;
    const cols = [
      { w: 7, title: '№', anchor: 'middle', value: (p, i) => i + 1 },
      { w: 49, title: 'Наименование', value: p => p.name },
      { w: 27, title: 'Размер, мм', mono: true, value: p => p.size },
      { w: 9, title: 'Кол.', mono: true, anchor: 'middle', value: p => p.qty },
      { w: 13, title: 'Масса, кг', mono: true, anchor: 'end', value: p => fmt(p.mass, 1) },
    ];
    const head = FRAME.y0 + 8, rowsTop = head + 7, rowsMax = bottom - 16;
    const rowH = Math.min(6.5, (rowsMax - rowsTop) / Math.max(parts.length, 1));
    const size = Math.min(2.5, rowH * 0.45);
    const rowsEnd = rowsTop + rowH * parts.length;
    const out = [text(x0 + 2, FRAME.y0 + 6, 'Спецификация', { size: 3.4, bold: true })];

    out.push(line(x0, head, x1, head, THICK), line(x0, rowsTop, x1, rowsTop, THICK));
    let x = x0;
    cols.forEach(c => {
      const at = c.anchor === 'middle' ? x + c.w / 2 : c.anchor === 'end' ? x + c.w - 1.5 : x + 1.5;
      out.push(text(at, head + 4.6, c.title, { size: 2.1, fill: MUTED, anchor: c.anchor, max: c.w - 2 }));
      parts.forEach((p, i) => {
        const y = rowsTop + rowH * i + rowH / 2 + size * 0.36;
        out.push(text(at, y, c.value(p, i), { size, mono: c.mono, anchor: c.anchor, max: c.w - 3 }));
      });
      if (x > x0) out.push(line(x, head, x, rowsEnd));
      x += c.w;
    });
    parts.forEach((_, i) => out.push(line(x0, rowsTop + rowH * (i + 1), x1, rowsTop + rowH * (i + 1))));

    out.push(text(x0 + 2, rowsEnd + 7, `Масса металла: ${fmt(mass, 1)} кг`, { size: 3.4, bold: true, max: x1 - x0 - 4 }));
    if (note) out.push(text(x0 + 2, rowsEnd + 11.5, note, { size: 2.1, fill: MUTED, max: x1 - x0 - 4 }));
    return out;
  }

  // Штамп 185 × 40: изделие, дата, масштаб | масса, лист | цех и телефон.
  function stamp({ title, mass, shop, date }) {
    const { x0, y0 } = STAMP, x1 = FRAME.x1, y1 = FRAME.y1;
    const mid = x0 + 100, row = y0 + 22;           // границы левой и правой части, верхнего и нижнего ряда
    const scale = x0 + 50, sheets = mid + 45;        // ячейки «Масштаб» и «Лист»
    const out = [
      `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="#fff" stroke="${LINE}" stroke-width="${THICK}"/>`,
      line(mid, y0, mid, y1, THICK), line(x0, row, x1, row, THICK),
      line(scale, row, scale, y1), line(sheets, y0, sheets, row),
      label(x0 + 2, y0 + 4, 'Изделие'),
      text(x0 + 2, y0 + 15, title, { size: 6, bold: true, max: mid - x0 - 4 }),
      label(x0 + 2, row + 4, 'Дата'),
      text(x0 + 2, row + 12.5, date, { size: 3.6, mono: true }),
      label(scale + 2, row + 4, 'Масштаб'),
      text(scale + 2, row + 12.5, 'б/м', { size: 3.6, mono: true }),
      label(mid + 2, y0 + 4, 'Масса'),
      text(mid + 2, y0 + 14.5, `${fmt(mass, 1)} кг`, { size: 4.2, bold: true, mono: true, max: sheets - mid - 4 }),
      label(sheets + 2, y0 + 4, 'Лист / листов'),
      text(sheets + 2, y0 + 14.5, '1 / 1', { size: 4.2, mono: true }),
      label(mid + 2, row + 4, 'Цех и телефон'),
    ];
    const max = x1 - mid - 4;
    const lines = wrap(shop || '', 3.2, max, 2);
    if (lines.length === 1) out.push(text(mid + 2, row + 12.5, lines[0], { size: 3.6, bold: true, max }));
    if (lines.length === 2) out.push(
      text(mid + 2, row + 9.5, lines[0], { size: 3.2, bold: true, max }),
      text(mid + 2, row + 14.5, lines[1], { size: 3.2, bold: true, max }),
    );
    return out;
  }

  function svg(product) {
    const { parts, mass, note, sketch, caption } = product;
    // Эскиз вкладывается целиком: его ширина 100 % и viewBox вписывают его в отведённую рамку с сохранением пропорций.
    const box = { x: FRAME.x0 + 5, y: FRAME.y0 + 10, w: SPEC_X - FRAME.x0 - 10, h: STAMP.y0 - FRAME.y0 - 15 };
    const out = [
      `<rect width="${W}" height="${H}" fill="#fff"/>`,
      `<rect x="${FRAME.x0}" y="${FRAME.y0}" width="${FRAME.x1 - FRAME.x0}" height="${FRAME.y1 - FRAME.y0}" fill="none" stroke="${LINE}" stroke-width="${THICK}"/>`,
      line(SPEC_X, FRAME.y0, SPEC_X, STAMP.y0, THICK),
      text(FRAME.x0 + 4, FRAME.y0 + 6, caption ? `${caption}. Размеры в мм.` : 'Размеры в мм.', { size: 2.6, fill: MUTED, max: box.w }),
      `<svg x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}">${sketch}</svg>`,
      ...spec(parts, mass, note),
      ...stamp(product),
      text(FRAME.x0 + 4, FRAME.y1 - 3, 'Эскиз собран в Metal Designer', { size: 2.1, fill: MUTED }),
    ];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * PX}" height="${H * PX}">\n${out.join('\n')}\n</svg>`;
  }

  // Адрес картинки для <img>: и для просмотра на странице, и для печати.
  const url = sheet => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sheet);

  // PNG рисует холст браузера: SVG как картинка → canvas → файл. Ссылка со скачиванием нажимается программно.
  function png(sheet, name) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Размер холста равен собственному размеру SVG: Safari рисует SVG в собственном размере и потом растягивает.
        canvas.width = W * PX;
        canvas.height = H * PX;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (!blob) return reject(new Error('Браузер не смог сохранить картинку'));
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          // Не сразу: на айфоне картинка может открыться вкладкой по этой ссылке.
          setTimeout(() => URL.revokeObjectURL(a.href), 60000);
          resolve();
        }, 'image/png');
      };
      img.onerror = () => reject(new Error('Браузер не смог нарисовать лист'));
      img.src = url(sheet);
    });
  }

  // Имя файла из названия изделия: «Навес 3000 × 2000» → «Навес-3000x2000», запятые выбрасываются.
  const fileName = title => title.replace(/\s*×\s*/g, 'x').replace(/[\\/:*?"<>|,]/g, '').trim().replace(/\s+/g, '-');

  MD.sheet = { svg, url, png, fileName };
})(window.MD = window.MD || {});
