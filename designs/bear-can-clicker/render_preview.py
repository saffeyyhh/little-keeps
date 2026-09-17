"""Create a lightweight shaded preview of the generated STL assembly."""

from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
import trimesh


ROOT = Path(__file__).resolve().parent
STL = ROOT / "stl"
OUTPUT = ROOT / "bear_can_clicker_preview.png"
WIDTH, HEIGHT = 1200, 1000


def camera_basis(position, target):
    forward = target - position
    forward /= np.linalg.norm(forward)
    right = np.cross(forward, np.array([0.0, 0.0, 1.0]))
    right /= np.linalg.norm(right)
    up = np.cross(right, forward)
    return right, up, forward


def shaded_faces(mesh, colour, view, light):
    right, up, forward = view
    triangles = mesh.triangles
    normals = mesh.face_normals
    projected = np.stack((triangles @ right, triangles @ up), axis=-1)
    depth = (triangles @ forward).mean(axis=1)
    intensity = np.clip(0.35 + 0.65 * np.maximum(0, normals @ light), 0.28, 1.0)
    faces = []
    for points, z, shade in zip(projected, depth, intensity):
        rgb = tuple(int(np.clip(channel * shade, 0, 255)) for channel in colour)
        faces.append((z, points, rgb))
    return faces


def main():
    base = trimesh.load_mesh(STL / "bear_can_clicker_base.stl")
    top = trimesh.load_mesh(STL / "bear_can_clicker_top.stl")
    top.apply_translation((0, 0, 21.0))

    view = camera_basis(
        np.array([78.0, -105.0, 73.0]),
        np.array([0.0, 0.0, 29.0])
    )
    light = np.array([-0.35, -0.65, 0.68])
    light /= np.linalg.norm(light)

    faces = []
    faces.extend(shaded_faces(base, (225, 54, 58), view, light))
    faces.extend(shaded_faces(top, (247, 244, 235), view, light))
    all_points = np.concatenate([face[1] for face in faces], axis=0)
    mins = all_points.min(axis=0)
    maxs = all_points.max(axis=0)
    scale = min((WIDTH - 150) / (maxs[0] - mins[0]), (HEIGHT - 150) / (maxs[1] - mins[1]))
    centre = (mins + maxs) / 2

    image = Image.new("RGB", (WIDTH, HEIGHT), (246, 241, 233))
    draw = ImageDraw.Draw(image)
    for _, points, colour in sorted(faces, key=lambda item: item[0], reverse=True):
        screen = []
        for x, y in points:
            screen.append((
                WIDTH / 2 + (x - centre[0]) * scale,
                HEIGHT / 2 - (y - centre[1]) * scale
            ))
        draw.polygon(screen, fill=colour)

    image.save(OUTPUT, quality=95)
    print(OUTPUT)


if __name__ == "__main__":
    main()
