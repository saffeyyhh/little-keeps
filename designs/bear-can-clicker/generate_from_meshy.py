"""Build the clicker from the user's detailed Meshy bear and can STLs.

The source files stay on the Desktop because they total more than 130 MB. The
generated, printable parts are written to this design's ``stl`` directory.
All dimensions are millimetres.
"""

from pathlib import Path

import manifold3d
import numpy as np
import trimesh


BEAR_SOURCE = Path(
    "/Users/safwanahothman/Desktop/"
    "Meshy_AI_Coca-Cola Polar Bear_1785596548_generate.stl"
)
CAN_SOURCE = Path(
    "/Users/safwanahothman/Desktop/"
    "Meshy_AI_export_1787917448_image-to-3d-texture.stl"
)
OUT = Path(__file__).resolve().parent / "stl"
OUT.mkdir(parents=True, exist_ok=True)

BEAR_WIDTH = 39.0
CAN_WIDTH = 44.0
GUIDE_HEIGHT = 10.5
TRAVEL = 3.5
SECTIONS = 96


def cylinder(radius, height, z):
    mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=SECTIONS)
    mesh.apply_translation((0, 0, z + height / 2))
    return mesh


def box(size, centre):
    mesh = trimesh.creation.box(extents=size)
    mesh.apply_translation(centre)
    return mesh


def cylinder_y(radius, length, centre):
    """Cylinder whose hole/axis runs front-to-back instead of vertically."""
    mesh = trimesh.creation.cylinder(radius=radius, height=length, sections=SECTIONS)
    mesh.apply_transform(
        trimesh.transformations.rotation_matrix(np.pi / 2, (1, 0, 0))
    )
    mesh.apply_translation(centre)
    return mesh


def union(*meshes):
    return trimesh.boolean.union(list(meshes), engine="manifold")


def difference(mesh, *cutters):
    return trimesh.boolean.difference([mesh, *cutters], engine="manifold")


def manifold_simplify(mesh, tolerance):
    """Reduce Meshy density without opening the printable solid."""
    source = manifold3d.Mesh(
        np.asarray(mesh.vertices, dtype=np.float32),
        np.asarray(mesh.faces, dtype=np.uint32),
    )
    solid = manifold3d.Manifold(source)
    if solid.status() != manifold3d.Error.NoError:
        raise RuntimeError(f"Source mesh is not a valid solid: {solid.status()}")
    reduced = solid.simplify(tolerance).to_mesh()
    return trimesh.Trimesh(
        vertices=np.asarray(reduced.vert_properties)[:, :3],
        faces=np.asarray(reduced.tri_verts),
        process=False,
    )


def centre_and_scale(mesh, target_width, bottom_z):
    scale = target_width / max(mesh.extents[:2])
    mesh.apply_scale(scale)
    centre = mesh.bounding_box.centroid
    mesh.apply_translation((-centre[0], -centre[1], bottom_z - mesh.bounds[0, 2]))
    return mesh


def build_bear_top():
    source = trimesh.load(BEAR_SOURCE, force="mesh")
    # Keep the real printable bear body and discard a few stray Meshy triangles.
    bear = max(source.split(only_watertight=False), key=lambda part: abs(part.volume))
    centre_and_scale(bear, BEAR_WIDTH, GUIDE_HEIGHT)
    bear = manifold_simplify(bear, 0.02)

    # The bear's original circular underside is the moving top. The can rim
    # guides it, while the central boss reaches the raised switch mount.
    boss = cylinder(4.8, 10.8, 0.0)

    # Keyring loop behind the head. Its horizontal hole is cut through both the
    # loop and the small area where it blends into the bear, keeping it usable.
    loop_outer = cylinder_y(4.8, 4.2, (0.0, 9.5, 44.0))
    top = union(bear, boss, loop_outer)

    cross = union(
        box((4.25, 1.35, 5.0), (0, 0, 2.4)),
        box((1.35, 4.25, 5.0), (0, 0, 2.4)),
    )
    loop_hole = cylinder_y(2.25, 8.0, (0.0, 9.5, 44.0))
    top = difference(top, cross, loop_hole)

    # Remove microscopic disconnected triangles left by the AI source mesh.
    return max(top.split(only_watertight=False), key=lambda part: abs(part.volume))


def build_can_base():
    can = trimesh.load(CAN_SOURCE, force="mesh")
    centre_and_scale(can, CAN_WIDTH, 0.0)
    can = manifold_simplify(can, 0.02)
    can_height = can.bounds[1, 2]

    # Preserve the solid exterior and bottom. Only the hidden mechanism cavity
    # is removed. A high internal floor closes the visible opening afterward.
    shell = difference(can, cylinder(20.0, can_height, 3.0))

    # Raise the switch so its stem reaches the bear's cross socket. The plate
    # overlaps the can wall, so it cannot float as a separate internal piece.
    plate_z = 18.4
    plate = cylinder(20.3, 1.6, plate_z)
    chimney = difference(
        box((17.0, 17.0, plate_z - 2.7), (0, 0, (plate_z + 2.7) / 2)),
        box((14.25, 14.25, plate_z + 1.0), (0, 0, plate_z / 2)),
    )

    # This shallow ceiling makes the can look covered when the bear is removed.
    # It sits just below the bear's full-press position; only the central boss
    # passes through it into the concealed switch cavity.
    ceiling_z = can_height - 5.2
    ceiling = cylinder(20.3, 1.2, ceiling_z)
    base = union(shell, plate, chimney, ceiling)

    switch_opening = box((14.05, 14.05, plate_z + 3.0), (0, 0, plate_z / 2))
    boss_passage = cylinder(5.2, 2.4, ceiling_z - 0.6)
    return difference(base, switch_opening, boss_passage), can_height


def validate(name, mesh):
    mesh.remove_unreferenced_vertices()
    if not mesh.is_watertight or mesh.volume <= 0:
        raise RuntimeError(f"{name} is not a watertight positive-volume solid")
    components = mesh.split(only_watertight=False)
    if len(components) != 1:
        raise RuntimeError(f"{name} contains {len(components)} disconnected pieces")
    return mesh


def main():
    top = validate("bear top", build_bear_top())
    base, can_height = build_can_base()
    base = validate("can base", base)

    rest_height = can_height - GUIDE_HEIGHT
    pressed_height = rest_height - TRAVEL
    for label, height in (("rest", rest_height), ("pressed", pressed_height)):
        moving = top.copy()
        moving.apply_translation((0, 0, height))
        overlap = trimesh.boolean.intersection([base, moving], engine="manifold")
        if overlap.volume > 0.001:
            raise RuntimeError(f"Parts collide at {label}: {overlap.volume:.3f} mm³")

    base.export(OUT / "bear_can_clicker_base.stl")
    top.export(OUT / "bear_can_clicker_top.stl")
    assembled_top = top.copy()
    assembled_top.apply_translation((0, 0, rest_height))
    assembly = trimesh.util.concatenate((base, assembled_top))
    assembly.export(OUT / "bear_can_clicker_assembly_reference.stl")

    print(f"Rest height: {rest_height:.3f} mm; travel: {TRAVEL:.1f} mm")
    for name, mesh in (("base", base), ("top", top), ("assembly", assembly)):
        print(
            f"{name}: {np.round(mesh.extents, 2).tolist()} mm | "
            f"{len(mesh.faces)} faces | watertight={mesh.is_watertight}"
        )


if __name__ == "__main__":
    main()
