#!/usr/bin/env python3
"""Extract the exact LED bases and A-Z caps from the supplied Bambu 3MF."""

from __future__ import annotations

import argparse
import math
import struct
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path


CORE_NS = "http://schemas.microsoft.com/3dmanufacturing/core/2015/02"

BASE_MODELS = {
    "base-3x3": "3D/Objects/object_1421.model",
    "base-variant-1426": "3D/Objects/object_1426.model",
    "base-variant-1423": "3D/Objects/object_1423.model",
    "base-variant-1424": "3D/Objects/object_1424.model",
    "base-variant-1420": "3D/Objects/object_1420.model",
    "base-variant-1417": "3D/Objects/object_1417.model",
}

# The caps are laid out A-Z in four plate columns and seven plate rows.
CAP_MODELS = {
    "A": "3D/Objects/object_1371.model",
    "B": "3D/Objects/object_1372.model",
    "C": "3D/Objects/object_1367.model",
    "D": "3D/Objects/object_1376.model",
    "E": "3D/Objects/object_1384.model",
    "F": "3D/Objects/object_1373.model",
    "G": "3D/Objects/object_1370.model",
    "H": "3D/Objects/object_1377.model",
    "I": "3D/Objects/object_1378.model",
    "J": "3D/Objects/object_1382.model",
    "K": "3D/Objects/object_1368.model",
    "L": "3D/Objects/object_1374.model",
    "M": "3D/Objects/object_1369.model",
    "N": "3D/Objects/object_1379.model",
    "O": "3D/Objects/object_1375.model",
    "P": "3D/Objects/object_1380.model",
    "Q": "3D/Objects/object_1381.model",
    "R": "3D/Objects/object_1385.model",
    "S": "3D/Objects/object_1386.model",
    "T": "3D/Objects/object_1365.model",
    "U": "3D/Objects/object_1390.model",
    "V": "3D/Objects/object_1389.model",
    "W": "3D/Objects/object_1387.model",
    "X": "3D/Objects/object_1366.model",
    "Y": "3D/Objects/object_1388.model",
    "Z": "3D/Objects/object_1383.model",
}


def read_mesh(archive: zipfile.ZipFile, member: str):
    root = ET.fromstring(archive.read(member))
    namespace = {"m": CORE_NS}
    mesh = root.find("m:resources/m:object/m:mesh", namespace)
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
    header = b"Little Keeps LED mesh extracted from supplied 3MF".ljust(80, b" ")
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
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(args.source) as archive:
        for name, member in BASE_MODELS.items():
            write_binary_stl(args.output / f"led-{name}.stl", *read_mesh(archive, member))
        for letter, member in CAP_MODELS.items():
            write_binary_stl(args.output / f"led-cap-{letter}.stl", *read_mesh(archive, member))


if __name__ == "__main__":
    main()
