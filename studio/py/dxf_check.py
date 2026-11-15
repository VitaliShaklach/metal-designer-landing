"""Копия C:/dev/metal-designer/art/tools/dxf-check.py (правило 17 мастерской: DXF чистый).
Проверка DXF «Искусства» настоящим CAD-парсером (ezdxf) — то, что увидит программа резчика.

Запуск:  python -m pip install -r studio/py/requirements.txt
         python studio/py/dxf_check.py <файлы.dxf или папка> [--md]
Файлы — с кнопок «DXF раскрой» и «DXF детали» (или page-check.js {dxf:true}). --md — итог таблицей (для коммита).
Проверяет: файл читается без ошибок, audit() без ошибок и исправлений, версия, $INSUNITS = 4 (мм), слои объявлены
и только задуманные; CUT — замкнутые полилинии без нулевых отрезков и самопересечений, без дублей; контуры не
пересекаются, внутренний контур (если есть) целиком внутри внешнего, на раскрое всё внутри листа (SHEET);
метки (ENGRAVE, BEND_V, BEND_M, PERF) и текст — внутри своей детали (допуск 0,015 мм — округление координат в файле).
Код выхода 1 — есть ошибки."""
import sys, glob, os, math
from collections import Counter
import ezdxf
from ezdxf import recover

TOL = 0.01                                               # мм: координаты в файле округлены до 0,01
EDGE = 0.015      # мм: линия сгиба кончается ровно на кромке; после округления конца и двух вершин кромки до 0,01 — до 0,014 «за» ней
LAYERS = {'CUT', 'ENGRAVE', 'BEND_V', 'BEND_M', 'PERF', 'SHEET'}   # что пишет prod.js / sheets.js
MARKS = {'ENGRAVE', 'BEND_V', 'BEND_M', 'PERF'}


def seg_dist(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = dx * dx + dy * dy
    k = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) if L else 0
    return math.hypot(p[0] - a[0] - dx * k, p[1] - a[1] - dy * k)


def in_poly(p, P):
    c = False
    for i in range(len(P)):
        a, b = P[i], P[i - 1]
        if (a[1] > p[1]) != (b[1] > p[1]) and p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]:
            c = not c
    return c


def outside(p, P):                                       # насколько точка за контуром (0 — внутри)
    return 0 if in_poly(p, P) else min(seg_dist(p, P[i - 1], P[i]) for i in range(len(P)))


def cross(a, b, c, d):                                   # отрезки ab и cd пересекаются (не касанием)
    o = lambda p, q, r: (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    return o(a, b, c) * o(a, b, d) < 0 and o(c, d, a) * o(c, d, b) < 0


def self_cross(P):
    n = len(P)
    for i in range(n):
        for j in range(i + 2, n):
            if not (i == 0 and j == n - 1) and cross(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n]):
                return True
    return False


def bbox(P):
    xs, ys = [p[0] for p in P], [p[1] for p in P]
    return min(xs), min(ys), max(xs), max(ys)


def inside_box(p, b, t=TOL):
    return b[0] - t <= p[0] <= b[2] + t and b[1] - t <= p[1] <= b[3] + t


def check(path):
    r = {'file': os.path.basename(path), 'bad': [], 'note': []}
    bad = r['bad'].append
    try:
        doc = ezdxf.readfile(path)
    except Exception as e:                               # не прочитался — что скажет recover
        bad(f'readfile: {type(e).__name__}: {e}')
        try:
            doc, a = recover.readfile(path)
            bad(f'recover: ошибок {len(a.errors)}, исправлений {len(a.fixes)}')
        except Exception as e2:
            bad(f'recover: {e2}')
            return r
    a = doc.audit()
    r['audit'] = f'{len(a.errors)}/{len(a.fixes)}'
    for x in a.errors[:5] + a.fixes[:5]:
        bad(f'audit: {x.message}')
    r['ver'] = doc.dxfversion
    r['units'] = doc.header.get('$INSUNITS')
    if r['units'] != 4:
        bad(f'$INSUNITS = {r["units"]}, нужно 4 (мм)')
    msp = doc.modelspace()
    used = Counter(e.dxf.layer for e in msp)
    r['layers'] = dict(used)
    declared = {l.dxf.name for l in doc.layers}
    if set(used) - LAYERS:
        bad(f'лишние слои: {sorted(set(used) - LAYERS)}')
    if set(used) - declared:
        bad(f'слои не объявлены в таблице LAYER: {sorted(set(used) - declared)}')
    if 'CUT' not in used:
        bad('нет слоя CUT')

    # --- контуры реза ---
    cuts, sheets = [], []
    for e in msp:
        if e.dxftype() not in ('POLYLINE', 'LWPOLYLINE'):
            if e.dxftype() != 'LINE' and e.dxf.layer == 'CUT':
                bad(f'CUT: {e.dxftype()} — не полилиния')
            continue
        P = [(round(v[0], 6), round(v[1], 6)) for v in e.points()]
        closed = e.is_closed
        if not closed and len(P) > 2 and math.dist(P[0], P[-1]) <= TOL:
            closed, P = True, P[:-1]                         # замкнут совпадением концов
        (cuts if e.dxf.layer == 'CUT' else sheets if e.dxf.layer == 'SHEET' else []).append(P)
        if e.dxf.layer != 'CUT':
            continue
        k = len(cuts)
        if not closed:
            bad(f'CUT №{k} не замкнут (разрыв {math.dist(P[0], P[-1]):.3f} мм)')
        if len(P) < 3:
            bad(f'CUT №{k}: меньше 3 точек')
        z = [i for i in range(len(P)) if math.dist(P[i], P[(i + 1) % len(P)]) < TOL]
        if z:
            bad(f'CUT №{k}: нулевых отрезков {len(z)}')
        if self_cross(P):
            bad(f'CUT №{k}: контур пересекает сам себя')
    r['cut'] = len(cuts)
    keys = Counter(tuple(sorted(P)) for P in cuts)
    if any(n > 1 for n in keys.values()):
        bad(f'CUT: дублей {sum(n - 1 for n in keys.values())}')
    B = [bbox(P) for P in cuts]
    # контуры не пересекаются; лежит внутри другого — внутренний (отверстие)
    holes = set()
    for i in range(len(cuts)):
        for j in range(len(cuts)):
            if i >= j or B[i][0] > B[j][2] or B[j][0] > B[i][2] or B[i][1] > B[j][3] or B[j][1] > B[i][3]:
                continue
            A, C = cuts[i], cuts[j]
            if any(cross(A[m - 1], A[m], C[n - 1], C[n]) for m in range(len(A)) for n in range(len(C))):
                bad(f'CUT №{i + 1} и №{j + 1} пересекаются')
            elif all(in_poly(p, C) for p in A):
                holes.add(i)
            elif all(in_poly(p, A) for p in C):
                holes.add(j)
            elif any(in_poly(p, C) for p in A) or any(in_poly(p, A) for p in C):
                bad(f'CUT №{i + 1} и №{j + 1} наложены')
    r['holes'] = len(holes)
    outer = [i for i in range(len(cuts)) if i not in holes]
    if sheets:
        r['sheets'] = len(sheets)
        SB = [bbox(S) for S in sheets]
        n = sum(1 for b in B if not any(inside_box(b[:2], s) and inside_box(b[2:], s) for s in SB))
        if n:
            bad(f'за пределами листа: {n} контуров CUT')

    # --- метки и текст: внутри детали (внешний контур, не в отверстии) ---
    def owner(p):                                        # деталь, где лежит точка, или ближайшая
        best, bd = None, 1e18
        for i in outer:
            if not inside_box(p, B[i], 50):
                continue
            d = outside(p, cuts[i])
            if d < bd:
                best, bd = i, d
            if d == 0:
                break
        return best, bd

    over, zero, lines = {}, Counter(), Counter()
    for e in msp:
        t, lay = e.dxftype(), e.dxf.layer
        if t == 'LINE' and lay in MARKS:
            a, b = (e.dxf.start[0], e.dxf.start[1]), (e.dxf.end[0], e.dxf.end[1])
            if math.dist(a, b) < TOL:
                zero[lay] += 1
            k = (lay,) + tuple(sorted([(round(a[0], 2), round(a[1], 2)), (round(b[0], 2), round(b[1], 2))]))
            lines[k] += 1
            i, _ = owner(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2))
            if i is None:
                d = 1e9
            else:
                d = max(outside(a, cuts[i]), outside(b, cuts[i]))
                h = [j for j in holes if inside_box(a, B[j]) or inside_box(b, B[j])]
                if any(in_poly(a, cuts[j]) or in_poly(b, cuts[j]) for j in h):
                    d = max(d, 0.02)
            if d > EDGE:
                o = over.setdefault(lay, [0, 0])
                o[0] += 1
                o[1] = max(o[1], d)
        elif t == 'TEXT' and lay != 'SHEET':
            p = (e.dxf.insert[0], e.dxf.insert[1])
            if owner(p)[1] > EDGE:
                bad(f'текст «{e.dxf.text}» ({lay}) вне детали')
    for lay, n in zero.items():
        bad(f'{lay}: нулевых отрезков {n}')
    dup = Counter()
    for k, n in lines.items():
        if n > 1:
            dup[k[0]] += n - 1
    for lay, n in dup.items():
        bad(f'{lay}: дублей линий {n}')
    for lay, (n, m) in over.items():
        bad(f'{lay}: {n} линий выходят за контур детали, до {m:.3f} мм')
    return r


def main(args):
    md = '--md' in args
    files = []
    for a in (x for x in args if x != '--md'):
        files += sorted(glob.glob(os.path.join(a, '*.dxf'))) if os.path.isdir(a) else [a]
    if not files:
        print(__doc__)
        return 2
    R = [check(f) for f in files]
    for r in R:
        lay = ', '.join(f'{k} {v}' for k, v in sorted(r.get('layers', {}).items()))
        print(f"{'OK  ' if not r['bad'] else 'FAIL'} {r['file']}: {r.get('ver')}, INSUNITS {r.get('units')}, "
              f"audit {r.get('audit')}, CUT {r.get('cut')}, отверстий {r.get('holes')}"
              + (f", листов {r['sheets']}" if r.get('sheets') else '') + f"; {lay}")
        for b in r['bad']:
            print('     ' + b)
    if md:
        print('\n| Файл | Версия | Ед. | audit ош./испр. | CUT | Слои | Итог |\n|---|---|---|---|---|---|---|')
        for r in R:
            lay = ' '.join(sorted(r.get('layers', {})))
            print(f"| {r['file']} | {r.get('ver')} | {'мм' if r.get('units') == 4 else r.get('units')} | {r.get('audit')} | "
                  f"{r.get('cut')} | {lay} | {'чисто' if not r['bad'] else '; '.join(r['bad'])} |")
    print('всё чисто' if not any(r['bad'] for r in R) else f"с ошибками: {sum(1 for r in R if r['bad'])} из {len(R)}")
    return 1 if any(r['bad'] for r in R) else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
