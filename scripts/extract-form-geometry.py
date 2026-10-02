"""Extrae la geometría de las hojas originales de 50 y 100 preguntas (PDF
vectoriales) y genera src/layout/formGeometry.ts.

Uso: python3 scripts/extract-form-geometry.py hoja50.pdf hoja100.pdf
Requiere: pip install pymupdf
"""
import sys, json
import pymupdf as fitz


def extract(path):
    page = fitz.open(path)[0]
    sq, circles, gray_rects, gray_lines, boxes = [], [], [], [], []
    for d in page.get_drawings():
        r = d['rect']
        kind = d['items'][0][0]
        if kind == 're' and d.get('fill') == (0.0, 0.0, 0.0):
            sq.append([r.x0, r.y0, r.width])
        elif kind == 'c':
            circles.append([(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, r.width / 2])
        elif kind == 're' and d.get('color') == (0.0, 0.0, 0.0):
            boxes.append([r.x0, r.y0, r.width, r.height])
        elif kind == 're':
            gray_rects.append([r.x0, r.y0, r.width, r.height])
        elif kind == 'l':
            gray_lines.append([r.x0, r.y0, r.x1, r.y1])

    # Marcadores: los 6 cuadros más grandes. La tira de formato son cuadritos que
    # se tocan entre sí; los marcadores de bloque están aislados.
    sq.sort(key=lambda s: -s[2])
    markers = sorted(sq[:6], key=lambda s: (round(s[1]), s[0]))
    rest = sq[6:]
    touching = lambda s: any(t is not s and abs(t[0] - s[0]) < 1.6 * s[2] and abs(t[1] - s[1]) < 1.6 * s[2] for t in rest)
    checker = [s for s in rest if touching(s)]
    block = [s for s in rest if not touching(s)]
    checker.sort(key=lambda s: (s[1], s[0]))

    inside = lambda c, R: R[0] <= c[0] <= R[0] + R[2] and R[1] <= c[1] <= R[1] + R[3]
    id_rect = max(gray_rects, key=lambda R: R[2] * R[3])
    key_rect = min(gray_rects, key=lambda R: R[2] * R[3])
    ver = sorted([c for c in circles if inside(c, key_rect)], key=lambda c: c[1])
    ids = [c for c in circles if inside(c, id_rect)]
    qs = [c for c in circles if not inside(c, id_rect) and not inside(c, key_rect)]

    # ID: columnas por x, filas por y
    cols = cluster(sorted(ids, key=lambda c: c[0]), 0)
    id_grid = [sorted(col, key=lambda c: c[1]) for col in cols]

    # Etiquetas de fila del ID (valor del dígito de cada fila)
    words = page.get_text('words')
    first_col = id_grid[0]
    row_vals = []
    for c in first_col:
        cand = [w for w in words if w[4].isdigit() and len(w[4]) == 1 and w[2] <= c[0] and abs((w[1] + w[3]) / 2 - c[1]) < 5]
        row_vals.append(int(max(cand, key=lambda w: w[2])[4]))
    id_by_value = [[None] * 10 for _ in id_grid]
    for d, col in enumerate(id_grid):
        for i, c in enumerate(col):
            id_by_value[d][row_vals[i]] = c

    # Preguntas: filas de 5 burbujas; número a la izquierda
    rows = {}
    for c in qs:
        rows.setdefault(None, []).append(c)
    qrows = []
    remaining = sorted(qs, key=lambda c: (c[1], c[0]))
    groups = []
    for c in remaining:
        for g in groups:
            if abs(g[0][1] - c[1]) < 4 and min(abs(x[0] - c[0]) for x in g) < 22:
                g.append(c)
                break
        else:
            groups.append([c])
    id_left = id_rect[0]
    questions = {}
    for g in groups:
        g.sort(key=lambda c: c[0])
        assert len(g) == 5, (path, g)
        x0, y0 = g[0][0], g[0][1]
        cand = [w for w in words if w[4].isdigit() and w[2] <= x0 and x0 - w[2] < 25 and abs((w[1] + w[3]) / 2 - y0) < 6]
        num = int(max(cand, key=lambda w: w[2])[4])
        questions[num] = g
    n = len(questions)
    assert sorted(questions) == list(range(1, n + 1)), sorted(questions)
    r = round(sorted(c[2] for c in qs)[len(qs) // 2], 2)
    rd = lambda v: round(v, 2)
    pt = lambda c: [rd(c[0]), rd(c[1])]
    return {
        'markers': [[rd(v) for v in s] for s in markers],
        'blockMarkers': [[rd(v) for v in s] for s in block],
        'checker': [[rd(v) for v in s] for s in checker],
        'r': r,
        'versionR': round(ver[0][2], 2),
        'version': [pt(c) for c in ver],
        'id': [[pt(c) for c in col] for col in id_by_value],
        'questions': [[pt(c) for c in questions[i]] for i in range(1, n + 1)],
        'idRect': [rd(v) for v in id_rect],
        'keyRect': [rd(v) for v in key_rect],
        'grayLines': [[rd(v) for v in l] for l in gray_lines],
        'boxes': [[rd(v) for v in b] for b in boxes],
    }


def cluster(items, axis, tol=4):
    out = []
    for c in items:
        if out and abs(out[-1][-1][axis] - c[axis]) < tol:
            out[-1].append(c)
        else:
            out.append([c])
    return out


data = {50: extract(sys.argv[1]), 100: extract(sys.argv[2])}
with open('src/layout/formGeometry.ts', 'w') as fh:
    fh.write('// GENERADO por scripts/extract-form-geometry.py — no editar a mano.\n')
    fh.write('// Geometría de las hojas de 50 y 100 preguntas, en puntos PDF (1/72 in) sobre\n')
    fh.write('// tamaño carta. Rectángulos: [x, y, lado] o [x, y, ancho, alto]; burbujas: [cx, cy].\n\n')
    fh.write('export interface FormGeometry {\n  markers: number[][];\n  blockMarkers: number[][];\n  checker: number[][];\n  r: number;\n  versionR: number;\n  version: number[][];\n  id: number[][][];\n  questions: number[][][];\n  idRect: number[];\n  keyRect: number[];\n  grayLines: number[][];\n  boxes: number[][];\n}\n\n')
    for k, v in data.items():
        fh.write(f'export const FORM_{k}: FormGeometry = {json.dumps(v, separators=(",", ":"))};\n\n')
print({k: (len(v['questions']), len(v['id']), len(v['version']), len(v['checker']), len(v['blockMarkers'])) for k, v in data.items()})
