// Ссылка на вариант: вкладка и параметры ⇄ часть адреса после #, например demo.html#naves&width=3000&height=2000.
// Часть после # браузер не отправляет на сервер, поэтому «видите только вы» остаётся правдой.
// Формат общий для всех вкладок: каждая отдаёт свои LIMITS — { ключ: { min, max, step, def } или { options, def } }.
// Только вкладка (#mangal) открывает её с готовым примером: так на вкладки ведут карточки лендинга.
(function (MD) {
  // Значение из адреса годится, если оно из списка вариантов или целое число в диапазоне и кратно шагу.
  // Иначе undefined.
  function parse(raw, limit) {
    if (raw === undefined) return undefined;
    if (limit.options) return limit.options.find(o => String(o) === raw);
    if (!/^\d+$/.test(raw)) return undefined;
    const v = Number(raw);
    return v >= limit.min && v <= limit.max && (v - limit.min) % limit.step === 0 ? v : undefined;
  }

  // hash, tabs: { имя вкладки: LIMITS } → { tab, values }.
  // tab — null, если такой вкладки нет. values — все параметры вкладки, только если ссылка целая и верная;
  // любой мусор, обрезанная ссылка или лишний ключ → null, вкладка откроется с готовым примером.
  function read(hash, tabs) {
    const [tab, ...pairs] = hash.replace(/^#/, '').split('&');
    if (!Object.prototype.hasOwnProperty.call(tabs, tab)) return { tab: null, values: null };
    const limits = tabs[tab], keys = Object.keys(limits);
    if (!keys.length || pairs.length !== keys.length) return { tab, values: null };

    const raw = {};
    pairs.forEach(pair => { const [k, v] = pair.split('='); raw[k] = v; });
    const values = {};
    for (const k of keys) {
      values[k] = parse(raw[k], limits[k]);
      if (values[k] === undefined) return { tab, values: null };
    }
    return { tab, values };
  }

  // Полный адрес страницы с вкладкой и параметрами. Без values — только вкладка.
  function make(tab, values, limits) {
    const pairs = values ? Object.keys(limits).map(k => `${k}=${values[k]}`) : [];
    return location.href.split('#')[0] + '#' + [tab, ...pairs].join('&');
  }

  // Готовый пример вкладки: значения по умолчанию из LIMITS.
  const defaults = limits => Object.fromEntries(Object.entries(limits).map(([k, l]) => [k, l.def]));

  MD.link = { read, make, defaults };
})(window.MD = window.MD || {});
