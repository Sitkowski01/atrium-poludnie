"""Wnętrze mieszkania z rzutu (plany.json) i panoramy 360° każdego pomieszczenia.

Uruchomienie (zawsze w tle):
  blender --background --python blender/wnetrze.py -- <plany.json> <id, np. s0> <katalog_wyjscia> [indeks|-] [szerokość] [próbki]

Zapisuje <katalog>/<id>/<indeks>.jpg: panoramę równoprostokątną 2:1 z wysokości oczu,
środek obrazu patrzy w stronę wejścia (+Y świata), jak zakłada PanoView na stronie.

Układ: x rzutu -> X, y rzutu (w stronę okien) -> -Y. Ściana z oknami leży na Y = -planH.
Tekstury i modele: blender/assets (node blender/pobierz-zasoby.mjs), Poly Haven, CC0.
"""

import json
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
PLANS, SLOT, OUT = argv[0], argv[1], argv[2]
ONLY = int(argv[3]) if len(argv) > 3 and argv[3] != "-" else None
PANO_W = int(argv[4]) if len(argv) > 4 else 4096
SAMPLES = int(argv[5]) if len(argv) > 5 else 192
HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets")

plan = next(p for p in json.load(open(PLANS, encoding="utf-8")) if p["id"] == SLOT)
W, H = plan["planW"], plan["planH"]
PLAN = plan["plan"]
ROOMS = [r for r in PLAN if r["kind"] != "balkon"]
BALCONY = next((r for r in PLAN if r["kind"] == "balkon"), None)

WALL_H = 2.7
T_OUT = 0.24
T_IN = 0.1
DOOR_W, DOOR_H = 0.9, 2.05
EPS = 1e-6

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


# =====================================================================
# materiały
# =====================================================================
def _bsdf(mat):
    return next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def material(name, color, rough=0.6, metal=0.0, **extra):
    mat = bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except Exception:
        pass
    b = _bsdf(mat)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    for key, val in extra.items():
        try:
            b.inputs[key].default_value = val
        except Exception:
            pass
    return mat


def glass_material(name, tint=(0.9, 0.95, 0.97), rough=0.02):
    mat = material(name, tint, rough, 0.0, **{"Transmission Weight": 1.0, "IOR": 1.45})
    for attr, val in (("surface_render_method", "DITHERED"), ("blend_method", "HASHED")):
        try:
            setattr(mat, attr, val)
        except Exception:
            pass
    return mat


def emission(name, color, strength):
    mat = material(name, color, 0.5, 0.0, **{"Emission Color": (*color, 1), "Emission Strength": strength})
    return mat


def tex_material(name, tex, size_m, tint=None, rough_scale=1.0, normal=1.0, base=None):
    """materiał PBR z tekstury Poly Haven, rzutowany w metrach świata (bez rozwijania UV)"""
    mat = material(name, base or (0.8, 0.8, 0.8))
    nt = mat.node_tree
    b = _bsdf(mat)
    folder = os.path.join(ASSETS, "tex", tex)
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (1 / size_m, 1 / size_m, 1 / size_m)
    nt.links.new(geo.outputs["Position"], mapping.inputs["Vector"])

    def image(file, colorspace):
        path = os.path.join(folder, file)
        if not os.path.exists(path):
            return None
        node = nt.nodes.new("ShaderNodeTexImage")
        node.image = bpy.data.images.load(path, check_existing=True)
        node.image.colorspace_settings.name = colorspace
        node.projection = "BOX"
        node.projection_blend = 0.25
        nt.links.new(mapping.outputs["Vector"], node.inputs["Vector"])
        return node

    diff = image("diff.jpg", "sRGB")
    if diff and base is None:
        if tint:
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            nt.links.new(diff.outputs["Color"], mix.inputs[6])
            mix.inputs[7].default_value = (*tint, 1)
            nt.links.new(mix.outputs[2], b.inputs["Base Color"])
        else:
            nt.links.new(diff.outputs["Color"], b.inputs["Base Color"])
    rough = image("rough.jpg", "Non-Color")
    if rough:
        math_node = nt.nodes.new("ShaderNodeMath")
        math_node.operation = "MULTIPLY"
        math_node.inputs[1].default_value = rough_scale
        nt.links.new(rough.outputs["Color"], math_node.inputs[0])
        nt.links.new(math_node.outputs[0], b.inputs["Roughness"])
    nor = image("nor.jpg", "Non-Color")
    if nor:
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = normal
        nt.links.new(nor.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    return mat


M = {
    # ściany: ciepła biel z fakturą tynku (tylko chropowatość i normalne z tekstury)
    "wall": tex_material("Tynk", "painted_plaster_wall", 1.6, base=(0.86, 0.83, 0.78), normal=0.35),
    "wall_out": tex_material("Tynk zewn", "painted_plaster_wall", 1.6, base=(0.80, 0.77, 0.72), normal=0.35),
    "ceiling": material("Sufit", (0.90, 0.89, 0.86), 0.9),
    "parquet": tex_material("Jodelka", "herringbone_parquet", 1.6, tint=(0.86, 0.82, 0.78), normal=0.6),
    "floor_tile": tex_material("Plyty", "large_floor_tiles_02", 1.8, tint=(0.92, 0.92, 0.92)),
    "bath_floor": tex_material("Plytki lazienka", "large_floor_tiles_02", 1.2, tint=(0.62, 0.60, 0.58)),
    "bath_wall": tex_material("Plytki sciana", "long_white_tiles", 1.2, base=(0.86, 0.85, 0.82), normal=0.6),
    "marble": tex_material("Marmur", "marble_01", 1.4, rough_scale=0.4),
    "boucle": tex_material("Boucle", "wool_boucle", 0.3, base=(0.80, 0.76, 0.68), normal=1.4),
    "boucle_dark": tex_material("Boucle ciemne", "wool_boucle", 0.3, base=(0.24, 0.21, 0.18), normal=1.4),
    "linen": tex_material("Len", "rough_linen", 0.5, base=(0.86, 0.84, 0.80), normal=0.8),
    "linen_ochre": tex_material("Len ochra", "rough_linen", 0.5, base=(0.62, 0.38, 0.15), normal=0.8),
    "curtain": tex_material("Zaslona", "rough_linen", 0.5, base=(0.82, 0.78, 0.70), normal=0.5),
    "rug": tex_material("Dywan", "poly_wool_herringbone", 0.9, tint=(0.82, 0.78, 0.72), normal=1.0),
    "oak": tex_material("Dab", "oak_veneer_01", 1.0, tint=(0.92, 0.82, 0.70), rough_scale=0.8),
    "white": material("Biel mebli", (0.86, 0.85, 0.82), 0.35),
    "front": material("Fronty kuchni", (0.30, 0.33, 0.30), 0.45),
    "black": material("Czern", (0.025, 0.025, 0.028), 0.35, 0.2),
    "brass": material("Mosiadz", (0.80, 0.60, 0.32), 0.25, 1.0),
    "steel": material("Stal", (0.62, 0.62, 0.64), 0.22, 1.0),
    "glass": glass_material("Szklo"),
    "mirror": material("Lustro", (0.86, 0.87, 0.88), 0.03, 1.0),
    "screen": material("Ekran", (0.01, 0.012, 0.015), 0.08, 0.0, **{"Coat Weight": 1.0}),
    "ceramic": material("Ceramika", (0.93, 0.92, 0.89), 0.12),
    "frame": material("Rama okna", (0.12, 0.12, 0.13), 0.4, 0.4),
    "sill": material("Parapet", (0.88, 0.87, 0.84), 0.3),
    "deck": tex_material("Deska tarasowa", "oak_veneer_01", 0.8, tint=(0.62, 0.50, 0.40)),
    "concrete": material("Beton", (0.55, 0.53, 0.50), 0.85),
    "lampwarm": emission("Swiatlo cieple", (1.0, 0.83, 0.62), 6.0),
    "downlight": emission("Oczko", (1.0, 0.92, 0.82), 25.0),

    "ground": material("Ziemia", (0.18, 0.24, 0.14), 1.0),
    "facade_far": material("Sasiednie budynki", (0.70, 0.68, 0.64), 0.85),
}


def art_material(name, colors, scale, kind="WAVE"):
    """abstrakcja: fale albo plamy w trzech kolorach, płótno matowe"""
    mat = material(name, colors[0], 0.85)
    nt = mat.node_tree
    coord = nt.nodes.new("ShaderNodeTexCoord")
    tex = nt.nodes.new("ShaderNodeTexWave" if kind == "WAVE" else "ShaderNodeTexVoronoi")
    tex.inputs["Scale"].default_value = scale
    if kind == "WAVE":
        tex.inputs["Distortion"].default_value = 6.0
        tex.inputs["Detail"].default_value = 1.5
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    ramp.color_ramp.elements[0].color = (*colors[0], 1)
    ramp.color_ramp.elements[1].position = 0.55
    ramp.color_ramp.elements[1].color = (*colors[1], 1)
    el = ramp.color_ramp.elements.new(0.8)
    el.color = (*colors[2], 1)
    nt.links.new(coord.outputs["Object"], tex.inputs["Vector"])
    nt.links.new(tex.outputs[0 if kind == "WAVE" else 1], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], _bsdf(mat).inputs["Base Color"])
    return mat


M["art1"] = art_material("Obraz 1", ((0.86, 0.82, 0.74), (0.62, 0.38, 0.15), (0.10, 0.12, 0.16)), 1.6)
M["art2"] = art_material("Obraz 2", ((0.16, 0.20, 0.26), (0.80, 0.74, 0.64), (0.55, 0.36, 0.18)), 3.0, "VORONOI")


# =====================================================================
# prymitywy i układ
# =====================================================================
def box(name, cx, cy, cz, sx, sy, sz, mat, bevel=0.0, segments=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, cz))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (max(sx, 0.001), max(sy, 0.001), max(sz, 0.001))
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("faza", "BEVEL")
        mod.width = min(bevel, sx / 2.05, sy / 2.05, sz / 2.05)
        mod.segments = segments
        mod.limit_method = "NONE"
    return obj


def soft(obj, level=2):
    """miękka bryła: wygładzenie podziałem i cieniowanie gładkie (poduszki, materace)"""
    mod = obj.modifiers.new("miekko", "SUBSURF")
    mod.levels = level
    mod.render_levels = level
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth()
    return obj


def cylinder(name, cx, cy, cz, r, h, mat, verts=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=(cx, cy, cz))
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj


def inner(r):
    """wewnętrzne lico ścian pomieszczenia: (lewo, góra, prawo, dół) z uwzględnieniem grubości muru"""
    def t(at_edge):
        return T_OUT / 2 if at_edge else T_IN / 2
    return (
        r["x"] + t(abs(r["x"]) < EPS),
        r["y"] + t(abs(r["y"]) < EPS),
        r["x"] + r["w"] - t(abs(r["x"] + r["w"] - W) < EPS),
        r["y"] + r["h"] - t(abs(r["y"] + r["h"] - H) < EPS),
    )


def P(x, y):
    """punkt rzutu -> świat"""
    return x, -y


def pbox(name, x, y, w, d, z0, h, mat, bevel=0.0, segments=3):
    """pudełko zadane prostokątem na rzucie (x, y = lewy górny róg) i wysokością od z0"""
    cx, cy = P(x + w / 2, y + d / 2)
    return box(name, cx, cy, z0 + h / 2, w, d, h, mat, bevel, segments)


def model(asset, x, y, rot=0.0, height=None, width=None, z=0.0):
    """model glTF z Poly Haven: postawiony na podłodze, środkiem w (x, y) rzutu, obrócony o rot stopni"""
    path = os.path.join(ASSETS, "models", asset, f"{asset}.gltf")
    if not os.path.exists(path):
        print("brak modelu", asset)
        return None
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    root = bpy.data.objects.new(f"model {asset}", None)
    scene.collection.objects.link(root)
    for o in new:
        if o.parent is None:
            o.parent = root
    root.rotation_euler = (0, 0, math.radians(rot))
    bpy.context.view_layer.update()

    def bounds():
        pts = [o.matrix_world @ Vector(c) for o in new if o.type == "MESH" for c in o.bound_box]
        lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
        hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        return lo, hi

    lo, hi = bounds()
    k = 1.0
    if height:
        k = height / max(hi.z - lo.z, 1e-6)
    elif width:
        k = width / max(hi.x - lo.x, hi.y - lo.y, 1e-6)
    root.scale = (k, k, k)
    bpy.context.view_layer.update()
    lo, hi = bounds()
    wx, wy = P(x, y)
    root.location += Vector((wx - (lo.x + hi.x) / 2, wy - (lo.y + hi.y) / 2, z - lo.z))
    return root


# =====================================================================
# ściany, otwory, drzwi
# =====================================================================
def wall_h(y, x0, x1, t, mat, opening=None):
    """ściana pozioma na rzucie (stałe y) z opcjonalnym otworem (o0, o1, dół, góra)"""
    if x1 - x0 < EPS:
        return
    if not opening:
        pbox("sciana", x0, y - t / 2, x1 - x0, t, 0, WALL_H, mat)
        return
    o0, o1, zb, zt = opening
    wall_h(y, x0, o0, t, mat)
    wall_h(y, o1, x1, t, mat)
    if zb > EPS:
        pbox("parapet muru", o0, y - t / 2, o1 - o0, t, 0, zb, mat)
    if WALL_H - zt > EPS:
        pbox("nadproze", o0, y - t / 2, o1 - o0, t, zt, WALL_H - zt, mat)


def wall_v(x, y0, y1, t, mat, opening=None):
    if y1 - y0 < EPS:
        return
    if not opening:
        pbox("sciana", x - t / 2, y0, t, y1 - y0, 0, WALL_H, mat)
        return
    o0, o1, zb, zt = opening
    wall_v(x, y0, o0, t, mat)
    wall_v(x, o1, y1, t, mat)
    if zb > EPS:
        pbox("parapet muru", x - t / 2, o0, t, o1 - o0, 0, zb, mat)
    if WALL_H - zt > EPS:
        pbox("nadproze", x - t / 2, o0, t, o1 - o0, zt, WALL_H - zt, mat)


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


INDEX = {id(r): i for i, r in enumerate(PLAN)}
LINK = {}
for l in plan["links"]:
    LINK[(l["from"], l["to"])] = l["type"]
    LINK[(l["to"], l["from"])] = l["type"]

# otwory zapamiętane per pomieszczenie i strona: listwy przypodłogowe je omijają
GAPS = {}  # (indeks pomieszczenia, 'l'|'r'|'u'|'d') -> [(od, do)]
PASSAGES = []  # (indeks pomieszczenia, strona, od, do): przed nimi meble nie mogą stać


def gap(room, side, a, b):
    GAPS.setdefault((INDEX[id(room)], side), []).append((a, b))


def door_leaf(kind, c, mid, into_room, other_room):
    """ościeżnica i skrzydło otwarte o 90° do wnętrza pokoju (nie do holu)"""
    t = T_IN + 0.04
    a, b = mid - DOOR_W / 2, mid + DOOR_W / 2
    if kind == "v":
        for yy in (a - 0.05, b):
            pbox("oscieznica", c - t / 2, yy, t, 0.05, 0, DOOR_H + 0.05, M["white"], 0.005)
        pbox("oscieznica", c - t / 2, a - 0.05, t, DOOR_W + 0.1, DOOR_H, 0.05, M["white"], 0.005)
        side = 1 if into_room["x"] >= c - EPS else -1
        pbox("skrzydlo", c + side * 0.03 if side > 0 else c - 0.03 - 0.04, b - 0.04, 0.04, 0.04, 0, DOOR_H - 0.01, M["white"])
        leaf = pbox("skrzydlo", (c + 0.02) if side > 0 else (c - 0.02 - (DOOR_W - 0.06)), b - 0.045, DOOR_W - 0.06, 0.04, 0, DOOR_H - 0.01, M["white"], 0.004)
        hx = (c + DOOR_W - 0.16) if side > 0 else (c - DOOR_W + 0.16)
        pbox("klamka", hx - 0.01, b - 0.12, 0.02, 0.14, 1.02, 0.02, M["black"], 0.006)
    else:
        for xx in (a - 0.05, b):
            pbox("oscieznica", xx, c - t / 2, 0.05, t, 0, DOOR_H + 0.05, M["white"], 0.005)
        pbox("oscieznica", a - 0.05, c - t / 2, DOOR_W + 0.1, t, DOOR_H, 0.05, M["white"], 0.005)
        side = 1 if into_room["y"] >= c - EPS else -1
        leaf = pbox("skrzydlo", b - 0.045, (c + 0.02) if side > 0 else (c - 0.02 - (DOOR_W - 0.06)), 0.04, DOOR_W - 0.06, 0, DOOR_H - 0.01, M["white"], 0.004)
        hy = (c + DOOR_W - 0.16) if side > 0 else (c - DOOR_W + 0.16)
        pbox("klamka", b - 0.12, hy - 0.01, 0.14, 0.02, 1.02, 0.02, M["black"], 0.006)
    return leaf


def side_of(room, kind, c):
    if kind == "v":
        return "l" if abs(room["x"] - c) < EPS else "r"
    return "u" if abs(room["y"] - c) < EPS else "d"


for i, a in enumerate(ROOMS):
    for b in ROOMS[i + 1 :]:
        s = shared(a, b)
        if not s:
            continue
        kind, c, t0, t1 = s
        link = LINK.get((INDEX[id(a)], INDEX[id(b)]))
        if link == "otwarte":
            gap(a, side_of(a, kind, c), t0, t1)
            gap(b, side_of(b, kind, c), t0, t1)
            continue
        opening = None
        mid = (t0 + t1) / 2
        if link == "drzwi":
            opening = (mid - DOOR_W / 2, mid + DOOR_W / 2, 0, DOOR_H)
            # skrzydło otwiera się do pokoju, nie na komunikację
            into, other = (b, a) if a["kind"] == "hol" else (a, b)
            door_leaf(kind, c, mid, into, other)
        elif link == "przejscie":
            ow = min(t1 - t0 - 0.2, 1.6)
            opening = (mid - ow / 2, mid + ow / 2, 0, 2.3)
        if opening:
            gap(a, side_of(a, kind, c), opening[0], opening[1])
            gap(b, side_of(b, kind, c), opening[0], opening[1])
            PASSAGES.append((INDEX[id(a)], side_of(a, kind, c), opening[0], opening[1]))
            PASSAGES.append((INDEX[id(b)], side_of(b, kind, c), opening[0], opening[1]))
        (wall_v if kind == "v" else wall_h)(c, t0, t1, T_IN, M["wall"], opening)

# ściany zewnętrzne i wejście
wall_v(0, 0, H, T_OUT, M["wall_out"])
wall_v(W, 0, H, T_OUT, M["wall_out"])
hol = next(r for r in ROOMS if r["kind"] == "hol")
entry = hol["x"] + hol["w"] / 2
wall_h(0, 0, W, T_OUT, M["wall_out"], (entry - DOOR_W / 2, entry + DOOR_W / 2, 0, DOOR_H))
gap(hol, "u", entry - DOOR_W / 2, entry + DOOR_W / 2)
PASSAGES.append((INDEX[id(hol)], "u", entry - DOOR_W / 2, entry + DOOR_W / 2))
pbox("drzwi wejsciowe", entry - DOOR_W / 2, -0.06, DOOR_W, 0.07, 0, DOOR_H, M["front"], 0.005)
pbox("klamka", entry + DOOR_W / 2 - 0.18, 0.01, 0.14, 0.03, 1.02, 0.025, M["brass"], 0.008)

# ściana okienna
WINDOWS = []  # (pokój, o0, o1, zb, zt)
for r in sorted((r for r in ROOMS if abs(r["y"] + r["h"] - H) < EPS), key=lambda r: r["x"]):
    if r["kind"] in ("salon", "sypialnia"):
        full = r["kind"] == "salon"
        ow = r["w"] * (0.72 if full else 0.55)
        o0 = r["x"] + (r["w"] - ow) / 2
        zb, zt = (0.0, 2.5) if full else (0.85, 2.4)
        wall_h(H, r["x"], r["x"] + r["w"], T_OUT, M["wall_out"], (o0, o0 + ow, zb, zt))
        WINDOWS.append((r, o0, o0 + ow, zb, zt))
        if full:
            gap(r, "d", o0, o0 + ow)
        glass = pbox("szyba", o0, H + 0.02, ow, 0.03, zb, zt - zb, M["glass"])
        glass.visible_shadow = False
        for fx in (o0, o0 + ow - 0.06, o0 + ow / 2 - 0.03):
            pbox("rama", fx, H - 0.0, 0.06, 0.09, zb, zt - zb, M["frame"], 0.004)
        pbox("rama", o0, H, ow, 0.09, zt - 0.06, 0.06, M["frame"], 0.004)
        pbox("rama", o0, H, ow, 0.09, zb, 0.06, M["frame"], 0.004)
        if not full:
            pbox("parapet", o0 - 0.05, H - 0.14, ow + 0.1, 0.18, zb - 0.03, 0.03, M["sill"], 0.006)
    else:
        wall_h(H, r["x"], r["x"] + r["w"], T_OUT, M["wall_out"])


# =====================================================================
# podłogi, sufit, listwy, oświetlenie sufitowe
# =====================================================================
FLOOR = {"salon": "parquet", "sypialnia": "parquet", "hol": "floor_tile", "kuchnia": "floor_tile", "lazienka": "bath_floor"}
for r in ROOMS:
    mat = M[FLOOR[r["kind"]]]
    # kuchnia otwarta na salon: parkiet aż do frontów, płytki tylko pod zabudową
    pbox("podloga " + r["label"], r["x"], r["y"], r["w"], r["h"], -0.1, 0.1, mat)

ceiling = pbox("sufit", -0.3, -0.3, W + 0.6, H + 0.6, WALL_H, 0.12, M["ceiling"])


def baseboards(room, index):
    if room["kind"] == "lazienka":
        return
    x, y, w, h = room["x"], room["y"], room["w"], room["h"]
    inset = T_IN / 2
    sides = {
        "u": ("h", y + inset, x, x + w),
        "d": ("h", y + h - (T_OUT / 2 if abs(y + h - H) < EPS else inset) - 0.012, x, x + w),
        "l": ("v", x + (T_OUT / 2 if abs(x) < EPS else inset), y, y + h),
        "r": ("v", x + w - (T_OUT / 2 if abs(x + w - W) < EPS else inset) - 0.012, y, y + h),
    }
    for side, (kind, at, a, b) in sides.items():
        cuts = sorted(GAPS.get((index, side), []))
        pos = a
        for g0, g1 in cuts + [(b, b)]:
            if g0 - pos > 0.08:
                if kind == "h":
                    pbox("listwa", pos, at, g0 - pos, 0.012, 0, 0.08, M["white"])
                else:
                    pbox("listwa", at, pos, 0.012, g0 - pos, 0, 0.08, M["white"])
            pos = max(pos, g1)


for r in ROOMS:
    baseboards(r, INDEX[id(r)])


def downlight(x, y):
    cx, cy = P(x, y)
    cylinder("oczko", cx, cy, WALL_H - 0.005, 0.045, 0.01, M["downlight"], 24)
    spot = bpy.data.lights.new("oczko", "SPOT")
    spot.energy = 35
    spot.spot_size = math.radians(85)
    spot.spot_blend = 0.6
    spot.shadow_soft_size = 0.05
    spot.color = (1.0, 0.88, 0.74)
    obj = bpy.data.objects.new("oczko", spot)
    obj.location = (cx, cy, WALL_H - 0.03)
    scene.collection.objects.link(obj)


for r in ROOMS:
    if r["kind"] in ("hol", "lazienka", "kuchnia"):
        nx = max(1, round(r["w"] / 1.6))
        ny = max(1, round(r["h"] / 1.6))
        for i in range(nx):
            for j in range(ny):
                downlight(r["x"] + r["w"] * (i + 0.5) / nx, r["y"] + r["h"] * (j + 0.5) / ny)


# =====================================================================
# meble i wyposażenie
# =====================================================================
def curtains(r, o0, o1, zt):
    """lniane zasłony po obu stronach okna, z fałdami"""
    for xa in (o0 - 0.42, o1 + 0.04):
        cx, cy = P(xa + 0.19, H - T_OUT / 2 - 0.12)
        bpy.ops.mesh.primitive_plane_add(size=1, location=(cx, cy, (zt + 0.12) / 2 + 0.03))
        c = bpy.context.active_object
        c.name = "zaslona"
        c.rotation_euler = (math.radians(90), 0, 0)
        c.scale = (0.38, zt + 0.06, 1)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.subdivide(number_cuts=28)
        bpy.ops.object.mode_set(mode="OBJECT")
        c.data.materials.append(M["curtain"])
        tex = bpy.data.textures.new("faldy", "WOOD")
        tex.wood_type = "BANDS"
        tex.noise_basis_2 = "SIN"
        tex.turbulence = 0.0
        disp = c.modifiers.new("faldy", "DISPLACE")
        disp.texture = tex
        disp.texture_coords = "LOCAL"
        disp.strength = 0.06
        disp.direction = "Y"
        sol = c.modifiers.new("grubosc", "SOLIDIFY")
        sol.thickness = 0.006
        bpy.ops.object.shade_smooth()
    # karnisz
    pbox("karnisz", o0 - 0.45, H - T_OUT / 2 - 0.13, (o1 - o0) + 0.9, 0.02, zt + 0.1, 0.02, M["black"], 0.006)


def books(x, y, length, z, depth=0.2):
    """rząd książek o różnej wysokości i kolorze"""
    palette = [(0.55, 0.42, 0.30), (0.20, 0.25, 0.30), (0.78, 0.74, 0.66), (0.42, 0.18, 0.12), (0.30, 0.34, 0.26)]
    pos = x
    k = 0
    while pos < x + length - 0.03:
        th = 0.025 + (k * 7 % 5) * 0.006
        hh = 0.19 + (k * 11 % 6) * 0.015
        mat = M.setdefault(f"ksiazka{k % 5}", material(f"Ksiazka {k % 5}", palette[k % 5], 0.7))
        pbox("ksiazka", pos, y, th, depth, z, hh, mat, 0.003)
        pos += th + 0.003
        k += 1


def table_lamp(x, y, z):
    cx, cy = P(x, y)
    cylinder("lampka podstawa", cx, cy, z + 0.14, 0.07, 0.28, M["ceramic"])
    shade = cylinder("lampka klosz", cx, cy, z + 0.38, 0.15, 0.2, M["linen"], 40)
    shade.modifiers.new("cienki", "SOLIDIFY").thickness = 0.004
    glow = bpy.data.lights.new("lampka", "POINT")
    glow.energy = 18
    glow.color = (1.0, 0.78, 0.52)
    glow.shadow_soft_size = 0.06
    obj = bpy.data.objects.new("lampka", glow)
    obj.location = (cx, cy, z + 0.36)
    scene.collection.objects.link(obj)


def artwork(x0, y0, along, wall_side, z, w=0.7, h=0.9, mat="art1"):
    """obraz w cienkiej czarnej ramie na ścianie"""
    d = 0.03
    if along == "x":
        yy = y0 if wall_side == "u" else y0 - d
        pbox("rama obrazu", x0, yy, w, d, z, h, M["black"], 0.004)
        pbox("obraz", x0 + 0.05, yy + (d if wall_side == "u" else -0.002), w - 0.1, 0.004, z + 0.05, h - 0.1, M[mat])
    else:
        xx = x0 if wall_side == "l" else x0 - d
        pbox("rama obrazu", xx, y0, d, w, z, h, M["black"], 0.004)
        pbox("obraz", xx + (d if wall_side == "l" else -0.002), y0 + 0.05, 0.004, w - 0.1, z + 0.05, h - 0.1, M[mat])


def sofa(x, y, length, depth=0.95, facing="r"):
    """sofa w bukli, oparcie przy ścianie po lewej (facing 'r') — x, y = lewy górny róg na rzucie"""
    pbox("sofa rama", x, y, depth, length, 0.08, 0.32, M["boucle"], 0.06, 4)
    pbox("sofa oparcie", x, y, 0.22, length, 0.08, 0.78, M["boucle"], 0.08, 4)
    for yy in (y, y + length - 0.2):
        pbox("sofa bok", x, yy, depth, 0.2, 0.08, 0.6, M["boucle"], 0.08, 4)
    n = 2 if length < 2.3 else 3
    seat = (length - 0.44) / n
    for k in range(n):
        soft(pbox("siedzisko", x + 0.22, y + 0.21 + k * seat + 0.01, depth - 0.24, seat - 0.02, 0.38, 0.17, M["boucle"], 0.04, 2), 1)
        soft(pbox("poduszka oparcia", x + 0.2, y + 0.21 + k * seat + 0.02, 0.2, seat - 0.04, 0.55, 0.42, M["boucle"], 0.06, 2), 1)
    soft(pbox("poduszka", x + 0.36, y + 0.32, 0.13, 0.42, 0.55, 0.4, M["linen_ochre"], 0.05, 2), 1)
    for yy in (y + 0.05, y + length - 0.1):
        for xx in (x + 0.05, x + depth - 0.1):
            pbox("noga sofy", xx, yy, 0.05, 0.05, 0, 0.08, M["black"])


def dining_chair(x, y, facing):
    """krzesło: dąb i siedzisko w bukli; facing 'u' = oparcie od góry rzutu"""
    pbox("siedzisko krzesla", x - 0.22, y - 0.22, 0.44, 0.44, 0.44, 0.06, M["boucle_dark"], 0.02, 3)
    by = y - 0.22 if facing == "u" else y + 0.17
    pbox("oparcie krzesla", x - 0.2, by, 0.4, 0.05, 0.62, 0.22, M["oak"], 0.02, 3)
    for dx in (-0.2, 0.17):
        for dy in (-0.2, 0.17):
            pbox("noga krzesla", x + dx, y + dy, 0.03, 0.03, 0, 0.44, M["oak"], 0.006)
    for dx in (-0.2, 0.17):
        pbox("slupek oparcia", x + dx, by + 0.01, 0.03, 0.03, 0.44, 0.4, M["oak"], 0.006)


def furnish_salon(r):
    x, y, w, h = r["x"], r["y"], r["w"], r["h"]
    length = min(2.4, h - 1.6)
    # sofa nie może wchodzić w strefę przed przejściem przy górnej ścianie
    sy = max(y + h * 0.5, inner(r)[1] + 0.95 + length / 2)
    sofa(inner(r)[0] + 0.02, sy - length / 2, length)
    pbox("dywan", x + 0.75, sy - 1.25, min(2.4, w - 1.3), 2.5, 0.0, 0.012, M["rug"], 0.004)
    model("coffee_table_round_01", x + 1.75, sy, 0, height=0.4)
    model("ceramic_vase_01", x + 1.6, sy - 0.1, 0, height=0.3, z=0.4)
    # ściana RTV: szafka z lamelami i ekran
    right = inner(r)[2]
    model("modern_wooden_cabinet", right - 0.24, sy, 90, width=1.8)
    pbox("telewizor", right - 0.035, sy - 0.7, 0.03, 1.4, 1.05, 0.8, M["screen"], 0.006)
    pbox("ramka tv", right - 0.04, sy - 0.71, 0.01, 1.42, 1.04, 0.82, M["black"], 0.004)
    # fotel przy oknie, roślina, lampa nad stolikiem, obraz nad sofą
    model("mid_century_lounge_chair", x + w * 0.62, y + h - 1.1, 200, height=0.95)
    model("potted_plant_02", x + w - 0.45, y + h - 0.55, 0, height=1.25)
    model("potted_plant_04", x + 0.45, y + h - 0.45, 0, height=0.55)
    model("modern_ceiling_lamp_01", x + 1.75, sy, 0, height=0.6, z=WALL_H - 0.6)
    artwork(inner(r)[0] + 0.002, sy - 0.55, "y", "l", 1.25, 1.1, 0.8, "art1")


def furnish_bedroom(r):
    x, y, w, h = r["x"], r["y"], r["w"], r["h"]
    if r["label"] == "Pokój" and min(w, h) < 2.3:
        # wąski pokój: pojedyncze łóżko wzdłuż ściany, biurko pod oknem
        l, t, rr, b = inner(r)
        pbox("lozko rama", l + 0.02, t + 0.9, 0.95, 2.05, 0.08, 0.26, M["boucle"], 0.05, 4)
        soft(pbox("materac", l + 0.06, t + 0.94, 0.87, 1.97, 0.34, 0.2, M["linen"], 0.06, 2), 1)
        soft(pbox("koldra", l + 0.04, t + 1.4, 0.91, 1.5, 0.5, 0.08, M["linen"], 0.04, 2), 1)
        pbox("narzuta", l + 0.0, t + 2.45, 0.99, 0.45, 0.55, 0.04, M["linen_ochre"], 0.02)
        soft(pbox("poduszka", l + 0.14, t + 0.98, 0.7, 0.4, 0.54, 0.16, M["linen"], 0.06, 2), 2)
        model("side_table_01", l + 0.3, t + 0.5, 0, height=0.5)
        table_lamp(l + 0.3, t + 0.5, 0.5)
        dw = min(1.2, rr - l - 1.2)
        pbox("biurko", rr - dw - 0.02, b - 0.62, dw, 0.6, 0.72, 0.035, M["oak"], 0.008)
        for dx in (0.03, dw - 0.07):
            pbox("noga biurka", rr - dw - 0.02 + dx, b - 0.6, 0.04, 0.56, 0, 0.72, M["black"])
        dining_chair(rr - dw / 2 - 0.02, b - 0.95, "u")
        model("desk_lamp_arm_01", rr - 0.25, b - 0.4, 200, height=0.5, z=0.755)
        books(rr - dw + 0.1, b - 0.6, 0.35, 0.755, 0.18)
        artwork(l + 0.002, t + 1.3, "y", "l", 1.3, 0.9, 0.6, "art1")
        return
    if r["label"] == "Gabinet" or min(w, h) < 2.3:
        # biurko przy ścianie zewnętrznej, z dala od drzwi; regał przy przeciwległej
        l, t, rr, b = inner(r)
        dd = min(1.3, b - t - 0.3)
        pbox("biurko", rr - 0.65, t + 0.15, 0.65, dd, 0.72, 0.035, M["oak"], 0.008)
        for dy in (0.03, dd - 0.07):
            pbox("noga biurka", rr - 0.62, t + 0.15 + dy, 0.59, 0.04, 0, 0.72, M["black"])
        dining_chair(rr - 0.95, t + 0.15 + dd / 2, "u")
        model("desk_lamp_arm_01", rr - 0.3, t + 0.35, 120, height=0.5, z=0.755)
        books(rr - 0.6, t + 0.15 + dd - 0.45, 0.4, 0.755, 0.18)
        model("wooden_display_shelves_01", l + 0.25, t + 0.7, 90, height=1.4)
        return
    bw = 1.6 if w >= 2.6 else 1.4
    by = y + h * 0.58 - bw / 2
    pbox("lozko rama", x + 0.1, by, 2.1, bw, 0.08, 0.26, M["boucle"], 0.05, 4)
    soft(pbox("materac", x + 0.16, by + 0.04, 1.98, bw - 0.08, 0.34, 0.2, M["linen"], 0.06, 2), 1)
    soft(pbox("koldra", x + 0.62, by + 0.01, 1.54, bw - 0.02, 0.5, 0.08, M["linen"], 0.04, 2), 1)
    pbox("narzuta", x + 1.55, by - 0.02, 0.5, bw + 0.04, 0.55, 0.04, M["linen_ochre"], 0.02)
    pbox("zaglowek", x + 0.04, by - 0.08, 0.12, bw + 0.16, 0.08, 1.15, M["boucle"], 0.05, 4)
    for py in (by + 0.1, by + bw / 2 + 0.02):
        soft(pbox("poduszka", x + 0.22, py, 0.42, bw / 2 - 0.12, 0.54, 0.16, M["linen"], 0.06, 2), 2)
    for py in (by - 0.55, by + bw + 0.08):
        model("side_table_01", x + 0.3, py + 0.24, 0, height=0.5)
        table_lamp(x + 0.3, py + 0.24, 0.5)
    model("standing_picture_frame_01", x + 0.25, by + bw + 0.3, 90, height=0.22, z=0.5)
    pbox("dywan", x + 0.9, by - 0.4, min(1.8, w - 1.0), bw + 0.8, 0, 0.012, M["rug"], 0.004)
    if h > 4.2:
        ww = min(1.8, h * 0.32)
        pbox("szafa", x + w - 0.64, y + T_IN / 2, 0.6, ww, 0, 2.4, M["white"], 0.004)
        for k in range(3):
            pbox("uchwyt", x + w - 0.66, y + T_IN / 2 + ww * (k + 1) / 3 - 0.06, 0.02, 0.012, 0.9, 0.4, M["brass"], 0.004)
    model("potted_plant_01", x + w - 0.35, y + h - 0.4, 0, height=0.9)
    artwork(x + T_IN / 2 + 0.002, by + bw / 2 - 0.4, "y", "l", 1.4, 0.8, 0.6, "art2")


def furnish_kitchen(r):
    x, y, w, h = r["x"], r["y"], r["w"], r["h"]
    top = inner(r)[1]  # górna ściana bywa zewnętrzna (grubsza)
    run = w - 0.24 - 0.65
    # zabudowa dolna: fronty z wąskimi szczelinami i czarnymi uchwytami krawędziowymi
    pbox("korpus", x + 0.12, top, run, 0.58, 0.1, 0.76, M["front"])
    pbox("cokol", x + 0.12, top + 0.04, run, 0.5, 0, 0.1, M["black"])
    n = max(2, round(run / 0.6))
    for k in range(n):
        fx = x + 0.12 + k * run / n
        pbox("front", fx + 0.002, top + 0.58, run / n - 0.004, 0.02, 0.1, 0.76, M["front"], 0.002)
        pbox("uchwyt", fx + 0.08, top + 0.6, run / n - 0.16, 0.012, 0.84, 0.012, M["black"])
    pbox("blat", x + 0.1, top - 0.01, run + 0.04, 0.63, 0.86, 0.035, M["marble"], 0.004)
    pbox("plecy", x + 0.12, top, run, 0.012, 0.895, 0.6, M["marble"])
    pbox("plyta indukcyjna", x + 0.5, top + 0.08, 0.6, 0.5, 0.895, 0.006, M["screen"], 0.003)
    pbox("zlew", x + 0.12 + run - 0.85, top + 0.1, 0.55, 0.42, 0.85, 0.05, M["steel"], 0.02)
    cx, cy = P(x + 0.12 + run - 0.58, top + 0.06)
    cylinder("bateria", cx, cy, 1.05, 0.015, 0.32, M["black"])
    pbox("okap", x + 0.5, top, 0.6, 0.45, 1.55, 0.08, M["black"], 0.004)
    # szafki górne i otwarta półka z dębu
    pbox("szafki gorne", x + 1.2, top, run - 1.2, 0.34, 1.55, 0.75, M["front"], 0.003)
    pbox("polka", x + 0.12, top, 1.0, 0.25, 1.55, 0.03, M["oak"], 0.004)
    model("ceramic_vase_01", x + 0.4, top + 0.12, 0, height=0.2, z=1.58)
    # słupek z lodówką
    pbox("slupek", x + w - 0.77, top, 0.65, 0.62, 0, 2.3, M["front"], 0.003)
    pbox("uchwyt", x + w - 0.73, top + 0.63, 0.012, 0.012, 0.9, 0.9, M["black"])
    pbox("pas swiatla", x + 0.14, top + 0.25, run - 0.04, 0.02, 1.53, 0.01, M["lampwarm"])
    # stół z krzesłami i lampy nad nim
    if h >= 2.2 and w >= 3.0:  # w wąskiej kuchni stół zastawiłby drzwi; je się w salonie
        tw = min(1.6, w - 1.0)
        tx, ty = x + (w - tw) / 2 + 0.05, y + h - 1.0
        pbox("stol blat", tx, ty, tw, 0.85, 0.72, 0.04, M["oak"], 0.01)
        for dx in (0.08, tw - 0.14):
            pbox("stol noga", tx + dx, ty + 0.1, 0.06, 0.65, 0, 0.72, M["oak"], 0.006)
        for cxp in (tx + tw * 0.28, tx + tw * 0.72):
            dining_chair(cxp, ty - 0.22, "u")
            dining_chair(cxp, ty + 1.07, "d")
        model("ceramic_vase_01", tx + tw / 2, ty + 0.42, 0, height=0.28, z=0.76)
        for lx in (tx + tw * 0.3, tx + tw * 0.7):
            model("modern_ceiling_lamp_01", lx, ty + 0.42, 0, height=0.55, z=WALL_H - 0.55)


def furnish_bath(r):
    """łazienka układana względem drzwi: drzwi zawsze w bocznej ścianie (z holu),
    kabina i grzejnik w kącie dalekim od wejścia; dla drzwi po lewej układ jest lustrzany"""
    x, y, w, h = r["x"], r["y"], r["w"], r["h"]
    # prawdziwe lica ścian: zewnętrzne są grubsze niż działowe
    L, T, R, B = inner(r)
    index = INDEX[id(r)]
    mirror_x = any(p[0] == index and p[1] == "l" for p in PASSAGES)
    ins_l = (L - x) if not mirror_x else (x + w - R)  # odsunięcie od lokalnej lewej ściany
    ins_r = (x + w - R) if not mirror_x else (L - x)  # od lokalnej prawej

    def X(lx, width=0.0):
        """lokalne x (drzwi po prawej) -> x rzutu, z odbiciem gdy drzwi są po lewej"""
        return x + lx if not mirror_x else x + w - lx - width

    # płytki na ścianach do 2,1 m
    for (bx, by, bw, bd) in (
        (L, T, R - L, 0.01),
        (L,B - 0.01, R - L, 0.01),
        (L, T, 0.01,B - T),
        (R - 0.01, T, 0.01,B - T),
    ):
        pbox("plytki", bx, by, bw, bd, 0, 2.1, M["bath_wall"])
    # kabina w dolnym rogu po stronie przeciwnej do drzwi, szklana ścianka od strony pokoju
    sw = min(0.9, w * 0.42)
    sd = min(0.95, h * 0.42)
    sy = B - sd
    shower = w >= 1.9  # w łazience węższej niż 1,9 m kabina zablokowałaby wejście
    if not shower:
        sw = 0.0
    if shower:
      pbox("kabina brodzik", X(ins_l, sw), sy, sw, sd, 0, 0.03, M["bath_floor"], 0.004)
      glass = pbox("kabina scianka", X(ins_l + sw, 0.01), sy, 0.01, sd, 0.03, 1.95, M["glass"])
      glass.visible_shadow = False
      pbox("kabina profil", X(ins_l + sw - 0.005, 0.02), sy - 0.02, 0.02, 0.02, 0.03, 1.95, M["black"])
      cx, cy = P(X(ins_l + sw / 2), B - 0.3)
      cylinder("kabina deszczownica", cx, cy, 2.12, 0.14, 0.01, M["black"])
      pbox("kabina ramie", X(ins_l + sw / 2 - 0.01, 0.02), B - 0.3, 0.02, 0.3, 2.12, 0.02, M["black"])
    # szafka podwieszana z umywalką i okrągłym lustrem przy górnej ścianie, od strony kabiny
    vw = min(0.9, w - 1.2)
    vx = X(ins_l + 0.1, vw)
    pbox("szafka", vx, T, vw, 0.46, 0.45, 0.4, M["oak"], 0.006)
    pbox("blat umywalki", vx, T, vw, 0.48, 0.85, 0.03, M["marble"], 0.004)
    cx, cy = P(vx + vw / 2, T + 0.25)
    bowl = cylinder("umywalka", cx, cy, 0.94, 0.2, 0.14, M["ceramic"], 48)
    bowl.modifiers.new("faza", "BEVEL").width = 0.02
    cx2, cy2 = P(vx + vw / 2, T + 0.012)
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.32, depth=0.02, location=(cx2, cy2 - 0.01, 1.55))
    mirror = bpy.context.active_object
    mirror.name = "lustro lazienka"
    mirror.rotation_euler = (math.radians(90), 0, 0)
    mirror.data.materials.append(M["mirror"])
    # czarna rama i ciepła poświata za lustrem: samo lustro odbija ścianę i znika z kadru
    bpy.ops.mesh.primitive_torus_add(major_radius=0.33, minor_radius=0.014, location=(cx2, cy2 - 0.02, 1.55), rotation=(math.radians(90), 0, 0))
    bpy.context.active_object.name = "lustro rama"
    bpy.context.active_object.data.materials.append(M["black"])
    bpy.ops.mesh.primitive_torus_add(major_radius=0.36, minor_radius=0.01, location=(cx2, cy2 - 0.004, 1.55), rotation=(math.radians(90), 0, 0))
    bpy.context.active_object.name = "lustro led"
    bpy.context.active_object.data.materials.append(M["lampwarm"])
    # bateria nad umywalką
    tx, ty = P(vx + vw / 2, T + 0.06)
    cylinder("bateria", tx, ty, 1.08, 0.014, 0.22, M["black"], 16)
    pbox("wylewka", vx + vw / 2 - 0.012, T + 0.06, 0.024, 0.16, 1.17, 0.02, M["black"], 0.006)
    # WC podwieszane przy górnej ścianie, po stronie drzwi (drzwi są niżej, w ścianie bocznej)
    if shower:
        wx = X(w - ins_r - 0.5, 0.38)
        pbox("wc", wx, T + 0.14, 0.38, 0.44, 0.38, 0.12, M["ceramic"], 0.05)
        pbox("wc", wx + 0.02, T, 0.34, 0.2, 0.38, 0.4, M["ceramic"], 0.03)
    else:
        # mała łazienka: WC pod ścianą naprzeciw drzwi, w dolnym rogu
        wx = X(ins_l, 0.2)
        pbox("wc", X(ins_l + 0.2, 0.44), B - 0.7, 0.44, 0.38, 0.38, 0.12, M["ceramic"], 0.05)
        pbox("wc", wx, B - 0.68, 0.2, 0.34, 0.38, 0.4, M["ceramic"], 0.03)
    # grzejnik z ręcznikiem na ścianie przeciwnej do drzwi, między szafką a kabiną
    gy = T + 0.6
    if sy - gy > 0.6:
        pbox("grzejnik", X(ins_l, 0.03), gy, 0.03, 0.55, 0.6, 1.1, M["black"], 0.006)
        pbox("recznik", X(ins_l + 0.03, 0.04), gy + 0.08, 0.04, 0.4, 0.95, 0.6, M["linen"], 0.01)
    model("wicker_basket_01", X(w - ins_r - 0.3), B - 0.3, 0, height=0.3)


def furnish_hall(r):
    x, y, w, h = r["x"], r["y"], r["w"], r["h"]
    if r["label"] == "Korytarz":
        pbox("chodnik", x + 0.3, y + 0.25, w - 0.6, h - 0.5, 0, 0.01, M["rug"], 0.004)
        for k in range(2):
            artwork(x + 0.6 + k * 1.3, y + T_IN / 2 + 0.002, "x", "u", 1.25, 0.8, 0.6, "art1" if k else "art2")
        return
    # szafa i ławka tylko na ścianach bez drzwi; gdy takich nie ma, hol zostaje pusty
    index = INDEX[id(r)]
    l, t, rr, b = inner(r)
    free = [side for side in ("l", "r") if not GAPS.get((index, side))]
    ww = min(1.2, h - 0.6)
    if "l" in free:
        pbox("szafa", l, t + 0.3, 0.6, ww, 0, 2.4, M["white"], 0.004)
        pbox("uchwyt", l + 0.6, t + 0.3 + ww / 2 - 0.03, 0.012, 0.012, 0.9, 0.5, M["brass"])
    if "r" in free:
        pbox("lawka", rr - 0.4, t + h * 0.35, 0.38, min(1.0, h * 0.4), 0.0, 0.45, M["oak"], 0.01)
        pbox("lustro", rr - 0.02, t + h * 0.35 + 0.05, 0.015, 0.5, 0.6, 1.4, M["mirror"])
    pbox("wycieraczka", entry - 0.45, y + 0.12, 0.9, 0.5, 0, 0.012, M["boucle_dark"], 0.004)


FURNISH = {"salon": furnish_salon, "sypialnia": furnish_bedroom, "kuchnia": furnish_kitchen, "lazienka": furnish_bath, "hol": furnish_hall}
for r in ROOMS:
    FURNISH[r["kind"]](r)
for (r, o0, o1, zb, zt) in WINDOWS:
    curtains(r, o0, o1, zt)

# ---------- kontrola kolizji: przejścia i kamery muszą być wolne ----------
STRUCTURE = ("sciana", "nadproze", "parapet", "podloga", "sufit", "listwa", "oscieznica", "skrzydlo", "klamka",
             "drzwi wejsciowe", "szyba", "rama", "zaslona", "karnisz", "plytki", "oczko", "balkon", "deski",
             "balustrada", "porecz", "ziemia", "obraz", "wycieraczka", "dywan", "chodnik", "pas swiatla")
CLEAR = 0.9  # tyle wolnego miejsca przed drzwiami, w obu pomieszczeniach


def keepouts():
    zones = []
    for index, side, a, b in PASSAGES:
        r = PLAN[index]
        l, t, rr, bb = inner(r)
        # w małych pokojach strefa przed drzwiami jest płytsza, ale zawsze co najmniej 60 cm
        CLEAR = max(0.6, min(0.9, 0.42 * ((rr - l) if side in ("l", "r") else (bb - t))))
        if side == "u":
            zones.append((a, t, b, t + CLEAR, 0.0, 2.1))
        elif side == "d":
            zones.append((a, bb - CLEAR, b, bb, 0.0, 2.1))
        elif side == "l":
            zones.append((l, a, l + CLEAR, b, 0.0, 2.1))
        else:
            zones.append((rr - CLEAR, a, rr, b, 0.0, 2.1))
    for i, v in enumerate(plan["views"]):
        if PLAN[i]["kind"] == "balkon":
            continue
        # walec wokół oka kamery: nic wyższego niż 1,2 m nie może tu stać
        zones.append((v["x"] - 0.25, v["y"] - 0.25, v["x"] + 0.25, v["y"] + 0.25, 1.3, 1.9))
    return zones


def plan_bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == "MESH" for c in o.bound_box]
    if not pts:
        return None
    xs = [p.x for p in pts]
    ys = [-p.y for p in pts]  # świat -> rzut
    zs = [p.z for p in pts]
    return min(xs), min(ys), max(xs), max(ys), min(zs), max(zs)


def overlaps(bb, zone):
    x0, y0, x1, y1, z0, z1 = bb
    a0, b0, a1, b1, c0, c1 = zone
    m = 0.06  # dotknięcie krawędzią to jeszcze nie kolizja
    return x0 < a1 - m and x1 > a0 + m and y0 < b1 - m and y1 > b0 + m and z0 < c1 and z1 > c0


bpy.context.view_layer.update()
ZONES = keepouts()
removed = []
groups = []
for o in list(scene.objects):
    if o.parent is None and o.type == "EMPTY" and o.name.startswith("model "):
        groups.append((o.name, [o] + list(o.children_recursive)))
    elif o.parent is None and o.type == "MESH" and not o.name.startswith(STRUCTURE):
        groups.append((o.name, [o]))
for name, objs in groups:
    bb = plan_bounds(objs)
    if bb and any(overlaps(bb, z) for z in ZONES):
        removed.append(name)
        for o in objs:
            bpy.data.objects.remove(o, do_unlink=True)
print("usuniete z przejsc i miejsc kamery:", ", ".join(removed) if removed else "nic")

if BALCONY:
    b = BALCONY
    pbox("balkon plyta", b["x"], b["y"], b["w"], b["h"], -0.22, 0.2, M["concrete"], 0.01)
    pbox("deski", b["x"] + 0.05, b["y"] + 0.05, b["w"] - 0.1, b["h"] - 0.1, -0.02, 0.025, M["deck"], 0.003)
    for args in ((b["x"], b["y"] + b["h"] - 0.03, b["w"], 0.03), (b["x"], b["y"], 0.03, b["h"]), (b["x"] + b["w"] - 0.03, b["y"], 0.03, b["h"])):
        rail = pbox("balustrada", *args, 0.0, 1.1, M["glass"])
        rail.visible_shadow = False
    pbox("porecz", b["x"], b["y"] + b["h"] - 0.05, b["w"], 0.05, 1.08, 0.04, M["black"])
    dining_chair(b["x"] + 0.55, b["y"] + b["h"] * 0.5, "u")
    model("potted_plant_04", b["x"] + b["w"] - 0.35, b["y"] + b["h"] * 0.5, 0, height=0.6)


# =====================================================================
# otoczenie, światło, render
# =====================================================================
# ziemia daleko w dole i kilka brył sąsiednich budynków, żeby okno nie wychodziło w pustkę
ground = box("ziemia", W / 2, -H / 2, -9.0, 400, 400, 0.1, M["ground"])
# drzewa i krzewy na dole (modele Poly Haven): widać korony nad balustradą, a nie pustą ziemię
for k in range(9):
    kind = ("island_tree_02", "tree_small_02", "shrub_02")[k % 3]
    tx = W / 2 - 22 + (k * 41 % 44)
    ty = H + 10 + (k * 17 % 16)
    model(kind, tx, ty, k * 47, height=(9 + (k % 4) * 2.5) if kind != "shrub_02" else 2.5, z=-9.0)

world = bpy.data.worlds.new("Swiat")
scene.world = world
try:
    world.use_nodes = True
except Exception:
    pass
nt = world.node_tree
bg = next(n for n in nt.nodes if n.type == "BACKGROUND")
env = nt.nodes.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(os.path.join(ASSETS, "hdri", "kloofendal_48d_partly_cloudy_puresky.hdr"))
mapping = nt.nodes.new("ShaderNodeMapping")
mapping.inputs["Rotation"].default_value = (0, 0, math.radians(160))
coord = nt.nodes.new("ShaderNodeTexCoord")
nt.links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
nt.links.new(mapping.outputs["Vector"], env.inputs["Vector"])
nt.links.new(env.outputs["Color"], bg.inputs["Color"])
bg.inputs["Strength"].default_value = 0.9

sun_data = bpy.data.lights.new("Slonce", "SUN")
sun_data.energy = 4.5
sun_data.angle = math.radians(1.0)
sun_data.color = (1.0, 0.92, 0.80)
sun = bpy.data.objects.new("Slonce", sun_data)
scene.collection.objects.link(sun)
# popołudniowe słońce wpada przez okna (od -Y) ukośnie
ray = Vector((0.45 if plan["facade"] == "S" else -0.4, 0.62, -0.62)).normalized()
sun.rotation_euler = (-ray).to_track_quat("Z", "Y").to_euler()

# delikatne wypełnienie światłem okien: duże panele tuż za szybami
for (r, o0, o1, zb, zt) in WINDOWS:
    portal = bpy.data.lights.new("Okno", "AREA")
    portal.shape = "RECTANGLE"
    portal.size = o1 - o0
    portal.size_y = zt - zb
    portal.energy = (o1 - o0) * (zt - zb) * 90
    portal.color = (1.0, 0.97, 0.93)
    obj = bpy.data.objects.new("Okno", portal)
    cx, cy = P((o0 + o1) / 2, H + 0.3)
    obj.location = (cx, cy, (zb + zt) / 2)
    obj.rotation_euler = (math.radians(-90), 0, 0)  # świeci w głąb mieszkania (+Y)
    scene.collection.objects.link(obj)

scene.render.engine = "CYCLES"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = kind
            break
        except TypeError:
            continue
    prefs.get_devices()
    for device in prefs.devices:
        device.use = True
    scene.cycles.device = "GPU"
except Exception as e:
    print("cycles: CPU", e)
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
# adaptacyjne próbkowanie: gładkie ściany kończą się szybko, szum zostaje tylko w trudnych miejscach
try:
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.03
except Exception:
    pass
for attr, val in (("max_bounces", 8), ("diffuse_bounces", 4), ("glossy_bounces", 3), ("transmission_bounces", 6)):
    try:
        setattr(scene.cycles, attr, val)
    except Exception:
        pass
try:
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 1.0
except Exception:
    pass

cam_data = bpy.data.cameras.new("Kamera")
cam_data.type = "PANO"
for owner in (cam_data, getattr(cam_data, "cycles", None)):
    try:
        owner.panorama_type = "EQUIRECTANGULAR"
        break
    except Exception:
        continue
cam_data.clip_start = 0.05
cam = bpy.data.objects.new("Kamera", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam.rotation_euler = (math.radians(90), 0, 0)  # środek panoramy patrzy w stronę wejścia (+Y)

TOP = len(argv) > 6 and argv[6] == "gora"
if TOP:
    # kontrola rozmieszczenia: rzut z góry bez sufitu
    ceiling.hide_render = True
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = max(W, H) + 3
    cam.rotation_euler = (0, 0, 0)
    cam.location = (W / 2, -H / 2 - 0.5, 12)
    scene.render.resolution_x, scene.render.resolution_y = 1400, 1400
    scene.render.image_settings.file_format = "JPEG"
    scene.render.filepath = os.path.join(OUT, SLOT, "gora.jpg")
    os.makedirs(os.path.join(OUT, SLOT), exist_ok=True)
    bpy.ops.render.render(write_still=True)
    print("gotowe")
    raise SystemExit
scene.render.resolution_x, scene.render.resolution_y = PANO_W, PANO_W // 2
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 92
os.makedirs(os.path.join(OUT, SLOT), exist_ok=True)
for i, r in enumerate(PLAN):
    if ONLY is not None and i != ONLY:
        continue
    v = plan["views"][i]
    px, py = P(v["x"], v["y"])
    cam.location = (px, py, 1.55 if r["kind"] != "balkon" else 1.5)
    path = os.path.join(OUT, SLOT, f"{i}.jpg")
    stamp = os.path.join(OUT, SLOT, f"{i}.json")
    here = json.dumps({"x": round(v["x"], 4), "y": round(v["y"], 4), "w": PANO_W})
    if ONLY is None and os.path.exists(path) and os.path.exists(stamp) and open(stamp, encoding="utf-8").read() == here:
        continue  # ta sama panorama z tego samego miejsca już jest
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    with open(stamp, "w", encoding="utf-8") as fh:
        fh.write(here)
print("gotowe")
