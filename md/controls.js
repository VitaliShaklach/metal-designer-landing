// Управление как в C:\dev (перенос из mangal/js/ui.js): пробел + тянуть — сдвиг, клик по детали — только она,
// двойной клик по пустому — снова вся модель, имя детали у курсора, подсказка «? Управление».
// Вращение, колесо, правая кнопка и пальцы на телефоне — сам OrbitControls из model.js.
// Загружается после landing.js: renderAll, viewFor, flyTo — оттуда.

// Пробел + тянуть мышью — двигать модель (как в Figma). Только когда курсор над моделью: иначе пробел листает страницу
let spacePan = null, spaceHeld = false, overStage = false;
stage.addEventListener('pointerenter', () => { overStage = true; });
stage.addEventListener('pointerleave', () => { if (!spacePan) overStage = false; });
addEventListener('keydown', e => {
  if (e.code !== 'Space' || !overStage || !ok) return;
  e.preventDefault();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // пробел не жмёт кнопку в фокусе
  if (!spaceHeld) { spaceHeld = true; controls.enabled = false; stage.style.cursor = 'grab'; }
}, {capture: true});
function spaceUp() { spaceHeld = false; spacePan = null; controls.enabled = true; stage.style.cursor = ''; }
addEventListener('keyup', e => {
  if (e.code !== 'Space' || !spaceHeld) return;
  e.preventDefault();
  spaceUp();
}, {capture: true});
addEventListener('blur', () => { if (spaceHeld) spaceUp(); });   // Alt+Tab с зажатым пробелом: keyup не придёт
stage.addEventListener('pointerdown', e => {
  if (!spaceHeld) return;
  e.preventDefault();
  spacePan = {x: e.clientX, y: e.clientY};
  stage.style.cursor = 'grabbing';
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', e => {
  if (!spacePan) return;
  const dx = e.clientX - spacePan.x, dy = e.clientY - spacePan.y;
  spacePan = {x: e.clientX, y: e.clientY};
  // пиксель экрана → сантиметры сцены на расстоянии цели: модель едет ровно за курсором
  const d = camera.position.distanceTo(controls.target), k = 2 * d * Math.tan(camera.fov * Math.PI / 360) / renderer.domElement.clientHeight;
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
  const off = right.multiplyScalar(-dx * k).add(up.multiplyScalar(dy * k));
  camera.position.add(off);
  controls.target.add(off);
});
stage.addEventListener('pointerup', () => { if (spacePan) { spacePan = null; stage.style.cursor = spaceHeld ? 'grab' : ''; } });

// Теги 3D, у которых в списке деталей другая деталь (как в C:\dev)
const PART_OF = {cgrAngB: 'cgrAng', cgrAngF: 'cgrAng', rings: 'plate', coal: null};

// Деталь под курсором или пальцем: {el, part, name} или null.
// Raycaster не смотрит на visible — скрытое (крыша, невыбранные детали) отбрасываем сами
function partAt(ev) {
  if (!ok || !group) return null;
  const r = renderer.domElement.getBoundingClientRect();
  const m = new THREE.Vector2((ev.clientX - r.left) / r.width * 2 - 1, -(ev.clientY - r.top) / r.height * 2 + 1);
  const rc = new THREE.Raycaster();
  rc.setFromCamera(m, camera);
  const vis = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  for (const h of rc.intersectObjects(group.children, true)) {
    if (!vis(h.object)) continue;
    let o = h.object;
    while (o.parent && o.parent !== group) o = o.parent;
    if (o.userData.dim) continue;
    let p = o.userData.part;
    if (p in PART_OF) p = PART_OF[p];
    if (!p) continue;
    const e = PARTS.find(e => e.d.some(d => d[0] === p && partOk(p)));
    if (e) return {el: e.id, part: p, name: partName(p)};
    const e2 = PARTS.find(e => e.id === PDF_PART[p]);   // деталь без строки в списке (решётки) — выбираем элемент
    if (e2 && elOk(e2.id)) return {el: e2.id, part: null, name: e2.name};
  }
  return null;
}

// Выбор: p — деталь из partAt или null (вся модель). На 3D остаётся только она, камера летит к ней
const selBar = document.getElementById('selBar');
function applySel(p) {
  S.sel = p ? {el: p.el, part: p.part} : {el: null, part: null};
  selBar.hidden = !p;
  if (p) document.getElementById('selName').textContent = p.name;
  renderAll();
  fitSel();
}

// Камера на выбранное (или на всю модель) — плавно
function fitSel() {
  if (!ok) return;
  const v = viewFor();
  flyTo(v.pos, v.target);
}

selBar.querySelector('button').addEventListener('click', () => applySel(null));

// Клик — выбрать деталь (не после вращения: сдвиг до 5 px и не дольше 0,5 с), двойной клик по пустому — вся модель,
// наведение — имя детали у курсора. Касание на телефоне — тот же pointerup
if (ok) {
  const cv = renderer.domElement, tag = document.getElementById('hovTag');
  let down = null, last = 0, picked = {x: 0, y: 0, t: -1e9};
  cv.addEventListener('pointerdown', e => { down = {x: e.clientX, y: e.clientY, t: performance.now()}; tag.hidden = true; });
  cv.addEventListener('pointerup', e => {
    if (!down || spaceHeld || e.button !== 0) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
    down = null;
    if (moved > 5 || dt > 500) return;
    const p = partAt(e);
    if (!p || (S.sel.el === p.el && S.sel.part === p.part)) return;
    picked = {x: e.clientX, y: e.clientY, t: performance.now()};
    applySel(p);
  });
  // двойной клик по детали: первый клик её выбрал, камера улетела — под курсором может оказаться пусто; это не сброс
  const samePick = e => performance.now() - picked.t < 600 && Math.hypot(e.clientX - picked.x, e.clientY - picked.y) < 10;
  cv.addEventListener('dblclick', e => {
    if (samePick(e) || partAt(e) || !S.sel.el) return;
    applySel(null);
  });
  cv.addEventListener('pointermove', e => {
    if (e.buttons || spaceHeld || e.pointerType === 'touch') { tag.hidden = true; stage.classList.remove('pickable'); return; }
    const now = performance.now();
    if (now - last < 50) return;   // raycaster не чаще 20 раз в секунду
    last = now;
    const p = partAt(e);
    stage.classList.toggle('pickable', !!p);
    if (!p) { tag.hidden = true; return; }
    const r = stage.getBoundingClientRect();
    tag.textContent = p.name;
    tag.style.left = (e.clientX - r.left) + 'px';
    tag.style.top = (e.clientY - r.top) + 'px';
    tag.hidden = false;
  });
  cv.addEventListener('pointerleave', () => { tag.hidden = true; });
} else {
  document.getElementById('helpBtn').hidden = true;   // без 3D управлять нечем
}

// Подсказка «? Управление»: кнопка открывает и закрывает, клик мимо и Esc — закрывают.
// Esc при закрытой подсказке — снова вся модель, как в C:\dev
const help = document.getElementById('help'), helpBtn = document.getElementById('helpBtn');
function showHelp(on) {
  help.hidden = !on;
  helpBtn.setAttribute('aria-expanded', String(on));
  if (on) document.getElementById('helpClose').focus();
}
helpBtn.addEventListener('click', () => showHelp(help.hidden));
document.getElementById('helpClose').addEventListener('click', () => { showHelp(false); helpBtn.focus(); });
addEventListener('pointerdown', e => { if (!help.hidden && !help.contains(e.target) && e.target !== helpBtn) showHelp(false); });
addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!help.hidden) { showHelp(false); helpBtn.focus(); }
  else if (S.sel.el) applySel(null);
});
