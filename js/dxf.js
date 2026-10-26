// DXF под лазер: листовые детали → один файл DXF R12 (AC1009), единицы мм. Общий для мангала и печи.
// Детали в формате развёрток (js/unfold.js): { name, qty, w, h, loops, circles, bends }, начало в левом нижнем углу.
// Слои: CUT — контуры и отверстия, BEND — линии гиба (не резать), TEXT — подпись под деталью «название x кол-во»,
// её легко выключить. Каждая деталь в файле один раз, в ряд с зазором GAP; количество — в подписи.
// R12 хранит текст в однобайтной кодировке из заголовка: пишем $DWGCODEPAGE = ANSI_1251 и сам файл в windows-1251.
(function (MD) {
  const GAP = 20, TEXT_H = 10;
  const num = v => String(Math.round(v * 1000) / 1000);

  // Строка → байты windows-1251: латиница как есть, А–я подряд с 0xC0, Ё и ё отдельно, остальное — «?».
  function cp1251(str) {
    return Uint8Array.from(str, ch => {
      const c = ch.charCodeAt(0);
      if (c < 0x80) return c;
      if (c >= 0x410 && c <= 0x44f) return c - 0x350;
      return c === 0x401 ? 0xa8 : c === 0x451 ? 0xb8 : 0x3f;
    });
  }

  function text(parts) {
    const e = [];
    const line = (a, b, layer) => e.push('0', 'LINE', '8', layer, '10', num(a[0]), '20', num(a[1]), '30', '0', '11', num(b[0]), '21', num(b[1]), '31', '0');
    let x0 = 0;
    parts.forEach(p => {
      const at = ([x, y]) => [x0 + x, y];
      (p.loops || []).forEach(loop => {
        for (let i = 0; i < loop.length - 1; i++) line(at(loop[i]), at(loop[i + 1]), 'CUT');
      });
      (p.circles || []).forEach(([x, y, r]) => e.push('0', 'CIRCLE', '8', 'CUT', '10', num(x0 + x), '20', num(y), '30', '0', '40', num(r)));
      (p.bends || []).forEach(([a, b]) => line(at(a), at(b), 'BEND'));
      const label = `${p.name} x ${p.qty}`;
      e.push('0', 'TEXT', '8', 'TEXT', '10', num(x0), '20', num(-2 * TEXT_H), '30', '0', '40', num(TEXT_H), '1', label);
      // Следующая деталь — после самой детали или её подписи, что длиннее (буква ≈ 0,9 высоты).
      x0 += Math.max(p.w, label.length * TEXT_H * 0.9) + GAP;
    });
    return ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '9', '$DWGCODEPAGE', '3', 'ANSI_1251', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC',
      '0', 'SECTION', '2', 'ENTITIES', ...e, '0', 'ENDSEC', '0', 'EOF'].join('\r\n') + '\r\n';
  }

  // Скачать как файл, как картинку листа: ссылка со скачиванием нажимается программно.
  function download(dxf, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([cp1251(dxf)], { type: 'application/dxf' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }

  MD.dxf = { text, download, cp1251 };
})(window.MD = window.MD || {});
