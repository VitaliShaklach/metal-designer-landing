/* ---------- инструкции: «?» у каждого раздела панели и «Как пользоваться» над 3D ---------- */
// схемы: труба — серая полоса, активный конец — оранжевая стрелка, второй — серая, «+» — зелёный круг
const SK={
  pipe:(x1,y1,x2,y2,c='#59616a')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="9" stroke-linecap="butt"/>`,
  arrow:(x,y,dir,c='#d0561f')=>{const d=dir==='r'?`${x},${y-9} ${x+16},${y} ${x},${y+9}`:dir==='l'?`${x},${y-9} ${x-16},${y} ${x},${y+9}`:dir==='u'?`${x-9},${y} ${x},${y-16} ${x+9},${y}`:`${x-9},${y} ${x},${y+16} ${x+9},${y}`;return `<polygon points="${d}" fill="${c}"/>`;},
  plus:(x,y)=>`<circle cx="${x}" cy="${y}" r="10" fill="#1e9e5a"/><path d="M${x-5} ${y}h10M${x} ${y-5}v10" stroke="#fff" stroke-width="2.5"/>`,
  t:(x,y,s,c='currentColor')=>`<text x="${x}" y="${y}" font-size="11" font-family="JetBrains Mono,monospace" fill="${c}">${s}</text>`,
  dash:(x1,y1,x2,y2,c='#d0561f')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="9" stroke-dasharray="6 4" opacity=".55"/>`,
  hand:(x,y)=>`<path d="M${x} ${y}l6 14 3-6 7-1z" fill="currentColor"/>`};
const svgBox=(w,h,g)=>`<svg class="hsk" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${g}</svg>`;
const HELP={
  sel:{t:'Кликните трубу <b>у нужного конца</b> — он станет активным (оранжевая стрелка).',
    li:['<b>Удлинить:</b> тяните оранжевую стрелку. Шаг 10 мм, с Shift — 1 мм. У другой трубы конец прилипнет.',
        '<b>Точно:</b> клик по числу «✎ 1500 мм» на модели → впишите длину → Enter.',
        '<b>Направить:</b> строго вверх / вниз / вбок — или любой угол: «Наклон» (45 — диагональ вверх) и «Поворот в плане» → Enter. Вращается вокруг серого конца.',
        '<b>Переместить:</b> стрелки с шагом или dX / dY / dZ + Enter. Delete — удалить.'],
    sk:svgBox(230,62,SK.pipe(30,34,170,34)+SK.arrow(18,34,'l','#7d878c')+SK.arrow(172,34,'r')+SK.dash(170,34,215,34)+SK.hand(196,40)+SK.t(60,20,'✎ 1500 мм','#d0561f'))},
  draw:{t:'Новая труба растёт <b>от активного конца</b> выбранной трубы.',
    li:['<b>Мышью:</b> зажмите зелёный «+» и тяните в нужную сторону.',
        '<b>Кнопками:</b> профиль → длина → «+ труба ↑ Y» (или другая сторона).',
        '<b>Перемычка:</b> клик по одной трубе, Shift+клик по другой → «Труба между…».',
        '<b>С нуля:</b> «Новый» вверху → «Новый узел» (0 / 0 / 0) — у узла появится зелёный «+»: тяните его или жмите «+ труба ↑ Y».'],
    sk:svgBox(230,70,SK.pipe(20,56,140,56)+SK.arrow(142,56,'r')+SK.plus(140,32)+SK.dash(140,48,140,8,'#1e9e5a')+SK.arrow(140,10,'u','#1e9e5a')+SK.hand(150,28)+SK.t(158,22,'+ труба'))},
  copy:{t:'Повторить или отразить выбранные трубы (Shift+клик — выбрать несколько).',
    li:['<b>Копия:</b> сдвиг dX / dY / dZ и сколько раз (×N) → «Копия со сдвигом». Пример — полки стеллажа: dY = 400, ×3.',
        '<b>Зеркало:</b> ось и плоскость, например X = 1500 для середины навеса шириной 3000.'],
    sk:svgBox(230,62,SK.pipe(20,50,90,50)+SK.pipe(24,50,24,12)+SK.pipe(86,50,86,12)+SK.dash(120,50,190,50)+SK.dash(124,50,124,12)+SK.dash(186,50,186,12)+SK.t(92,28,'dX →'))},
  grp:{t:'Сборка — часть изделия, например «Ферма» или «Тумба 1СБ». Нужна для спецификации.',
    li:['Выберите трубы → впишите название → «Создать из выбранного».',
        '<b>×N</b> — сколько таких сборок изготовить, <b>зерк.</b> — вторая зеркальная.',
        '«Только эта» — остальное станет прозрачным.'],
    sk:''},
  view:{t:'Оранжевые кольца — где труба лежит на другой: <b>приварить по месту</b>. Красные — трубы пересекаются, модель надо поправить.',
    li:['Отменить / вернуть — Ctrl+Z / Ctrl+Y.'],sk:''}};
function helpHTML(k){const h=HELP[k];return `<div class="helpbox" hidden><p>${h.t}</p>${h.sk||''}<ul>${h.li.map(x=>`<li>${x}</li>`).join('')}</ul></div>`;}
// «?» в заголовке каждого раздела
document.querySelectorAll('.controls .grp').forEach(g=>{const k=g.dataset.g;if(!HELP[k])return;const gt=g.querySelector('.gt');
  const q=document.createElement('button');q.type='button';q.className='hq';q.textContent='?';q.title='Как пользоваться разделом';q.setAttribute('aria-expanded','false');
  gt.insertAdjacentElement('afterend',q);q.insertAdjacentHTML('afterend',helpHTML(k));const box=q.nextElementSibling;
  q.addEventListener('click',()=>{box.hidden=!box.hidden;q.setAttribute('aria-expanded',String(!box.hidden));if(!box.hidden)g.classList.remove('shut');});});
// «Как пользоваться» над 3D — шпаргалка
(()=>{const st=document.getElementById('stage');if(!st)return;
  st.insertAdjacentHTML('beforeend',`<button class="howbtn" id="howBtn" type="button">? Как пользоваться</button>
  <div class="how" id="how" hidden><div class="howhead"><b>Как пользоваться</b><button type="button" id="howX" aria-label="Закрыть">✕</button></div>
   <ol><li><b>Откройте пример</b> (вверху) или «Новый» → «Новый узел».</li>
    <li><b>Кликните трубу у конца</b> — оранжевая стрелка: тяните — длиннее; зелёный «+» — тяните новую трубу.</li>
    <li><b>Поправьте</b> в панели справа: профиль, длина, направить, переместить.</li>
    <li><b>Внизу</b> — раскрой с длинами и углами, спецификация, металл. «Сохранить» или «Поделиться».</li></ol>
   <dl><dt>ЛКМ + тянуть</dt><dd>вращать</dd><dt>Колесо</dt><dd>приблизить</dd><dt>ПКМ + тянуть</dt><dd>двигать вид</dd><dt>Shift+клик</dt><dd>выбрать несколько</dd>
    <dt>Delete</dt><dd>удалить выбранное</dd><dt>Ctrl+Z / Ctrl+Y</dt><dd>отменить / вернуть</dd><dt>F</dt><dd>показать всё</dd><dt>Esc</dt><dd>снять выбор</dd></dl></div>`);
  const b=document.getElementById('howBtn'),h=document.getElementById('how'),set=o=>{h.hidden=!o;b.setAttribute('aria-expanded',String(o));};
  b.addEventListener('click',()=>set(h.hidden));document.getElementById('howX').addEventListener('click',()=>set(false));
  addEventListener('keydown',e=>{if(e.key==='?'&&!/INPUT|TEXTAREA|SELECT/.test((document.activeElement||{}).tagName||'')){set(h.hidden);}if(e.key==='Escape')set(false);});})();
