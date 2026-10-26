// Обводка каркаса по фото: человек открывает фото, тапами ставит линии труб поверх, одну линию отмечает известной длиной.
// Фото читается браузером (URL.createObjectURL) и никуда не отправляется.
// Управление без режимов: тап — точка (две точки — линия), протяжка — двигать фото, щипок, колёсико и кнопки ± — масштаб.
// Координаты линий — в пикселях фото; масштаб в мм — по эталонной линии.
(function (MD) {
  const SNAP = 16;   // экранных px: точка ближе к концу соседней линии прилипает к нему
  const TAP = 8;     // экранных px: сдвиг пальца меньше — это тап, больше — протяжка
  const fmt = v => v.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // root — блок обводки на странице, onChange вызывается после каждой правки линий или профиля.
  function setup(root, onChange) {
    const q = sel => root.querySelector(sel);
    const svg = q('.trace-svg'), stage = q('.trace-stage');
    let photo = null;          // { url, w, h }
    let view = null;           // видимая часть фото: { x, y, w, h } в px фото
    let lines = [];            // [{ a: {x, y}, b: {x, y}, typed: мм или null }]
    let ref = null;            // номер эталонной линии
    let pending = null;        // первая точка новой линии

    // Длины в мм: вписанная вручную перекрывает масштаб, масштаб — по вписанной длине эталона.
    function measured() {
      const px = lines.map(l => dist(l.a, l.b));
      const scale = ref !== null && lines[ref].typed ? lines[ref].typed / px[ref] : null;
      return {
        scale,
        lines: lines.map((l, i) => ({ ...l, px: px[i], mm: l.typed || (scale ? px[i] * scale : null) })),
      };
    }

    // Размер точки и подписи в px фото, чтобы на экране они были одинаковыми при любом увеличении.
    const screenToPhoto = () => view.w / svg.clientWidth;

    function draw() {
      if (!photo) return;
      svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
      const k = screenToPhoto(), { lines: ms } = measured();
      const out = [`<image href="${photo.url}" width="${photo.w}" height="${photo.h}"/>`];
      ms.forEach((l, i) => {
        const isRef = i === ref;
        out.push(`<line x1="${l.a.x}" y1="${l.a.y}" x2="${l.b.x}" y2="${l.b.y}" stroke="${isRef ? '#2a3d5e' : '#c4480c'}" stroke-width="${4 * k}" stroke-linecap="round"/>`);
        [l.a, l.b].forEach(p => out.push(`<circle cx="${p.x}" cy="${p.y}" r="${5 * k}" fill="#fff" stroke="#1c2a40" stroke-width="${1.5 * k}"/>`));
        const mx = (l.a.x + l.b.x) / 2, my = (l.a.y + l.b.y) / 2;
        const label = `${i + 1}${l.mm ? ' · ' + fmt(l.mm) : ''}`;
        out.push(`<text x="${mx}" y="${my - 8 * k}" text-anchor="middle" font-family="ui-monospace, Consolas, monospace" font-weight="700" font-size="${14 * k}" fill="#1c2a40" stroke="#fff" stroke-width="${3 * k}" paint-order="stroke">${label}</text>`);
      });
      if (pending) out.push(`<circle cx="${pending.x}" cy="${pending.y}" r="${7 * k}" fill="#c4480c" stroke="#fff" stroke-width="${2 * k}"/>`);
      svg.innerHTML = out.join('');
      q('.trace-cancel').hidden = !pending;
    }

    // Подписи списка и подсказка: обновляются без пересоздания полей, чтобы не сбить ввод.
    function refreshList() {
      const { lines: ms, scale } = measured();
      q('.trace-status').textContent = !photo ? 'Сначала откройте фото.'
        : !lines.length ? 'Тапните начало и конец каждой трубы. Протяжка двигает фото, щипок или ± увеличивают.'
        : !scale ? 'Впишите длину одной линии в мм — остальные посчитаются по ней.'
        : `Масштаб по линии ${ref + 1}. Длину любой линии можно вписать вручную — она перекроет масштаб.`;
      q('.trace-lines').querySelectorAll('li').forEach((li, i) => {
        const l = ms[i];
        li.querySelector('.part-name').textContent = `Линия ${i + 1}${i === ref ? ' · эталон' : ''}`;
        li.querySelector('.part-meta').textContent = l.mm ? `${fmt(l.mm)} мм${l.typed && i !== ref ? ' · вписано' : ''}` : '—';
        li.querySelector('.trace-ref').setAttribute('aria-pressed', String(i === ref));
      });
    }

    // Список линий: длина, поле «вписать», эталон, удалить.
    function renderList() {
      q('.trace-lines').innerHTML = lines.map((l, i) => `
        <li data-i="${i}">
          <span class="part-name"></span>
          <span class="part-meta"></span>
          <span class="trace-row">
            <input type="number" inputmode="numeric" min="1" step="1" placeholder="длина, мм" value="${l.typed || ''}" aria-label="Длина линии ${i + 1}, мм">
            <button type="button" class="trace-ref">эталон</button>
            <button type="button" class="trace-del" aria-label="Удалить линию ${i + 1}">✕</button>
          </span>
        </li>`).join('');
      refreshList();
    }

    function changed() {
      draw();
      renderList();
      onChange();
    }

    // Точки экрана → px фото.
    function toPhoto(e) {
      const p = svg.createSVGPoint();
      p.x = e.clientX;
      p.y = e.clientY;
      const r = p.matrixTransform(svg.getScreenCTM().inverse());
      return { x: r.x, y: r.y };
    }

    function tap(e) {
      let p = toPhoto(e);
      const snapTo = lines.flatMap(l => [l.a, l.b]).find(end => dist(end, p) < SNAP * screenToPhoto());
      if (snapTo) p = { ...snapTo };
      if (!pending) {
        pending = p;
        draw();
        return;
      }
      if (dist(pending, p) > 0) lines.push({ a: pending, b: p, typed: null });
      pending = null;
      changed();
    }

    // Масштаб в f раз вокруг точки фото c, не мельче целого фото и не крупнее 20×.
    function zoom(f, c = { x: view.x + view.w / 2, y: view.y + view.h / 2 }) {
      const w = Math.min(Math.max(view.w / f, photo.w / 20), photo.w * 1.5);
      const k = w / view.w;
      view = { x: c.x - (c.x - view.x) * k, y: c.y - (c.y - view.y) * k, w, h: view.h * k };
      draw();
    }

    // Вписать фото в окно целиком, с полями по пропорциям окна.
    function fit() {
      const aspect = stage.clientWidth / stage.clientHeight;
      const w = Math.max(photo.w, photo.h * aspect), h = w / aspect;
      view = { x: (photo.w - w) / 2, y: (photo.h - h) / 2, w, h };
      draw();
    }

    // Пальцы и мышь: один указатель — тап или протяжка, два — щипок.
    const pointers = new Map();
    let gesture = null;
    svg.addEventListener('pointerdown', e => {
      if (!photo) return;
      svg.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const ps = [...pointers.values()];
      gesture = ps.length === 1
        ? { start: ps[0], view: { ...view }, k: screenToPhoto(), moved: false }
        : { pinch: dist(ps[0], ps[1]), view: { ...view }, moved: true };
    });
    svg.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId) || !gesture) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const ps = [...pointers.values()];
      if (ps.length === 1 && !gesture.pinch) {
        const dx = ps[0].x - gesture.start.x, dy = ps[0].y - gesture.start.y;
        if (Math.hypot(dx, dy) > TAP) gesture.moved = true;
        if (gesture.moved) {
          view = { ...gesture.view, x: gesture.view.x - dx * gesture.k, y: gesture.view.y - dy * gesture.k };
          draw();
        }
      } else if (ps.length === 2 && gesture.pinch) {
        const mid = toPhoto({ clientX: (ps[0].x + ps[1].x) / 2, clientY: (ps[0].y + ps[1].y) / 2 });
        const f = dist(ps[0], ps[1]) / gesture.pinch;
        gesture.pinch = dist(ps[0], ps[1]);
        zoom(f, mid);
      }
    });
    const up = e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (gesture && !gesture.moved && !pointers.size && e.type === 'pointerup') tap(e);
      if (!pointers.size) gesture = null;
    };
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('wheel', e => {
      if (!photo) return;
      e.preventDefault();
      zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, toPhoto(e));
    }, { passive: false });

    q('.trace-in').addEventListener('click', () => photo && zoom(1.5));
    q('.trace-out').addEventListener('click', () => photo && zoom(1 / 1.5));
    q('.trace-fit').addEventListener('click', () => photo && fit());
    q('.trace-cancel').addEventListener('click', () => { pending = null; draw(); });

    // Новое фото — новое изделие: линии сбрасываются. Старое фото освобождаем из памяти.
    q('.trace-file').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        if (photo) URL.revokeObjectURL(photo.url);
        photo = { url, w: img.naturalWidth, h: img.naturalHeight };
        lines = [];
        ref = null;
        pending = null;
        root.classList.add('has-photo');
        fit();
        changed();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        q('.trace-status').textContent = 'Этот файл браузер не открыл как картинку. Попробуйте JPG или PNG.';
      };
      img.src = url;
    });

    // Поле длины: у эталона задаёт масштаб, у остальных перекрывает его. Без эталона первая вписанная длина им становится.
    q('.trace-lines').addEventListener('input', e => {
      const i = Number(e.target.closest('li').dataset.i);
      const v = Number(e.target.value);
      lines[i].typed = v > 0 ? v : null;
      if (ref === null && lines[i].typed) ref = i;
      draw();
      refreshList();
      onChange();
    });
    q('.trace-lines').addEventListener('click', e => {
      const li = e.target.closest('li');
      if (!li) return;
      const i = Number(li.dataset.i);
      if (e.target.closest('.trace-ref')) {
        ref = i;
        changed();
      }
      if (e.target.closest('.trace-del')) {
        lines.splice(i, 1);
        ref = ref === i ? null : ref !== null && ref > i ? ref - 1 : ref;
        changed();
      }
    });

    // Окно поменяло размер (поворот телефона) — подписи и точки пересчитываются под новый экран.
    window.addEventListener('resize', () => photo && draw());
    renderList();

    return { measured };
  }

  MD.trace = { setup };
})(window.MD = window.MD || {});
