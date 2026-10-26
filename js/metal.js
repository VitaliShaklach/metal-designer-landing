// Справочник металла.
// Масса 1 м профильной трубы — по формуле ГОСТ 8639-82 (квадратная) и ГОСТ 8645-68 (прямоугольная):
//   m = 0,0157 · t · (A + B − 2,86 · t), кг/м, где A, B — стороны, t — стенка, всё в мм.
// Масса 1 м круглой трубы — по ГОСТ 10704-91: m = 0,02466 · t · (D − t), кг/м.
// Масса 1 м² листа — по ГОСТ 19903-2015 при плотности стали 7850 кг/м³: 7,85 кг на каждый мм толщины.
(function (MD) {
  function tube(a, b, t) {
    const kgPerM = Math.round(0.0157 * t * (a + b - 2.86 * t) * 100) / 100;
    return { name: `${a}×${b}×${t}`, kgPerM };
  }

  function pipe(d, t) {
    const kgPerM = Math.round(0.02466 * t * (d - t) * 100) / 100;
    return { name: `Ø${d}×${t}`, kgPerM };
  }

  const sheetKgPerM2 = t => 7.85 * t;

  MD.metal = { tube, pipe, sheetKgPerM2 };
})(window.MD = window.MD || {});
