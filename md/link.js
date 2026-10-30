// Ссылка с размерами: настройки мангала ⇄ часть адреса после #, например #len=1000&wid=500&top=900&t=4&deep=0.
// Так Виталий присылает владельцу «его» мангал. Образец — js/link.js песочницы.

const LINK_KEYS = ['len', 'wid', 'top', 't', 'deep'];

// state → '#len=…&wid=…&top=…&t=…&deep=…', ключи всегда в этом порядке
function linkHash(state) {
  return '#' + LINK_KEYS.map(k => `${k}=${state[k]}`).join('&');
}

// Значение из адреса годится, если оно из списка SIZE[k].options или целое в диапазоне и кратно шагу; иначе undefined
function linkValue(raw, limit) {
  if (raw === undefined) return undefined;
  if (limit.options) return limit.options.find(o => String(o) === raw);
  if (!/^\d+$/.test(raw)) return undefined;
  const v = Number(raw);
  return v >= limit.min && v <= limit.max && (v - limit.min) % limit.step === 0 ? v : undefined;
}

// Пример по умолчанию: все значения — def из SIZE
const linkDefaults = () => Object.fromEntries(LINK_KEYS.map(k => [k, SIZE[k].def]));

// '#len=…&…' → {len, wid, top, t, deep}. Ссылка срабатывает только целиком: нет ключа или хоть одно
// значение неверное (мусор, обрезанная ссылка) — пример по умолчанию, а не «почти ваш» мангал.
// Лишние ключи и порядок не важны
function readLink(hash) {
  const raw = {};
  hash.replace(/^#/, '').split('&').forEach(pair => { const [k, v] = pair.split('='); raw[k] = v; });
  const values = {};
  for (const k of LINK_KEYS) {
    values[k] = linkValue(raw[k], SIZE[k]);
    if (values[k] === undefined) return linkDefaults();
  }
  return values;
}
