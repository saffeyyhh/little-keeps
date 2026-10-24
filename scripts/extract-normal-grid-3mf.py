#!/usr/bin/env python3
"""Extract the exact solid bases, A-Z/icon caps and listing renders from Normal Clicker.3mf."""

from __future__ import annotations

import argparse
import math
import struct
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path


CORE_NS = "http://schemas.microsoft.com/3dmanufacturing/core/2015/02"

BASE_MODELS = {
    "base-3-l": "3D/Objects/object_1496.model",
    "base-4-square": "3D/Objects/object_1497.model",
    "base-4-t": "3D/Objects/object_1499.model",
    "base-4-inverted-t": "3D/Objects/object_1501.model",
    "base-6-grid": "3D/Objects/object_1495.model",
    "base-9-grid": "3D/Objects/object_1498.model",
    "base-12-grid": "3D/Objects/object_1494.model",
}

# The Bambu project arranges these caps as an A-Z grid, but the underlying
# object identifiers are not alphabetical. This mapping is taken from the
# supplied project's exact plate positions.
CAP_MODELS = {
    "A": "3D/Objects/object_1479.model",
    "B": "3D/Objects/object_1473.model",
    "C": "3D/Objects/object_1470.model",
    "D": "3D/Objects/object_1465.model",
    "E": "3D/Objects/object_1478.model",
    "F": "3D/Objects/object_1477.model",
    "G": "3D/Objects/object_1487.model",
    "H": "3D/Objects/object_1484.model",
    "I": "3D/Objects/object_1482.model",
    "J": "3D/Objects/object_1467.model",
    "K": "3D/Objects/object_1483.model",
    "L": "3D/Objects/object_1480.model",
    "M": "3D/Objects/object_1475.model",
    "N": "3D/Objects/object_1466.model",
    "O": "3D/Objects/object_1471.model",
    "P": "3D/Objects/object_1485.model",
    "Q": "3D/Objects/object_1468.model",
    "R": "3D/Objects/object_1486.model",
    "S": "3D/Objects/object_1474.model",
    "T": "3D/Objects/object_1469.model",
    "U": "3D/Objects/object_1481.model",
    "V": "3D/Objects/object_1489.model",
    "W": "3D/Objects/object_1472.model",
    "X": "3D/Objects/object_1488.model",
    "Y": "3D/Objects/object_1476.model",
    "Z": "3D/Objects/object_1490.model",
}

# These caps are stored as a shared cap body plus transformed SVG artwork.
# Keep both meshes so the storefront preview matches the supplied printable
# project rather than substituting a generic emoji or font glyph.
ICON_MODELS = {
    "plant": (
        ("3D/Objects/object_1524.model", 69, None),
        ("3D/Objects/object_1524.model", 70, (0.059676757, 0, 0, 0, 0.0566929145, 0, 0, 0, 0.100150229, -0.138161381, -0.0391810151, 2.99999992)),
    ),
    "airplane": (
        ("3D/Objects/object_1524.model", 69, None),
        ("3D/Objects/object_1528.model", 72, (0.0472498226, 0, 0, 0, 0.0472498226, 0, 0, 0, 0.100150229, 0.0488595884, 0.0495061332, 3.00000152)),
    ),
    "ambulance": (
        ("3D/Objects/object_1524.model", 69, None),
        ("3D/Objects/object_1530.model", 74, (0.051539018, 0, 0, 0, 0.0597196849, 0, 0, 0, 0.100150229, 0.122223707, -0.0558912436, 3.00000039)),
    ),
    "cat": (
        ("3D/Objects/object_1524.model", 69, None),
        ("3D/Objects/object_1531.model", 76, (0.0527370374, 0, 0, 0, 0.075590557, 0, 0, 0, 0.100150229, 0.0172778225, 0.149471765, 2.99999933)),
    ),
    "uk-flag": (
        ("3D/Objects/object_1524.model", 69, None),
        ("3D/Objects/object_1532.model", 78, (0.0503937008, 0, 0, 0, 0.0503937008, 0, 0, 0, 0.100150229, 0.0843475973, 0.115470467, 2.99999852)),
    ),
    "compass": (
        ("3D/Objects/object_1524.model", 69, None),
        ("3D/Objects/object_1536.model", 80, (0.0581465813, 0, 0, 0, 0.0496685404, 0, 0, 0, 0.100150229, -0.00547721718, 0.00157256457, 2.99999881)),
    ),
}


def read_mesh(archive: zipfile.ZipFile, member: str, object_id: int | None = None):
    root = ET.fromstring(archive.read(member))
    namespace = {"m": CORE_NS}
    objects = root.findall("m:resources/m:object", namespace)
    target = next(
        (item for item in objects if object_id is None or int(item.attrib["id"]) == object_id),
        None,
    )
    mesh = target.find("m:mesh", namespace) if target is not None else None
    if mesh is None:
        raise ValueError(f"No mesh found in {member}")

    vertices = [
        (float(node.attrib["x"]), float(node.attrib["y"]), float(node.attrib["z"]))
        for node in mesh.findall("m:vertices/m:vertex", namespace)
    ]
    triangles = [
        (int(node.attrib["v1"]), int(node.attrib["v2"]), int(node.attrib["v3"]))
        for node in mesh.findall("m:triangles/m:triangle", namespace)
    ]
    return vertices, triangles


def transform_vertices(vertices, transform):
    if transform is None:
        return vertices
    a, b, c, d, e, f, g, h, i, tx, ty, tz = transform
    return [
        (
            x * a + y * d + z * g + tx,
            x * b + y * e + z * h + ty,
            x * c + y * f + z * i + tz,
        )
        for x, y, z in vertices
    ]


def read_composite_mesh(archive: zipfile.ZipFile, parts):
    vertices = []
    triangles = []
    for member, object_id, transform in parts:
        part_vertices, part_triangles = read_mesh(archive, member, object_id)
        offset = len(vertices)
        vertices.extend(transform_vertices(part_vertices, transform))
        triangles.extend(tuple(index + offset for index in triangle) for triangle in part_triangles)
    return vertices, triangles


def triangle_normal(a, b, c):
    ab = (b[0] - a[0], b[1] - a[1], b[2] - a[2])
    ac = (c[0] - a[0], c[1] - a[1], c[2] - a[2])
    cross = (
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0],
    )
    length = math.sqrt(sum(value * value for value in cross)) or 1.0
    return tuple(value / length for value in cross)


def write_binary_stl(path: Path, vertices, triangles):
    header = b"Little Keeps normal grid mesh extracted from supplied 3MF".ljust(80, b" ")
    with path.open("wb") as output:
        output.write(header)
        output.write(struct.pack("<I", len(triangles)))
        for indexes in triangles:
            points = [vertices[index] for index in indexes]
            normal = triangle_normal(*points)
            output.write(struct.pack("<12fH", *normal, *points[0], *points[1], *points[2], 0))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("model_output", type=Path)
    parser.add_argument("image_output", type=Path)
    args = parser.parse_args()
    args.model_output.mkdir(parents=True, exist_ok=True)
    args.image_output.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(args.source) as archive:
        for name, member in BASE_MODELS.items():
            write_binary_stl(
                args.model_output / f"normal-grid-{name}.stl",
                *read_mesh(archive, member),
            )
        for letter, member in CAP_MODELS.items():
            write_binary_stl(
                args.model_output / f"normal-grid-cap-{letter}.stl",
                *read_mesh(archive, member),
            )
        for icon, parts in ICON_MODELS.items():
            write_binary_stl(
                args.model_output / f"normal-grid-cap-icon-{icon}.stl",
                *read_composite_mesh(archive, parts),
            )

        (args.image_output / "classic-grid-clicker-keycaps.png").write_bytes(
            archive.read("Metadata/plate_1.png")
        )
        (args.image_output / "classic-grid-clicker-bases.png").write_bytes(
            archive.read("Metadata/plate_2.png")
        )
        (args.image_output / "classic-grid-clicker-icons.png").write_bytes(
            archive.read("Metadata/plate_3.png")
        )


if __name__ == "__main__":
    main()
