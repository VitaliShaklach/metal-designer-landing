// Рысь на первом экране: только показываем готовое из lynx/ (собирает tools/lynx-capture.js), ничего не считаем.
// При загрузке файл только объявляет функции — его грузит и стенд tests/engine.js

// stats.json → плитки цифр в той же разметке, что панель мангала (drawStats в landing.js)
function lynxStatsHtml(stats) {
  return stats.tiles.map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
}
