"""Generate the Little Keeps bear-in-a-can clicker prototype.

The model is sized for a standard MX-style mechanical switch.  All dimensions
are millimetres.  Run this file with trimesh + manifold3d installed.
"""

from pathlib import Path
import numpy as np
import trimesh


OUT = Path(__file__).resolve().parent / "stl"
OUT.mkdir(parents=True, exist_ok=True)
SECTIONS = 96


def cylinder(radius, height, z):
    mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=SECTIONS)
    mesh.apply_translation((0, 0, z + height / 2))
    return mesh


def box(size, centre):
    mesh = trimesh.creation.box(extents=size)
    mesh.apply_translation(centre)
    return mesh


def ellipsoid(radii, centre, subdivisions=3):
    mesh = trimesh.creation.icosphere(subdivisions=subdivisions, radius=1.0)
    mesh.apply_transform(np.diag([radii[0], radii[1], radii[2], 1.0]))
    mesh.apply_translation(centre)
    return mesh


def union(*meshes):
    return trimesh.boolean.union(list(meshes), engine="manifold")


def difference(mesh, *cutters):
    return trimesh.boolean.difference([mesh, *cutters], engine="manifold")


def intersection(*meshes):
    return trimesh.boolean.intersection(list(meshes), engine="manifold")


def rounded_can_outer():
    # Revolved soda-can profile with a softened shoulder and bottom bead.
    profile = np.array([
        [0.0, 0.0],
        [18.4, 0.0],
        [19.5, 1.2],
        [20.1, 3.2],
        [20.4, 7.0],
        [20.4, 24.5],
        [20.1, 27.5],
        [19.7, 30.0],
        [19.55, 31.5],
        [0.0, 31.5],
    ])
    return trimesh.creation.revolve(profile, sections=SECTIONS)


def build_can_base():
    outer = rounded_can_outer()

    # Hollow interior, while retaining a 3 mm bottom and sturdy can wall.
    inner = cylinder(18.15, 31.0, 3.0)
    shell = difference(outer, inner)

    # 1.6 mm switch plate plus a supported square chimney underneath it.
    plate = cylinder(18.05, 1.6, 9.0)
    chimney_outer = box((17.0, 17.0, 6.0), (0, 0, 6.0))
    chimney_inner = box((14.25, 14.25, 8.2), (0, 0, 6.0))
    chimney = difference(chimney_outer, chimney_inner)

    # Reinforced keyring tab positioned low so the sliding top never catches it.
    lug_disc = cylinder(6.2, 4.2, 4.0)
    lug_disc.apply_translation((22.0, 0, 0))
    lug_bridge = box((9.5, 10.0, 4.2), (18.8, 0, 6.1))
    base = union(shell, plate, chimney, lug_disc, lug_bridge)

    switch_opening = box((14.05, 14.05, 13.0), (0, 0, 5.5))
    keyring_hole = cylinder(4.4 / 2, 7.0, 2.5)
    keyring_hole.apply_translation((22.0, 0, 0))
    base = difference(base, switch_opening, keyring_hole)

    # Subtle can bands. They are structural as well as visual.
    lower_band = difference(cylinder(20.75, 1.2, 1.0), cylinder(19.0, 1.8, 0.7))
    upper_band = difference(cylinder(19.95, 1.0, 30.45), cylinder(19.25, 1.6, 30.15))
    return union(base, lower_band, upper_band)


def build_bear_top():
    # Internal guide skirt slides inside the fixed can wall.  The taller can
    # hides this guide, the switch boss and the spokes throughout the click.
    guide = difference(cylinder(17.75, 10.5, 0.0), cylinder(16.2, 11.0, -0.2))

    # A clean moving deck hides the switch structure when the clicker is at rest.
    # It also joins the guide skirt, bear and keycap boss into one printable part.
    boss = cylinder(4.8, 10.0, 0.0)
    deck = cylinder(17.7, 2.0, 8.2)

    head = ellipsoid((18.5, 16.0, 15.5), (0, 0, 22.0), subdivisions=4)
    head = intersection(head, box((60, 60, 40), (0, 0, 28.5)))

    ears = union(
        ellipsoid((5.8, 4.6, 5.8), (-13.5, -0.5, 34.0)),
        ellipsoid((5.8, 4.6, 5.8), (13.5, -0.5, 34.0)),
    )
    muzzle = ellipsoid((7.5, 3.8, 5.8), (0, -14.2, 17.2))
    paws = union(
        ellipsoid((5.6, 4.8, 6.8), (-12.3, -10.2, 12.5)),
        ellipsoid((5.6, 4.8, 6.8), (12.3, -10.2, 12.5)),
    )

    # Friendly raised facial features, printable as part of the top.
    eyes = union(
        ellipsoid((1.7, 1.5, 2.0), (-6.1, -15.0, 23.3)),
        ellipsoid((1.7, 1.5, 2.0), (6.1, -15.0, 23.3)),
    )
    nose = ellipsoid((2.8, 1.7, 2.0), (0, -17.2, 18.6))

    top = union(guide, boss, deck, head, ears, muzzle, paws, eyes, nose)

    # MX-style cross socket: 4.25 mm overall, 1.35 mm arm thickness,
    # 4.8 mm deep. This is intentionally parametric for fit tuning.
    cross_x = box((4.25, 1.35, 5.0), (0, 0, 2.4))
    cross_y = box((1.35, 4.25, 5.0), (0, 0, 2.4))
    socket = union(cross_x, cross_y)
    return difference(top, socket)


def add_motion_clearance(base, top):
    """Carve a small paw-shaped running clearance through the upper can rim."""
    positions = (17.5, 18.375, 19.25, 20.125, 21.0)
    envelopes = []
    for z in positions:
        moved = top.copy()
        moved.apply_scale((1.015, 1.015, 1.0))
        moved.apply_translation((0, 0, z))
        envelopes.append(moved)
    swept_envelope = union(*envelopes)
    return difference(base, swept_envelope)


def validate(name, mesh):
    mesh.remove_unreferenced_vertices()
    if not mesh.is_watertight:
        raise RuntimeError(f"{name} is not watertight")
    if mesh.volume <= 0:
        raise RuntimeError(f"{name} has invalid volume")
    return mesh


def main():
    top = validate("bear top", build_bear_top())
    base = validate("can base", add_motion_clearance(build_can_base(), top))

    base.export(OUT / "bear_can_clicker_base.stl")
    top.export(OUT / "bear_can_clicker_top.stl")

    # Assembly reference only: the top rests at Z=21 mm and travels down 3.5 mm.
    preview_top = top.copy()
    preview_top.apply_translation((0, 0, 21.0))
    assembly = trimesh.util.concatenate((base, preview_top))
    assembly.export(OUT / "bear_can_clicker_assembly_reference.stl")

    for name, mesh in (("base", base), ("top", top), ("assembly", assembly)):
        extents = np.round(mesh.extents, 2)
        print(f"{name}: {extents.tolist()} mm | {len(mesh.faces)} faces | watertight={mesh.is_watertight}")


if __name__ == "__main__":
    main()
