"""Render bryły budynku w rzucie izometrycznym, zgodnym z warstwą SVG na stronie.

Uruchomienie (zawsze w tle):
  blender --background --python blender/budynek.py -- <katalog_wyjscia> <godzina> [próbki] [skala]

Układ świata: X = wschód, Y = północ, Z = góra. Przedni narożnik bryły (południowo-wschodni)
leży w (0, 0, 0); elewacja południowa biegnie na zachód (-X), wschodnia na północ (+Y).
To ten sam układ co funkcje pt() i ground() w src/components/Building.tsx.

Obok obrazu zapisuje <godzina>.json z odwzorowaniem: piksel przedniego narożnika
i liczba pikseli na metr, żeby strona mogła położyć klikalne pola dokładnie na renderze.
"""

import json
import math
import os
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
OUT = argv[0]
HOUR = float(argv[1])
SAMPLES = int(argv[2]) if len(argv) > 2 else 96
SCALE = float(argv[3]) if len(argv) > 3 else 2.0
HERE = os.path.dirname(os.path.abspath(__file__))

# ---------- wymiary (muszą odpowiadać stałym w Building.tsx) ----------
UNIT = 0.0625          # metry na jednostkę SVG
L = 104 * UNIT         # szerokość mieszkania wzdłuż elewacji: 6,5 m
HF = 48 * UNIT         # wysokość kondygnacji: 3,0 m
FLOORS = 7
LEN_S = 3 * L
LEN_E = 2 * L
HT = FLOORS * HF
PLOT = 60 * UNIT
PLOT_T = 14 * UNIT
VB = (-50, -70, 740, 720)  # viewBox SVG: x, y, szerokość, wysokość
CX, CY = 350, 560          # przedni narożnik w jednostkach SVG

# balkony jak w danych: kawalerka (slot 4) ma balkon co drugie piętro
def has_balcony(floor, slot):
    return slot != 4 or floor % 2 == 0

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


# ---------- materiały ----------
def principled(name, color, rough=0.5, metal=0.0, **extra):
    mat = bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except Exception:
        pass
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    for key, val in extra.items():
        try:
            bsdf.inputs[key].default_value = val
        except Exception:
            pass
    return mat, bsdf


def with_noise_bump(mat, bsdf, scale=40.0, strength=0.08, tint=None):
    """drobna faktura tynku: szum do wypukłości i lekkiej zmiany koloru"""
    nt = mat.node_tree
    coord = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 8.0
    nt.links.new(coord.outputs["Object"], noise.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    if tint:
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (*tint[0], 1)
        ramp.color_ramp.elements[1].color = (*tint[1], 1)
        nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


M = {}
M["plaster"] = with_noise_bump(*principled("Tynk", (0.74, 0.71, 0.66), 0.85), 55, 0.05, ((0.71, 0.68, 0.63), (0.77, 0.74, 0.69)))
M["band"] = with_noise_bump(*principled("Pas stropu", (0.32, 0.30, 0.28), 0.7), 30, 0.05)
M["frame"] = principled("Rama okna", (0.09, 0.09, 0.10), 0.35, 0.6)[0]
M["glass"] = principled("Szyba", (0.05, 0.07, 0.09), 0.03, 0.0, **{"Specular IOR Level": 0.8, "Coat Weight": 0.6})[0]
M["slab"] = with_noise_bump(*principled("Plyta balkonu", (0.62, 0.60, 0.57), 0.8), 25, 0.06)
M["railglass"] = principled("Balustrada", (0.75, 0.85, 0.88), 0.05, 0.0, **{"Transmission Weight": 0.9, "Alpha": 0.55})[0]
M["metal"] = principled("Porecz", (0.12, 0.12, 0.13), 0.35, 0.8)[0]
M["roof"] = principled("Dach zielony", (0.12, 0.19, 0.08), 0.9)[0]
M["parapet"] = principled("Attyka", (0.30, 0.29, 0.27), 0.6)[0]
M["grass"] = with_noise_bump(*principled("Trawa", (0.10, 0.20, 0.06), 0.95), 18, 0.25, ((0.08, 0.17, 0.05), (0.15, 0.26, 0.08)))
M["paving"] = with_noise_bump(*principled("Bruk", (0.62, 0.59, 0.54), 0.85), 60, 0.15)
M["plinth"] = principled("Podstawa makiety", (0.93, 0.91, 0.87), 0.8)[0]
M["side"] = principled("Bok makiety", (0.55, 0.52, 0.47), 0.8)[0]
M["trunk"] = principled("Pien", (0.22, 0.16, 0.11), 0.9)[0]
M["leaf"] = with_noise_bump(*principled("Korona", (0.09, 0.18, 0.06), 0.75), 6, 0.5, ((0.06, 0.14, 0.04), (0.14, 0.26, 0.08)))
WARM = [
    principled(f"Okno wieczorem {i}", (1.0, 0.72, 0.42), 0.4, 0.0, **{"Emission Color": (*c, 1), "Emission Strength": 0.0})[0]
    for i, c in enumerate(((1.0, 0.62, 0.32), (1.0, 0.70, 0.42), (1.0, 0.56, 0.28)))
]
M["stone"] = with_noise_bump(*principled("Okladzina parteru", (0.36, 0.34, 0.31), 0.6), 14, 0.12, ((0.32, 0.30, 0.28), (0.40, 0.38, 0.35)))
M["lamp"] = principled("Klosz", (1.0, 0.85, 0.6), 0.3, 0.0, **{"Emission Color": (1.0, 0.82, 0.55, 1), "Emission Strength": 0.0})[0]
M["hedge"] = with_noise_bump(*principled("Zywoplot", (0.07, 0.16, 0.05), 0.85), 9, 0.6, ((0.05, 0.13, 0.04), (0.10, 0.21, 0.06)))
M["wood"] = principled("Drewno laweczki", (0.36, 0.22, 0.12), 0.6)[0]
M["larch"] = with_noise_bump(*principled("Modrzew elewacji", (0.42, 0.26, 0.14), 0.55), 3, 0.15, ((0.34, 0.20, 0.10), (0.48, 0.31, 0.17)))
M["gravel"] = with_noise_bump(*principled("Zwir dachu", (0.52, 0.50, 0.47), 0.95), 80, 0.3)
M["deck"] = with_noise_bump(*principled("Taras dachu", (0.40, 0.27, 0.16), 0.6), 4, 0.1)
M["pv"] = principled("Panel PV", (0.04, 0.06, 0.10), 0.15, 0.3)[0]


# ---------- prymitywy ----------
def box(name, x0, x1, y0, y1, z0, z1, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (max(x1 - x0, 0.001), max(y1 - y0, 0.001), max(z1 - z0, 0.001))
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("faza", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    return obj


def facade_point(f, d, z, out=0.0):
    """punkt na elewacji: d wzdłuż elewacji od przedniego narożnika, out na zewnątrz"""
    return Vector((-d, -out, z)) if f == "S" else Vector((out, d, z))


def facade_box(name, f, d0, d1, z0, z1, out0, out1, mat, bevel=0.0):
    a, b = facade_point(f, d0, z0, out0), facade_point(f, d1, z1, out1)
    return box(name, min(a.x, b.x), max(a.x, b.x), min(a.y, b.y), max(a.y, b.y), z0, z1, mat, bevel)


# ---------- bryła ----------
box("bryla", -LEN_S, 0, 0, LEN_E, 0, HT, M["plaster"])
# ciemne pasy stropów: rytm kondygnacji widoczny z daleka
for floor in range(1, FLOORS):
    z = floor * HF
    box("pas S", -LEN_S - 0.02, 0.02, -0.06, 0.0, z - 0.12, z + 0.12, M["band"])
    box("pas E", 0.0, 0.06, -0.02, LEN_E + 0.02, z - 0.12, z + 0.12, M["band"])
# cokół parteru
box("cokol S", -LEN_S - 0.03, 0.03, -0.08, 0.0, 0, 0.6, M["band"])
box("cokol E", 0.0, 0.08, -0.03, LEN_E + 0.03, 0, 0.6, M["band"])
# attyka i zielony dach
box("dach", -LEN_S + 0.3, -0.3, 0.3, LEN_E - 0.3, HT, HT + 0.06, M["gravel"])
# zielony dach z tarasem i panelami: widać go z góry, więc musi coś mówić
box("zielen", -LEN_S + 1.3, -LEN_S * 0.45, 1.3, LEN_E - 1.3, HT, HT + 0.12, M["roof"])
box("taras", -LEN_S * 0.42, -1.3, LEN_E * 0.5, LEN_E - 1.3, HT, HT + 0.1, M["deck"], 0.01)
for k in range(4):
    px = -LEN_S * 0.42 + 0.3 + k * 1.75
    box("panel", px, px + 1.5, 1.4, 1.4 + 3.6, HT + 0.25, HT + 0.32, M["pv"], 0.01)
    box("stelaz", px + 0.1, px + 1.4, 1.6, 4.8, HT, HT + 0.25, M["metal"])
for k in range(3):
    box("donica", -LEN_S * 0.42 + 0.4 + k * 2.6, -LEN_S * 0.42 + 1.4 + k * 2.6, LEN_E - 2.2, LEN_E - 1.5, HT, HT + 0.5, M["parapet"], 0.02)
    box("krzew", -LEN_S * 0.42 + 0.5 + k * 2.6, -LEN_S * 0.42 + 1.3 + k * 2.6, LEN_E - 2.1, LEN_E - 1.6, HT + 0.5, HT + 0.95, M["hedge"], 0.15)
for args in (
    (-LEN_S, 0, 0, 0.3), (-LEN_S, 0, LEN_E - 0.3, LEN_E),
):
    box("attyka", args[0], args[1], args[2], args[3], HT, HT + 0.9, M["parapet"], 0.02)
for args in ((-LEN_S, -LEN_S + 0.3), (-0.3, 0)):
    box("attyka", args[0], args[1], 0, LEN_E, HT, HT + 0.9, M["parapet"], 0.02)
box("czerpnia", -LEN_S * 0.62, -LEN_S * 0.62 + 2.2, LEN_E * 0.35, LEN_E * 0.35 + 1.6, HT, HT + 1.4, M["parapet"], 0.03)


# ---------- okna i balkony ----------
CUTTERS = []


def window(f, d0, d1, z0, z1, lit):
    # otwór w ścianie: ościeża dostają cień, dzięki czemu elewacja ma głębię
    CUTTERS.append(facade_box("otwor", f, d0, d1, z0, z1, -0.32, 0.3, M["glass"]))
    facade_box("szyba", f, d0, d1, z0, z1, -0.17, -0.15, lit if lit else M["glass"])
    t = 0.06
    for a, b, c, e in ((d0, d0 + t, z0, z1), (d1 - t, d1, z0, z1), (d0, d1, z0, z0 + t), (d0, d1, z1 - t, z1)):
        facade_box("rama", f, a, b, c, e, -0.18, -0.1, M["frame"])
    mid = (d0 + d1) / 2
    facade_box("slupek", f, mid - 0.03, mid + 0.03, z0, z1, -0.18, -0.1, M["frame"])
    if z0 % HF > 0.5:  # parapet tylko w oknach, nie w drzwiach balkonowych
        facade_box("parapet", f, d0 - 0.03, d1 + 0.03, z0 - 0.04, z0, -0.12, 0.05, M["metal"])


lit_rooms = set()
for floor in range(FLOORS):
    for slot in range(5):
        f = "S" if slot < 3 else "E"
        d0 = (2 - slot) * L if f == "S" else (slot - 3) * L
        z0 = floor * HF
        w = L
        night = HOUR >= 19.5 or HOUR <= 6.0
        lit = WARM[(floor + slot * 2) % 3] if night and (floor * 3 + slot * 5) % 4 != 0 else None
        balcony = has_balcony(floor, slot)
        window(f, d0 + w * 0.12, d0 + w * 0.40, z0 + HF * 0.26, z0 + HF * 0.80, lit)
        # pionowy pas z modrzewia między oknami: ciepły rytm elewacji
        if floor > 0:
            facade_box("modrzew", f, d0 + w * 0.43, d0 + w * 0.55, z0 + 0.14, z0 + HF - 0.14, 0.0, 0.05, M["larch"], 0.008)
            for k in range(1, 4):
                dk = d0 + w * (0.43 + 0.03 * k)
                facade_box("listwa", f, dk - 0.006, dk + 0.006, z0 + 0.14, z0 + HF - 0.14, 0.05, 0.06, M["band"])
        window(f, d0 + w * 0.58, d0 + w * 0.88, z0 + HF * (0.06 if balcony else 0.26), z0 + HF * 0.80, lit)
        if balcony:
            b0, b1 = d0 + w * 0.5, d0 + w * 0.95
            facade_box("balkon", f, b0, b1, z0 + HF * 0.02, z0 + HF * 0.02 + 0.18, 0.0, 1.35, M["slab"], 0.01)
            facade_box("balustrada", f, b0 + 0.04, b1 - 0.04, z0 + HF * 0.02 + 0.18, z0 + HF * 0.02 + 1.1, 1.29, 1.31, M["railglass"])
            facade_box("porecz", f, b0, b1, z0 + HF * 0.02 + 1.08, z0 + HF * 0.02 + 1.13, 1.27, 1.33, M["metal"])
            for d in (b0 + 0.02, b1 - 0.06):
                facade_box("slupek balustrady", f, d, d + 0.04, z0 + HF * 0.02 + 0.18, z0 + HF * 0.02 + 1.1, 1.27, 1.33, M["metal"])

# parter w ciemniejszej okładzinie: budynek „stoi” na cokole
box("okladzina S", -LEN_S - 0.04, 0.04, -0.05, 0.0, 0.0, HF - 0.12, M["stone"])
box("okladzina E", 0.0, 0.05, -0.04, LEN_E + 0.04, 0.0, HF - 0.12, M["stone"])

# wejście na elewacji wschodniej, między mieszkaniami parteru: przeszklone drzwi i zadaszenie
mid_e = LEN_E * 0.5
CUTTERS.append(facade_box("otwor wejscia", "E", mid_e - 0.9, mid_e + 0.9, 0.0, 2.5, -0.32, 0.3, M["glass"]))
facade_box("drzwi", "E", mid_e - 0.9, mid_e + 0.9, 0.0, 2.5, -0.2, -0.18, WARM[1] if HOUR >= 18.5 or HOUR <= 6.5 else M["glass"])
facade_box("rama drzwi", "E", mid_e - 0.03, mid_e + 0.03, 0.0, 2.5, -0.21, -0.15, M["frame"])
box("daszek", 0.0, 1.8, mid_e - 1.6, mid_e + 1.6, 2.75, 2.9, M["band"], 0.02)
box("numer", 0.06, 0.09, mid_e + 1.05, mid_e + 1.45, 2.0, 2.35, M["lamp"])

# jeden obiekt z wszystkich otworów i jedno odejmowanie: szybko i bez szczelin
for cutter in CUTTERS[1:]:
    cutter.select_set(True)
bpy.ops.object.select_all(action="DESELECT")
for cutter in CUTTERS:
    cutter.select_set(True)
bpy.context.view_layer.objects.active = CUTTERS[0]
bpy.ops.object.join()
cutter = CUTTERS[0]
cutter.hide_render = True
cutter.display_type = "WIRE"
for target_name in ("bryla", "okladzina S", "okladzina E", "cokol S", "cokol E"):
    target = bpy.data.objects.get(target_name)
    if target is None:
        continue
    mod = target.modifiers.new("otwory", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    # EXACT bez use_self zwraca tu pustą bryłę; MANIFOLD daje poprawne otwory i jest szybki
    try:
        mod.solver = "MANIFOLD"
    except TypeError:
        mod.solver = "EXACT"
        mod.use_self = True


# ---------- działka-makieta ----------
x0, x1 = -LEN_S - PLOT, 70 * UNIT
y0, y1 = -PLOT, LEN_E + PLOT
box("trawa", x0, x1, y0, y1, -0.05, 0.0, M["grass"])
box("podstawa", x0 - 0.02, x1 + 0.02, y0 - 0.02, y1 + 0.02, -PLOT_T, -0.05, M["side"])
# chodnik wzdłuż elewacji i dojście do wejścia
box("chodnik S", -LEN_S, 0.9, -1.2, 0.0, 0.0, 0.03, M["paving"])
box("chodnik E", 0.0, 1.2, -1.2, LEN_E, 0.0, 0.03, M["paving"])
box("dojscie", 1.2, x1, LEN_E * 0.5 - 0.8, LEN_E * 0.5 + 0.8, 0.0, 0.03, M["paving"])


def tree(x, y, h=1.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.12 * h, depth=2.2 * h, location=(x, y, 1.1 * h))
    trunk = bpy.context.active_object
    trunk.data.materials.append(M["trunk"])
    for dx, dy, dz, r in ((0, 0, 3.0, 1.5), (0.6, 0.3, 3.7, 1.1), (-0.5, -0.2, 3.9, 1.0), (0.1, -0.5, 4.4, 0.8)):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=r * h, location=(x + dx * h, y + dy * h, dz * h))
        crown = bpy.context.active_object
        crown.data.materials.append(M["leaf"])
        disp = crown.modifiers.new("nierownosc", "DISPLACE")
        tex = bpy.data.textures.new("szum korony", "CLOUDS")
        tex.noise_scale = 0.6
        disp.texture = tex
        disp.strength = 0.35 * h
        bpy.ops.object.shade_smooth()


# drzewa tylko po bokach i z tyłu, żeby nie zasłaniały mieszkań
for e, n, h in ((-345, -30, 1.0), (-350, 170, 1.15), (42, 238, 1.05), (-352, 70, 0.8), (60, 160, 0.75)):
    tree(e * UNIT, n * UNIT, h)

# niski żywopłot wzdłuż krawędzi działki z przodu
box("zywoplot S", x0 + 0.4, x1 - 0.4, y0 + 0.25, y0 + 0.75, 0.0, 0.55, M["hedge"], 0.18)
box("zywoplot E", x1 - 0.75, x1 - 0.25, y0 + 0.4, LEN_E * 0.5 - 1.2, 0.0, 0.55, M["hedge"], 0.18)
box("zywoplot E2", x1 - 0.75, x1 - 0.25, LEN_E * 0.5 + 1.2, y1 - 0.4, 0.0, 0.55, M["hedge"], 0.18)


def bench(x, y, along_x=True):
    lx, ly = (1.6, 0.45) if along_x else (0.45, 1.6)
    box("siedzisko", x - lx / 2, x + lx / 2, y - ly / 2, y + ly / 2, 0.42, 0.48, M["wood"], 0.01)
    for sx in (-0.6, 0.6):
        ox, oy = (sx, 0) if along_x else (0, sx)
        box("noga", x + ox - 0.04, x + ox + 0.04, y + oy - 0.18, y + oy + 0.18, 0.0, 0.42, M["metal"])


def lamp(x, y):
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.05, depth=3.2, location=(x, y, 1.6))
    bpy.context.active_object.data.materials.append(M["metal"])
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.16, depth=0.28, location=(x, y, 3.3))
    bpy.context.active_object.data.materials.append(M["lamp"])


bench(2.6, mid_e + 2.4, along_x=False)
bench(-LEN_S * 0.5, -2.4)
for x, y in ((2.0, mid_e - 1.8), (2.0, mid_e + 1.8), (-LEN_S * 0.25, -2.2), (-LEN_S * 0.75, -2.2)):
    lamp(x, y)


# ---------- światło: słońce z modelu sun.ts i niebo z HDRI ----------
DAY_START, DAY_END = 5, 21
t = (HOUR - DAY_START) / (DAY_END - DAY_START)
azimuth = 50 + t * 260
elevation = -8 if t < 0 or t > 1 else 60 * math.sin(math.pi * t)

world = bpy.data.worlds.new("Swiat")
scene.world = world
try:
    world.use_nodes = True
except Exception:
    pass
nt = world.node_tree
bg = next(n for n in nt.nodes if n.type == "BACKGROUND")
env = nt.nodes.new("ShaderNodeTexEnvironment")
hdri = "belfast_sunset_puresky" if (elevation < 14) else "kloofendal_48d_partly_cloudy_puresky"
env.image = bpy.data.images.load(os.path.join(HERE, "assets", "hdri", f"{hdri}.hdr"))
mapping = nt.nodes.new("ShaderNodeMapping")
coord = nt.nodes.new("ShaderNodeTexCoord")
nt.links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
nt.links.new(mapping.outputs["Vector"], env.inputs["Vector"])
nt.links.new(env.outputs["Color"], bg.inputs["Color"])
day = max(0.0, min(1.0, elevation / 14))
bg.inputs["Strength"].default_value = 0.06 + 0.3 * day

sun_data = bpy.data.lights.new("Slonce", "SUN")
sun_data.angle = math.radians(1.2)
sun_data.energy = 3.6 * day
warmth = max(0.0, 1 - max(0.0, elevation) / 30)
sun_data.color = (1.0, 0.93 - 0.25 * warmth, 0.84 - 0.45 * warmth)
sun = bpy.data.objects.new("Slonce", sun_data)
scene.collection.objects.link(sun)
az, el = math.radians(azimuth), math.radians(max(elevation, 1))
toward_sun = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
sun.rotation_euler = toward_sun.to_track_quat("Z", "Y").to_euler()

night = elevation <= 0
if night or elevation < 6 or HOUR >= 19.5:
    for mat, strength in zip(WARM, (1.5, 2.2, 1.1)):
        bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Emission Strength"].default_value = strength
    lamp_bsdf = next(n for n in M["lamp"].node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    lamp_bsdf.inputs["Emission Strength"].default_value = 18.0
    for x, y in ((2.0, mid_e - 1.8), (2.0, mid_e + 1.8), (-LEN_S * 0.25, -2.2), (-LEN_S * 0.75, -2.2)):
        glow = bpy.data.lights.new("Latarnia", "POINT")
        glow.energy = 60
        glow.color = (1.0, 0.8, 0.55)
        glow.shadow_soft_size = 0.3
        obj = bpy.data.objects.new("Latarnia", glow)
        obj.location = (x, y, 3.05)
        scene.collection.objects.link(obj)
    bg.inputs["Strength"].default_value = 0.035

# ---------- kamera: izometria (azymut 45°, wysokość 35,26°) ----------
cam_data = bpy.data.cameras.new("Kamera")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("Kamera", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
view = Vector((-1, 1, -math.sqrt(2) * math.tan(math.radians(35.26439))))  # z południowego wschodu, w dół
center = Vector((-LEN_S / 2 + 1.5, LEN_E / 2, HT * 0.42))
cam.location = center - view.normalized() * 120
cam.rotation_euler = view.to_track_quat("-Z", "Y").to_euler()

# viewBox SVG ma 740 × 720 jednostek, czyli 46,25 × 45 m
scene.render.resolution_x = int(VB[2] * SCALE)
scene.render.resolution_y = int(VB[3] * SCALE)
# rysunek SVG nie skraca osi, a prawdziwa izometria skraca każdą o sqrt(2/3)
cam_data.ortho_scale = VB[2] * UNIT * math.sqrt(2 / 3)
# przesuwamy kadr tak, żeby przedni narożnik trafił w ten sam punkt co na rysunku SVG;
# przesunięcie działa w ułamkach dłuższego boku, więc kilka iteracji
bpy.context.view_layer.update()
want_x = (CX - VB[0]) / VB[2]
want_y = 1 - (CY - VB[1]) / VB[3]
metres_per_px = cam_data.ortho_scale / max(VB[2], VB[3])
right = cam.matrix_world.to_3x3() @ Vector((1, 0, 0))
up = cam.matrix_world.to_3x3() @ Vector((0, 1, 0))
for _ in range(3):
    corner = world_to_camera_view(scene, cam, Vector((0, 0, 0)))
    dx = (want_x - corner.x) * VB[2]  # jednostki SVG, dodatnie = narożnik ma być bardziej w prawo
    dy = (want_y - corner.y) * VB[3]  # dodatnie = wyżej
    # przesunięcie kamery w przeciwną stronę przesuwa obraz w żądaną
    cam.location -= right * dx * metres_per_px + up * dy * metres_per_px
    bpy.context.view_layer.update()

# ---------- render ----------
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
scene.render.film_transparent = True
try:
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    # w pełnym słońcu biała elewacja się przepala; o zmierzchu zostawiamy pełną jasność
    scene.view_settings.exposure = -0.3 * day
except Exception:
    pass
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
os.makedirs(OUT, exist_ok=True)
name = f"{HOUR:05.2f}".replace(".", "_")
scene.render.filepath = os.path.join(OUT, f"{name}.png")
bpy.ops.render.render(write_still=True)

# kontrola odwzorowania: gdzie wypadły punkty charakterystyczne
def pixel(p):
    v = world_to_camera_view(scene, cam, Vector(p))
    return [round(v.x * scene.render.resolution_x, 2), round((1 - v.y) * scene.render.resolution_y, 2)]


report = {
    "hour": HOUR,
    "azimuth": azimuth,
    "elevation": elevation,
    "corner": pixel((0, 0, 0)),
    "southEnd": pixel((-LEN_S, 0, 0)),
    "eastEnd": pixel((0, LEN_E, 0)),
    "top": pixel((0, 0, HT)),
    "expected": {
        "corner": [(CX - VB[0]) * SCALE, (CY - VB[1]) * SCALE],
        "southEnd": [(CX - VB[0] - 104 * 3 * 0.866) * SCALE, (CY - VB[1] - 104 * 3 * 0.5) * SCALE],
        "eastEnd": [(CX - VB[0] + 104 * 2 * 0.866) * SCALE, (CY - VB[1] - 104 * 2 * 0.5) * SCALE],
        "top": [(CX - VB[0]) * SCALE, (CY - VB[1] - 48 * FLOORS) * SCALE],
    },
}
with open(os.path.join(OUT, f"{name}.json"), "w", encoding="utf-8") as fh:
    json.dump(report, fh, indent=1)
print("ODWZOROWANIE", json.dumps(report))
print("gotowe")
