"""Buduje mieszkanie 3D z rzutu (plany.json) i renderuje przelot kamery.

Uruchomienie (zawsze w tle):
  blender --background --python blender/spacer.py -- <plany.json> <slot> <katalog_wyjscia> <podglad|film>

Układ: x rzutu -> X, y rzutu (w stronę okien) -> -Y. Ściana z oknami leży na Y = -planH,
słońce wpada od strony -Y. Sufit rzuca cień, ale kamera go nie widzi (makieta bez dachu).
"""

import json
import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
PLANS, SLOT, OUT, MODE = argv[0], int(argv[1]), argv[2], argv[3]
plan = next(p for p in json.load(open(PLANS, encoding="utf-8")) if p["slot"] == SLOT)
W, H = plan["planW"], plan["planH"]
ROOMS = [r for r in plan["plan"] if r["kind"] != "balkon"]
BALCONY = next((r for r in plan["plan"] if r["kind"] == "balkon"), None)

WALL_H = 2.7
T_OUT = 0.24
T_IN = 0.1
DOOR_W, DOOR_H = 0.9, 2.05
EPS = 1e-6

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


# ---------- materiały ----------
def material(name, color, rough=0.6, alpha=1.0, emission=0.0):
    mat = bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except Exception:
        pass
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    if alpha < 1:
        bsdf.inputs["Alpha"].default_value = alpha
        for attr, val in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
            try:
                setattr(mat, attr, val)
            except Exception:
                pass
    if emission:
        try:
            bsdf.inputs["Emission Color"].default_value = (*color, 1)
            bsdf.inputs["Emission Strength"].default_value = emission
        except Exception:
            pass
    return mat


def wood_material():
    mat = material("Podloga drewno", (0.55, 0.38, 0.22), 0.45)
    try:
        nt = mat.node_tree
        bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
        coord = nt.nodes.new("ShaderNodeTexCoord")
        wave = nt.nodes.new("ShaderNodeTexWave")
        wave.inputs["Scale"].default_value = 3.2
        wave.inputs["Distortion"].default_value = 1.2
        wave.inputs["Detail"].default_value = 3.0
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (0.30, 0.17, 0.08, 1)
        ramp.color_ramp.elements[1].color = (0.48, 0.30, 0.16, 1)
        nt.links.new(coord.outputs["Object"], wave.inputs["Vector"])
        nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    except Exception as e:  # płaski kolor wystarczy
        print("drewno: bez tekstury", e)
    return mat


M = {
    "wall": material("Sciana", (0.93, 0.90, 0.84), 0.9),
    "wall_out": material("Elewacja", (0.80, 0.74, 0.64), 0.9),
    "cap": material("Przekroj", (0.12, 0.11, 0.10), 0.9),
    "wood": wood_material(),
    "tile": material("Plytki", (0.80, 0.80, 0.77), 0.3),
    "tile_bath": material("Plytki lazienka", (0.70, 0.78, 0.76), 0.25),
    "concrete": material("Beton", (0.62, 0.60, 0.57), 0.8),
    "white": material("Bialy", (0.95, 0.95, 0.93), 0.4),
    "accent": material("Akcent", (0.45, 0.10, 0.04), 0.85),
    "fabric": material("Tkanina", (0.55, 0.50, 0.42), 0.95),
    "dark": material("Ciemny", (0.10, 0.10, 0.10), 0.5),
    "oak": material("Dab", (0.42, 0.27, 0.14), 0.5),
    "plant": material("Roslina", (0.08, 0.24, 0.09), 0.8),
    "pot": material("Donica", (0.80, 0.52, 0.36), 0.8),
    "rug": material("Dywan", (0.62, 0.55, 0.44), 1.0),
    "glass": material("Szklo", (0.75, 0.88, 0.95), 0.05, alpha=0.16),
    "base": material("Podstawa", (0.96, 0.94, 0.90), 0.9),
    "table": material("Stol", (0.13, 0.12, 0.115), 0.85),
    "lamp": material("Lampa", (1.0, 0.86, 0.62), 0.5, emission=3.0),
    "steel": material("Stal", (0.55, 0.56, 0.58), 0.3),
}


# ---------- prymitywy ----------
def box(name, cx, cy, cz, sx, sy, sz, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, cz))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (max(sx, 0.001), max(sy, 0.001), max(sz, 0.001))
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("faza", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    return obj


def cylinder(name, cx, cy, cz, r, h, mat, verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=(cx, cy, cz))
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def sphere(name, cx, cy, cz, r, mat):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=r, location=(cx, cy, cz))
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def P(x, y):
    """punkt rzutu -> świat"""
    return x, -y


def pbox(name, x, y, w, d, z0, h, mat, bevel=0.0):
    """pudełko zadane prostokątem na rzucie (x, y = lewy górny róg) i wysokością od z0"""
    cx, cy = P(x + w / 2, y + d / 2)
    return box(name, cx, cy, z0 + h / 2, w, d, h, mat, bevel)


# ---------- ściany ----------
def wall_h(y, x0, x1, t, mat, opening=None, z0=0.0, z1=WALL_H):
    """ściana pozioma na rzucie (stałe y) z opcjonalnym otworem (o0, o1, dół, góra)"""
    if x1 - x0 < EPS:
        return
    if not opening:
        pbox("sciana", x0, y - t / 2, x1 - x0, t, z0, z1 - z0, mat)
        pbox("przekroj", x0, y - t / 2, x1 - x0, t, z1, 0.015, M["cap"])
        return
    o0, o1, zb, zt = opening
    wall_h(y, x0, o0, t, mat)
    wall_h(y, o1, x1, t, mat)
    if zb > EPS:
        pbox("parapet", o0, y - t / 2, o1 - o0, t, 0, zb, mat)
    if WALL_H - zt > EPS:
        pbox("nadproze", o0, y - t / 2, o1 - o0, t, zt, WALL_H - zt, mat)
        pbox("przekroj", o0, y - t / 2, o1 - o0, t, WALL_H, 0.015, M["cap"])


def wall_v(x, y0, y1, t, mat, opening=None):
    if y1 - y0 < EPS:
        return
    if not opening:
        pbox("sciana", x - t / 2, y0, t, y1 - y0, 0, WALL_H, mat)
        pbox("przekroj", x - t / 2, y0, t, y1 - y0, WALL_H, 0.015, M["cap"])
        return
    o0, o1, zb, zt = opening
    wall_v(x, y0, o0, t, mat)
    wall_v(x, o1, y1, t, mat)
    if zb > EPS:
        pbox("parapet", x - t / 2, o0, t, o1 - o0, 0, zb, mat)
    if WALL_H - zt > EPS:
        pbox("nadproze", x - t / 2, o0, t, o1 - o0, zt, WALL_H - zt, mat)
        pbox("przekroj", x - t / 2, o0, t, o1 - o0, WALL_H, 0.015, M["cap"])


def shared(a, b):
    """wspólny odcinek dwóch pomieszczeń: ('v', x, y0, y1) albo ('h', y, x0, x1)"""
    for p, q in ((a, b), (b, a)):
        if abs(p["x"] + p["w"] - q["x"]) < EPS:
            y0, y1 = max(p["y"], q["y"]), min(p["y"] + p["h"], q["y"] + q["h"])
            if y1 - y0 > 0.05:
                return ("v", q["x"], y0, y1)
        if abs(p["y"] + p["h"] - q["y"]) < EPS:
            x0, x1 = max(p["x"], q["x"]), min(p["x"] + p["w"], q["x"] + q["w"])
            if x1 - x0 > 0.05:
                return ("h", q["y"], x0, x1)
    return None


def seg_len(s):
    return s[3] - s[2]


pairs = []
for i, a in enumerate(ROOMS):
    for b in ROOMS[i + 1 :]:
        s = shared(a, b)
        if s:
            pairs.append((a, b, s))

is_open = lambda a, b: {a["kind"], b["kind"]} == {"kuchnia", "salon"}
doors = set()
reach = {id(r) for r in ROOMS if r["kind"] == "hol"}
# drzwi z holu do wszystkiego, co ma z nim porządny wspólny odcinek
for a, b, s in pairs:
    if "hol" in (a["kind"], b["kind"]) and seg_len(s) >= 1.0:
        doors.add((id(a), id(b)))
        reach |= {id(a), id(b)}
# reszta: dopóki coś jest odcięte, dodaj przejście od pomieszczenia już dostępnego
changed = True
while changed:
    changed = False
    for a, b, s in pairs:
        if (id(a) in reach) == (id(b) in reach):
            continue
        if is_open(a, b):
            reach |= {id(a), id(b)}
            changed = True
            continue
        inside = a if id(a) in reach else b
        if inside["kind"] == "lazienka" or seg_len(s) < 1.0:
            continue
        doors.add((id(a), id(b)))
        reach |= {id(a), id(b)}
        changed = True

for a, b, s in pairs:
    if is_open(a, b):
        continue
    kind, c, t0, t1 = s
    opening = None
    if (id(a), id(b)) in doors:
        mid = (t0 + t1) / 2
        opening = (mid - DOOR_W / 2, mid + DOOR_W / 2, 0, DOOR_H)
    (wall_v if kind == "v" else wall_h)(c, t0, t1, T_IN, M["wall"], opening)

# ściany zewnętrzne
wall_v(0, 0, H, T_OUT, M["wall_out"])
wall_v(W, 0, H, T_OUT, M["wall_out"])
hol = next(r for r in ROOMS if r["kind"] == "hol")
entry = hol["x"] + hol["w"] / 2
wall_h(0, 0, W, T_OUT, M["wall_out"], (entry - DOOR_W / 2, entry + DOOR_W / 2, 0, DOOR_H))
pbox("drzwi wejsciowe", entry - DOOR_W / 2, -0.04, DOOR_W, 0.06, 0, DOOR_H, M["oak"])

# ściana okienna: po kolei pomieszczenia przy dolnej krawędzi
x = 0.0
for r in sorted((r for r in ROOMS if abs(r["y"] + r["h"] - H) < EPS), key=lambda r: r["x"]):
    if r["kind"] in ("salon", "sypialnia"):
        full = r["kind"] == "salon"
        ow = r["w"] * (0.72 if full else 0.55)
        o0 = r["x"] + (r["w"] - ow) / 2
        zb, zt = (0.06, 2.5) if full else (0.85, 2.4)
        wall_h(H, r["x"], r["x"] + r["w"], T_OUT, M["wall_out"], (o0, o0 + ow, zb, zt))
        glass = pbox("szyba", o0, H - 0.02, ow, 0.04, zb, zt - zb, M["glass"])
        glass.visible_shadow = False
        for fx in (o0, o0 + ow - 0.05, o0 + ow / 2 - 0.025):
            pbox("rama", fx, H - 0.04, 0.05, 0.08, zb, zt - zb, M["dark"])
        pbox("rama", o0, H - 0.04, ow, 0.08, zt - 0.05, 0.05, M["dark"])
        pbox("rama", o0, H - 0.04, ow, 0.08, zb, 0.05, M["dark"])
    else:
        wall_h(H, r["x"], r["x"] + r["w"], T_OUT, M["wall_out"])

# ---------- podłogi, sufit, podstawa ----------
FLOOR = {"salon": "wood", "sypialnia": "wood", "hol": "wood", "kuchnia": "tile", "lazienka": "tile_bath"}
for r in ROOMS:
    pbox("podloga " + r["label"], r["x"], r["y"], r["w"], r["h"], -0.1, 0.1, M[FLOOR[r["kind"]]])

ceiling = pbox("sufit", -0.2, -0.2, W + 0.4, H + 0.4, WALL_H, 0.12, M["white"])
ceiling.visible_camera = False

pbox("podstawa", -1.4, -1.4, W + 2.8, H + (3.4 if BALCONY else 2.8), -0.34, 0.24, M["base"], 0.03)
pbox("stol", -40, -40, W + 80, H + 80, -0.4, 0.06, M["table"])


# ---------- meble ----------
def plant(x, y, scale=1.0):
    cx, cy = P(x, y)
    cylinder("donica", cx, cy, 0.2 * scale, 0.17 * scale, 0.4 * scale, M["pot"])
    for i, (dx, dy, dz, rr) in enumerate(((0, 0, 0.75, 0.3), (0.12, 0.08, 1.05, 0.24), (-0.1, 0.05, 1.25, 0.2))):
        sphere("lisc", cx + dx * scale, cy + dy * scale, dz * scale, rr * scale, M["plant"])


def chair(x, y, facing):
    """krzesło o środku (x, y) na rzucie; facing: 'u' oparcie od góry rzutu, 'd' od dołu"""
    pbox("krzeslo", x - 0.21, y - 0.21, 0.42, 0.42, 0.42, 0.05, M["oak"], 0.01)
    by = y - 0.21 if facing == "u" else y + 0.17
    pbox("oparcie", x - 0.21, by, 0.42, 0.04, 0.47, 0.42, M["oak"], 0.01)
    for dx in (-0.18, 0.15):
        for dy in (-0.18, 0.15):
            pbox("noga", x + dx, y + dy, 0.03, 0.03, 0, 0.42, M["dark"])


def furnish_salon(r):
    x, y, w, h = r["x"], r["y"], r["w"], r["h"]
    sy = y + h * 0.55
    # kanapa przy lewej ścianie, twarzą w prawo
    pbox("kanapa siedzisko", x + 0.12, sy - 1.05, 0.92, 2.1, 0.12, 0.3, M["accent"], 0.05)
    pbox("kanapa oparcie", x + 0.12, sy - 1.05, 0.24, 2.1, 0.12, 0.72, M["accent"], 0.05)
    for yy in (sy - 1.05, sy + 0.85):
        pbox("kanapa bok", x + 0.12, yy, 0.92, 0.2, 0.12, 0.5, M["accent"], 0.05)
    for yy in (sy - 0.75, sy + 0.3):
        pbox("poduszka", x + 0.36, yy, 0.16, 0.45, 0.48, 0.38, M["fabric"], 0.06)
    # dywan, stolik
    pbox("dywan", x + 0.8, sy - 1.2, min(2.2, w - 1.2), 2.4, 0.0, 0.015, M["rug"])
    tx = x + min(1.75, w * 0.5)
    cx, cy = P(tx, sy)
    cylinder("stolik", cx, cy, 0.34, 0.42, 0.04, M["oak"], 32)
    cylinder("stolik noga", cx, cy, 0.17, 0.03, 0.34, M["dark"])
    # szafka RTV przy prawej ścianie
    pbox("rtv", x + w - 0.5, sy - 0.9, 0.4, 1.8, 0.0, 0.45, M["oak"], 0.015)
    pbox("telewizor", x + w - 0.16, sy - 0.65, 0.04, 1.3, 0.75, 0.75, M["dark"], 0.01)
    # lampa stojąca i roślina przy oknie
    lx, ly = P(x + 0.35, sy - 1.45)
    cylinder("lampa noga", lx, ly, 0.8, 0.015, 1.6, M["dark"])
    cylinder("lampa klosz", lx, ly, 1.62, 0.17, 0.3, M["lamp"])
    plant(x + w - 0.4, y + h - 0.45, 1.15)
    if w > 4.2:  # duży salon: fotel
        pbox("fotel", x + w * 0.55, y + h - 1.5, 0.85, 0.85, 0.12, 0.3, M["fabric"], 0.06)
        pbox("fotel oparcie", x + w * 0.55, y + h - 0.85, 0.85, 0.2, 0.12, 0.65, M["fabric"], 0.06)


def furnish_bedroom(r):
    x, y, w, h = r["x"], r["y"], r["w"], r["h"]
    if r["label"] == "Gabinet" or min(w, h) < 2.3:
        pbox("biurko", x + 0.15, y + h - 0.85, min(1.4, w - 0.3), 0.65, 0.72, 0.04, M["oak"], 0.01)
        for dx in (0.18, min(1.4, w - 0.3) + 0.08):
            pbox("noga", x + dx, y + h - 0.82, 0.04, 0.58, 0, 0.72, M["dark"])
        chair(x + 0.15 + min(1.4, w - 0.3) / 2, y + h - 1.25, "u")
        pbox("regal", x + w - 0.42, y + 0.15, 0.32, min(1.2, h - 0.4), 0, 1.8, M["white"], 0.01)
        return
    bw = 1.6 if w >= 2.6 else 1.4
    by = y + h * 0.6 - bw / 2
    pbox("lozko rama", x + 0.1, by, 2.05, bw, 0.1, 0.2, M["oak"], 0.02)
    pbox("materac", x + 0.14, by + 0.04, 1.95, bw - 0.08, 0.3, 0.2, M["white"], 0.05)
    pbox("zaglowek", x + 0.06, by - 0.05, 0.08, bw + 0.1, 0.1, 0.95, M["fabric"], 0.03)
    pbox("narzuta", x + 0.9, by + 0.02, 1.2, bw - 0.04, 0.5, 0.03, M["accent"], 0.01)
    for py in (by + 0.12, by + bw - 0.62):
        pbox("poduszka", x + 0.2, py, 0.4, 0.5, 0.5, 0.12, M["fabric"], 0.05)
    pbox("szafka nocna", x + 0.1, by + bw + 0.08, 0.42, 0.42, 0, 0.45, M["oak"], 0.015)
    nx, ny = P(x + 0.31, by + bw + 0.29)
    cylinder("lampka", nx, ny, 0.62, 0.1, 0.2, M["lamp"])
    pbox("dywan", x + 0.6, by + bw * 0.5, min(1.9, w - 0.8), 1.1, 0, 0.015, M["rug"])
    if h > 4.2:
        pbox("szafa", x + w - 0.72, y + 0.12, 0.6, min(1.8, h * 0.3), 0, 2.3, M["white"], 0.01)


def furnish_kitchen(r):
    x, y, w, h = r["x"], r["y"], r["w"], r["h"]
    pbox("blat szafki", x + 0.12, y + 0.14, w - 0.24, 0.6, 0, 0.86, M["white"], 0.01)
    pbox("blat", x + 0.1, y + 0.12, w - 0.2, 0.64, 0.86, 0.04, M["oak"], 0.008)
    pbox("szafki gorne", x + 0.12, y + 0.14, w - 0.9, 0.34, 1.5, 0.7, M["white"], 0.01)
    pbox("lodowka", x + w - 0.74, y + 0.14, 0.62, 0.62, 0, 2.0, M["steel"], 0.015)
    pbox("plyta", x + 0.5, y + 0.22, 0.58, 0.44, 0.9, 0.01, M["dark"])
    if h >= 2.2 and w >= 2.0:
        tw = min(1.4, w - 0.9)
        tx, ty = x + (w - tw) / 2, y + h - 1.05
        pbox("stol blat", tx, ty, tw, 0.8, 0.72, 0.04, M["oak"], 0.01)
        for dx in (0.05, tw - 0.1):
            for dy in (0.05, 0.7):
                pbox("stol noga", tx + dx, ty + dy, 0.05, 0.05, 0, 0.72, M["dark"])
        for cxp in (tx + tw * 0.28, tx + tw * 0.72):
            chair(cxp, ty - 0.2, "u")
            chair(cxp, ty + 1.0, "d")
        vx, vy = P(tx + tw / 2, ty + 0.4)
        cylinder("wazon", vx, vy, 0.86, 0.06, 0.2, M["pot"])
        sphere("kwiaty", vx, vy, 1.05, 0.14, M["plant"])


def furnish_bath(r):
    x, y, w, h = r["x"], r["y"], r["w"], r["h"]
    pbox("wanna", x + w - 0.86, y + 0.14, 0.74, min(1.7, h - 0.3), 0, 0.56, M["white"], 0.06)
    pbox("umywalka szafka", x + 0.12, y + 0.14, min(0.9, w - 1.1), 0.46, 0.3, 0.5, M["oak"], 0.01)
    pbox("umywalka", x + 0.16, y + 0.16, min(0.82, w - 1.18), 0.42, 0.8, 0.07, M["white"], 0.02)
    pbox("lustro", x + 0.16, y + 0.08, min(0.82, w - 1.18), 0.02, 1.1, 0.8, M["steel"])
    pbox("wc", x + 0.14, y + h - 0.72, 0.38, 0.56, 0, 0.42, M["white"], 0.05)


def furnish_hall(r):
    x, y, w, h = r["x"], r["y"], r["w"], r["h"]
    pbox("szafka na buty", x + 0.14, y + h - 0.52, min(1.1, w - 1.2), 0.36, 0, 0.5, M["oak"], 0.015)
    pbox("lustro", x + 0.13, y + 0.5, 0.02, 0.6, 0.5, 1.5, M["steel"])
    pbox("wycieraczka", x + w / 2 - 0.4, y + 0.2, 0.8, 0.5, 0, 0.012, M["dark"])


FURNISH = {"salon": furnish_salon, "sypialnia": furnish_bedroom, "kuchnia": furnish_kitchen, "lazienka": furnish_bath, "hol": furnish_hall}
for r in ROOMS:
    FURNISH[r["kind"]](r)

if BALCONY:
    b = BALCONY
    pbox("balkon plyta", b["x"], b["y"], b["w"], b["h"], -0.22, 0.2, M["concrete"], 0.01)
    for args in ((b["x"], b["y"] + b["h"] - 0.03, b["w"], 0.03), (b["x"], b["y"], 0.03, b["h"]), (b["x"] + b["w"] - 0.03, b["y"], 0.03, b["h"])):
        rail = pbox("balustrada", *args, -0.02, 1.1, M["glass"])
        rail.visible_shadow = False
    pbox("porecz", b["x"], b["y"] + b["h"] - 0.05, b["w"], 0.05, 1.08, 0.04, M["dark"])
    chair(b["x"] + 0.6, b["y"] + b["h"] * 0.5, "u")
    plant(b["x"] + b["w"] - 0.4, b["y"] + b["h"] * 0.5, 0.8)

# ---------- światło ----------
sun_data = bpy.data.lights.new("Slonce", "SUN")
sun_data.energy = 7.5
sun_data.angle = math.radians(2.5)
sun_data.color = (1.0, 0.93, 0.82) if plan["facade"] == "S" else (1.0, 0.96, 0.9)
sun = bpy.data.objects.new("Slonce", sun_data)
scene.collection.objects.link(sun)
# promienie biegną w głąb mieszkania (+Y), w dół i lekko w bok
ray = Vector((0.38 if plan["facade"] == "S" else -0.3, 0.78, -0.62)).normalized()
sun.rotation_euler = (-ray).to_track_quat("Z", "Y").to_euler()

for r in ROOMS:
    data = bpy.data.lights.new("Wypelnienie " + r["label"], "AREA")
    data.shape = "RECTANGLE"
    data.size = max(0.6, r["w"] * 0.7)
    data.size_y = max(0.6, r["h"] * 0.7)
    data.energy = r["w"] * r["h"] * 2.2
    data.color = (1.0, 0.95, 0.88)
    obj = bpy.data.objects.new(data.name, data)
    cx, cy = P(r["x"] + r["w"] / 2, r["y"] + r["h"] / 2)
    obj.location = (cx, cy, WALL_H - 0.08)
    scene.collection.objects.link(obj)

world = bpy.data.worlds.new("Swiat")
try:
    world.use_nodes = True
except Exception:
    pass
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bg.inputs[0].default_value = (0.80, 0.87, 0.94, 1)
bg.inputs[1].default_value = 0.45
scene.world = world

# ---------- kamera ----------
salon = next(r for r in ROOMS if r["kind"] == "salon")
sx, sy = P(salon["x"] + salon["w"] / 2, salon["y"] + salon["h"] / 2)
cx, cy = P(W / 2, H / 2)

cam_data = bpy.data.cameras.new("Kamera")
cam_data.lens = 22
cam_data.clip_start = 0.05
cam = bpy.data.objects.new("Kamera", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
target = bpy.data.objects.new("Cel", None)
scene.collection.objects.link(target)
track = cam.constraints.new("TRACK_TO")
track.target = target
track.track_axis = "TRACK_NEGATIVE_Z"
track.up_axis = "UP_Y"

FRAMES = 264  # 11 s przy 24 kl./s
KEYS = [
    # klatka, pozycja kamery, punkt, na który patrzy
    (1, (cx - 6.0, -H - 5.5, 8.5), (cx, cy - 0.5, 0.4)),
    (96, (cx + 7.0, -H - 3.0, 6.5), (cx, cy - 0.3, 0.4)),
    (176, (sx + 2.2, sy + salon["h"] * 0.5 + 2.6, 5.2), (sx, sy - 0.6, 0.8)),
    (232, (sx + 0.25, sy + salon["h"] * 0.5 - 0.55, 1.6), (sx - 0.1, -H - 1.0, 1.25)),
    (FRAMES, (sx - 0.2, sy + salon["h"] * 0.5 - 1.2, 1.5), (sx - 0.4, -H - 1.5, 1.2)),
]
for frame, loc, look in KEYS:
    cam.location = loc
    target.location = look
    cam.keyframe_insert("location", frame=frame)
    target.keyframe_insert("location", frame=frame)

# ---------- render ----------
scene.frame_start, scene.frame_end = 1, FRAMES
scene.render.fps = 24
for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        continue
for attr, val in (("taa_render_samples", 48 if MODE == "film" else 24), ("use_raytracing", True), ("use_shadows", True)):
    try:
        setattr(scene.eevee, attr, val)
    except Exception:
        pass
try:
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
except Exception as e:
    print("kolor: ustawienia domyślne", e)

print("silnik:", scene.render.engine, "| pomieszczeń:", len(ROOMS), "| drzwi:", len(doors))

if MODE == "podglad":
    scene.render.resolution_x, scene.render.resolution_y = 768, 432
    scene.render.image_settings.file_format = "PNG"
    for frame in (1, 96, 176, 232, FRAMES):
        scene.frame_set(frame)
        scene.render.filepath = f"{OUT}/slot{SLOT}-k{frame:03d}.png"
        bpy.ops.render.render(write_still=True)
else:
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = f"{OUT}/slot{SLOT}/k"
    bpy.ops.render.render(animation=True)
print("gotowe")
