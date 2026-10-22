// Справочник металла.
// Масса 1 м профильной трубы — по формуле ГОСТ 8639-82 (квадратная) и ГОСТ 8645-68 (прямоугольная):
//   m = 0,0157 · t · (A + B − 2,86 · t), кг/м, где A, B — стороны, t — стенка, всё в мм.
(function (MD) {
  function tube(a, b, t) {
    const kgPerM = Math.round(0.0157 * t * (a + b - 2.86 * t) * 100) / 100;
    return { name: `${a}×${b}×${t}`, kgPerM };
  }

  MD.metal = { tube };
})(window.MD = window.MD || {});
