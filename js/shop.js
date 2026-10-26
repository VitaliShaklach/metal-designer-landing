// Память цеха: «Цех и телефон» для штампа листа. Хранится только в этом браузере (localStorage), никуда не отправляется.
(function (MD) {
  const KEY = 'md-shop';

  // В приватном режиме браузер может запретить localStorage: тогда просто не запоминаем.
  function get() {
    try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; }
  }
  function set(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* не запомнили, лист всё равно рисуется */ }
  }

  MD.shop = { get, set };
})(window.MD = window.MD || {});
