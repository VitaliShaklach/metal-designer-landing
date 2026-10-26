// «Ваше изделие»: линии, обведённые по фото (js/trace.js), → трубы с длинами реза и масса. Профиль один на всё изделие.
// Одинаковые длины идут одной строкой. Все размеры в мм.
(function (MD) {
  const { tube } = MD.metal;
  const PROFILES = [tube(20, 20, 1.5), tube(40, 20, 1.5), tube(40, 40, 2), tube(60, 40, 2), tube(60, 60, 2), tube(80, 80, 3)];
  const names = PROFILES.map(p => p.name);

  const LIMITS = {
    profile: { options: names, labels: names, def: '40×40×2' },
  };

  // trace — обводка на странице: measured() → { scale, lines: [{ a, b, px, mm, typed }] }.
  function calc({ profile }, trace) {
    const P = PROFILES.find(p => p.name === profile);
    const { scale, lines } = trace.measured();
    const numbered = lines.map((l, i) => ({ ...l, n: i + 1, length: l.mm ? Math.round(l.mm) : null }));

    const byLength = new Map();
    numbered.filter(l => l.length).forEach(l => byLength.set(l.length, [...(byLength.get(l.length) || []), l.n]));
    const parts = MD.parts.finishBars([...byLength].sort((a, b) => b[0] - a[0]).map(([length, ns]) => ({
      name: `Труба — ${ns.length > 1 ? 'линии' : 'линия'} ${ns.join(', ')}`, profile: P, length, qty: ns.length,
    })));

    return {
      title: `Каркас по фото, ${P.name}`,
      note: 'Длины сняты с фото — перед резкой проверьте рулеткой. Масса трубы по ГОСТ 8639-82 и 8645-68.',
      profile: P, scale, lines: numbered,
      missing: numbered.filter(l => !l.length).map(l => l.n),
      parts,
      mass: parts.reduce((sum, p) => sum + p.mass, 0),
    };
  }

  MD.custom = { calc, LIMITS, FIXED: {} };
})(window.MD = window.MD || {});
