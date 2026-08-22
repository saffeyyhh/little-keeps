import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import {
  getArtworkColourClusters,
  mapArtworkClustersToFilaments
} from "./photo-palette.js";

const photoStlExporter = new STLExporter();

function buildPhotoPixelGeometry(mask, width, height, cellSize, zStart, depth) {
  const positions = [];
  const zEnd = zStart + depth;
  const offsetX = width * cellSize / 2;
  const offsetY = height * cellSize / 2;
  const addTriangle = (a, b, c) => positions.push(...a, ...b, ...c);
  const addQuad = (a, b, c, d) => {
    addTriangle(a, b, c);
    addTriangle(a, c, d);
  };
  const hasCell = (row, column) =>
    row >= 0 && row < height && column >= 0 && column < width && mask[row * width + column];

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      if (!hasCell(row, column)) continue;
      const x0 = column * cellSize - offsetX;
      const x1 = x0 + cellSize;
      const y0 = (height - row - 1) * cellSize - offsetY;
      const y1 = y0 + cellSize;

      addQuad([x0, y0, zEnd], [x1, y0, zEnd], [x1, y1, zEnd], [x0, y1, zEnd]);
      addQuad([x0, y1, zStart], [x1, y1, zStart], [x1, y0, zStart], [x0, y0, zStart]);
      if (!hasCell(row, column - 1)) {
        addQuad([x0, y0, zStart], [x0, y0, zEnd], [x0, y1, zEnd], [x0, y1, zStart]);
      }
      if (!hasCell(row, column + 1)) {
        addQuad([x1, y1, zStart], [x1, y1, zEnd], [x1, y0, zEnd], [x1, y0, zStart]);
      }
      if (!hasCell(row - 1, column)) {
        addQuad([x0, y1, zStart], [x0, y1, zEnd], [x1, y1, zEnd], [x1, y1, zStart]);
      }
      if (!hasCell(row + 1, column)) {
        addQuad([x1, y0, zStart], [x1, y0, zEnd], [x0, y0, zEnd], [x0, y0, zStart]);
      }
    }
  }

  if (!positions.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function exportPhotoGeometryStl(geometry) {
  const binary = photoStlExporter.parse(new THREE.Mesh(geometry), { binary: true });
  return new Blob([binary], { type: "model/stl" });
}

export async function preparePhotoArtworkStlParts(artworkUrl, colourCount, filamentPalette) {
  const response = await fetch(artworkUrl);
  if (!response.ok) throw new Error("The private artwork could not be downloaded.");
  const bitmap = await createImageBitmap(await response.blob());
  const source = document.createElement("canvas");
  source.width = bitmap.width;
  source.height = bitmap.height;
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  sourceContext.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const sourcePixels = sourceContext.getImageData(0, 0, source.width, source.height);

  let minX = source.width;
  let minY = source.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      if (sourcePixels.data[(y * source.width + x) * 4 + 3] < 128) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) throw new Error("The artwork is fully transparent.");

  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  const scale = Math.min(1, 140 / Math.max(cropWidth, cropHeight));
  const width = Math.max(8, Math.round(cropWidth * scale));
  const height = Math.max(8, Math.round(cropHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, minX, minY, cropWidth, cropHeight, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const centres = getArtworkColourClusters(pixels, colourCount);
  const mappedPalette = mapArtworkClustersToFilaments(centres, filamentPalette);
  if (mappedPalette.length < centres.length) {
    throw new Error("This artwork has no complete saved filament palette. Regenerate it first.");
  }
  const backingMask = new Uint8Array(width * height);
  const colourMasks = centres.map(() => new Uint8Array(width * height));

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    if (pixels[offset + 3] < 128) continue;
    backingMask[index] = 1;
    const colour = [pixels[offset], pixels[offset + 1], pixels[offset + 2]];
    let closest = 0;
    let closestDistance = Infinity;
    centres.forEach((centre, centreIndex) => {
      const distance =
        (colour[0] - centre[0]) ** 2 +
        (colour[1] - centre[1]) ** 2 +
        (colour[2] - centre[2]) ** 2;
      if (distance < closestDistance) {
        closest = centreIndex;
        closestDistance = distance;
      }
    });
    colourMasks[closest][index] = 1;
  }

  const cellSize = 60 / Math.max(width, height);
  const backing = buildPhotoPixelGeometry(backingMask, width, height, cellSize, 0, 1.6);
  const colours = colourMasks.map(mask =>
    buildPhotoPixelGeometry(mask, width, height, cellSize, 1.6, .7)
  );
  const colourPixelCounts = colourMasks.map(mask =>
    mask.reduce((sum, value) => sum + value, 0)
  );
  return {
    backing,
    colours,
    mappedPalette,
    backingPaletteIndex: colourPixelCounts.indexOf(Math.max(...colourPixelCounts)),
    widthMm: width * cellSize,
    heightMm: height * cellSize
  };
}
