import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const source = process.argv[2];
const outputDirectory = process.argv[3] || "public/models/pencil";

if (!source) {
  throw new Error("Pass the licensed pencil 3MF path as the first argument.");
}

const previewParts = [
  { name: "body", file: 2, objectId: 9, offset: [0, 0, 0] },
  { name: "tip", file: 3, objectId: 24, offset: [-40, 0, 0] },
  { name: "eraser", file: 4, objectId: 50, offset: [51.5, 0, 0] },
  { name: "end-cap", file: 5, objectId: 63, offset: [8, 0, 0] },
  { name: "nose", file: 6, objectId: 76, offset: [-26.5, 0, 0] },
  { name: "ferrule", file: 8, objectId: 97, offset: [28.5, 0, 0] },
  { name: "top", file: 122, objectId: 37, offset: [0, 18.5, 0] }
];

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "little-keeps-pencil-"));
fs.mkdirSync(outputDirectory, { recursive: true });

function extractObjectXml(fileNumber) {
  const internalPath = `3D/Objects/object_${fileNumber}.model`;
  const destination = path.join(temporaryDirectory, `object_${fileNumber}.model`);
  const xml = execFileSync("unzip", ["-p", source, internalPath], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  fs.writeFileSync(destination, xml);
  return xml;
}

function meshForObject(xml, objectId) {
  const objectMatch = xml.match(new RegExp(`<object\\s+id="${objectId}"[^>]*>([\\s\\S]*?)<\\/object>`));
  if (!objectMatch) throw new Error(`Object ${objectId} was not found.`);

  const vertices = [...objectMatch[1].matchAll(/<vertex\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"\s*\/>/g)]
    .map(match => match.slice(1, 4).map(Number));
  const triangles = [...objectMatch[1].matchAll(/<triangle\s+v1="(\d+)"\s+v2="(\d+)"\s+v3="(\d+)"(?:\s+[^>]*)?\/>/g)]
    .map(match => match.slice(1, 4).map(Number));

  if (!vertices.length || !triangles.length) throw new Error(`Object ${objectId} has no mesh.`);
  return { vertices, triangles };
}

function writeBinaryStl(destination, mesh, offset) {
  const buffer = Buffer.alloc(84 + mesh.triangles.length * 50);
  buffer.write("Little Keeps browser preview - not production geometry", 0, "ascii");
  buffer.writeUInt32LE(mesh.triangles.length, 80);

  const bounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity]
  };
  let cursor = 84;
  for (const triangle of mesh.triangles) {
    const points = triangle.map(index => mesh.vertices[index].map((value, axis) => value + offset[axis]));
    const u = points[1].map((value, axis) => value - points[0][axis]);
    const v = points[2].map((value, axis) => value - points[0][axis]);
    const normal = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0]
    ];
    const normalLength = Math.hypot(...normal) || 1;
    normal.forEach((value, axis) => buffer.writeFloatLE(value / normalLength, cursor + axis * 4));
    cursor += 12;
    for (const point of points) {
      point.forEach((value, axis) => {
        buffer.writeFloatLE(value, cursor + axis * 4);
        bounds.min[axis] = Math.min(bounds.min[axis], value);
        bounds.max[axis] = Math.max(bounds.max[axis], value);
      });
      cursor += 12;
    }
    buffer.writeUInt16LE(0, cursor);
    cursor += 2;
  }

  fs.writeFileSync(destination, buffer);
  return bounds;
}

const manifest = {};
for (const part of previewParts) {
  const xml = extractObjectXml(part.file);
  const mesh = meshForObject(xml, part.objectId);
  const filename = `${part.name}.stl`;
  const bounds = writeBinaryStl(path.join(outputDirectory, filename), mesh, part.offset);
  manifest[part.name] = {
    file: filename,
    triangles: mesh.triangles.length,
    bounds
  };
}

fs.writeFileSync(
  path.join(outputDirectory, "manifest.json"),
  `${JSON.stringify({ notice: "Browser preview only - not production geometry", parts: manifest }, null, 2)}\n`
);

fs.rmSync(temporaryDirectory, { recursive: true, force: true });
console.log(JSON.stringify(manifest, null, 2));
