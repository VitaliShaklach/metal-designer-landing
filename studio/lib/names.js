// имена фигур: латинский slug для папки и следующее свободное название («Рысь» → «Рысь 2»)
const TR={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
// slugify('Рысь 2') → 'rys-2'; только a–z, 0–9 и дефис, без повторов; пустое имя → 'figura'
function slugify(name){const s=String(name).toLowerCase().replace(/./gu,c=>TR[c]!==undefined?TR[c]:c).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');return s||'figura';}
// nextName('Рысь', ['Рысь']) → 'Рысь 2'; занято «Рысь 2» — «Рысь 3». Базовое имя без номера в конце берётся само: nextName('Рысь 2', …) считает от «Рысь»
function nextName(base,taken){const t=new Set(taken.map(x=>x.trim().toLowerCase())),b=String(base).trim().replace(/\s+\d+$/,'')||'Фигура';
  if(!t.has(b.toLowerCase()))return b;for(let n=2;;n++){const c=b+' '+n;if(!t.has(c.toLowerCase()))return c;}}
// slug, которого ещё нет: rys-2 занят — rys-2-2 (названия разные, а slug совпасть может, например «Рысь!» и «Рысь»)
function freeSlug(name,taken){const b=slugify(name),t=new Set(taken);if(!t.has(b))return b;for(let n=2;;n++)if(!t.has(b+'-'+n))return b+'-'+n;}
module.exports={slugify,nextName,freeSlug};
