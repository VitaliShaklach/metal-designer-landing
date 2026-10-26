// Раскрой хлыстов: трубы с длинами реза → сколько хлыстов по 6 м купить, что из какого резать, сколько в обрезки.
// Общий для навеса и «Вашего изделия». Трубы разного профиля раскраиваются отдельно.
// Простая укладка по убыванию длин: самый длинный кусок идёт в первый хлыст, где ему хватает места, иначе берётся новый хлыст.
(function (MD) {
  const STOCK = 6000;   // длина хлыста
  // Ширина реза: отрезной диск 230 × 1,6–2 мм, полотно ленточной пилы 0,9 мм с разводом ≈ 1,2–1,5 мм.
  // Рез уходит в обрезки, длины кусков не меняет.
  const KERF = 2;

  // Перед новым куском нужен рез после каждого уже уложенного. Рез после последнего куска не нужен,
  // если тот доходит ровно до конца хлыста.
  const fits = (bar, length) => bar.used + bar.cuts.length * KERF + length <= STOCK;

  // parts: [{ profile: { name }, length, qty }]
  //   → [{ profileName, bars: [{ cuts, used, waste }], count, totalLength, waste, tooLong }]
  function plan(parts) {
    const groups = new Map();
    parts.forEach(p => {
      if (!groups.has(p.profile.name)) groups.set(p.profile.name, []);
      for (let i = 0; i < p.qty; i++) groups.get(p.profile.name).push(p.length);
    });

    return [...groups].map(([profileName, lengths]) => {
      const bars = [];
      lengths.filter(length => length <= STOCK).sort((a, b) => b - a).forEach(length => {
        let bar = bars.find(b => fits(b, length));
        if (!bar) bars.push(bar = { cuts: [], used: 0 });
        bar.cuts.push(length);
        bar.used += length;
      });
      // Обрезок — кусок, который остаётся после всех резов. Остаток короче реза целиком уходит в опилки.
      bars.forEach(bar => { bar.waste = Math.max(0, STOCK - bar.used - bar.cuts.length * KERF); });
      return {
        profileName,
        bars,
        count: bars.length,
        totalLength: lengths.reduce((sum, l) => sum + l, 0),
        waste: bars.reduce((sum, bar) => sum + bar.waste, 0),
        tooLong: lengths.filter(length => length > STOCK),   // такие куски варят из двух, в раскрой они не попадают
      };
    });
  }

  MD.cutting = { plan, STOCK, KERF };
})(window.MD = window.MD || {});
