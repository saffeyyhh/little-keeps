function normalizeHex(value) {
  const hex = String(value || "").trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(hex)) return hex;
  if (/^#[0-9A-F]{3}$/.test(hex)) {
    return `#${hex.slice(1).split("").map(character => character.repeat(2)).join("")}`;
  }
  return "";
}

function hexToRgb(value) {
  const hex = normalizeHex(value);
  if (!hex) return null;
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16)
  ];
}

function rgbToLab(value) {
  const linear = value.map(channel => {
    const normalized = channel / 255;
    return normalized <= .04045
      ? normalized / 12.92
      : ((normalized + .055) / 1.055) ** 2.4;
  });
  const x = (linear[0] * .4124 + linear[1] * .3576 + linear[2] * .1805) / .95047;
  const y = linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  const z = (linear[0] * .0193 + linear[1] * .1192 + linear[2] * .9505) / 1.08883;
  const pivot = component => component > .008856
    ? component ** (1 / 3)
    : 7.787 * component + 16 / 116;
  const fx = pivot(x);
  const fy = pivot(y);
  const fz = pivot(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function colourDistance(left, right) {
  const red = left[0] - right[0];
  const green = left[1] - right[1];
  const blue = left[2] - right[2];
  return red * red + green * green + blue * blue;
}

function labDistance(left, right) {
  const lightness = left[0] - right[0];
  const greenRed = left[1] - right[1];
  const blueYellow = left[2] - right[2];
  return lightness * lightness + greenRed * greenRed + blueYellow * blueYellow;
}

export function normalizePhotoFilamentPalette(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).flatMap(item => {
    const name = String(item?.name || "").trim();
    const hex = normalizeHex(item?.hex || item?.colour);
    const materialType = ["BASIC", "MATTE"].includes(String(item?.material_type || item?.materialType || "").toUpperCase())
      ? String(item?.material_type || item?.materialType).toUpperCase()
      : "BASIC";
    if (!name || !hex || seen.has(hex)) return [];
    seen.add(hex);
    return [{ name, hex, material_type: materialType }];
  });
}

export function getArtworkColourClusters(pixelData, colourCount) {
  const histogram = new Map();
  for (let index = 0; index < pixelData.length; index += 4) {
    if (pixelData[index + 3] < 128) continue;
    const red = Math.min(255, Math.round(pixelData[index] / 16) * 16);
    const green = Math.min(255, Math.round(pixelData[index + 1] / 16) * 16);
    const blue = Math.min(255, Math.round(pixelData[index + 2] / 16) * 16);
    const key = `${red},${green},${blue}`;
    histogram.set(key, (histogram.get(key) || 0) + 1);
  }

  const colours = Array.from(histogram, ([key, count]) => ({
    value: key.split(",").map(Number),
    count
  })).sort((left, right) => right.count - left.count);
  if (!colours.length) throw new Error("The artwork has no visible printable pixels.");

  const targetCount = Math.min(Math.max(2, Number(colourCount) || 4), colours.length);
  const centres = [colours[0].value.slice()];
  while (centres.length < targetCount) {
    let best = colours[0];
    let bestScore = -1;
    colours.forEach(entry => {
      const distance = Math.min(...centres.map(centre => colourDistance(entry.value, centre)));
      const score = distance * Math.sqrt(entry.count);
      if (score > bestScore) {
        best = entry;
        bestScore = score;
      }
    });
    centres.push(best.value.slice());
  }

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const totals = centres.map(() => [0, 0, 0, 0]);
    colours.forEach(entry => {
      let closest = 0;
      let closestDistance = Infinity;
      centres.forEach((centre, index) => {
        const distance = colourDistance(entry.value, centre);
        if (distance < closestDistance) {
          closest = index;
          closestDistance = distance;
        }
      });
      totals[closest][0] += entry.value[0] * entry.count;
      totals[closest][1] += entry.value[1] * entry.count;
      totals[closest][2] += entry.value[2] * entry.count;
      totals[closest][3] += entry.count;
    });
    totals.forEach((total, index) => {
      if (!total[3]) return;
      centres[index] = [total[0] / total[3], total[1] / total[3], total[2] / total[3]];
    });
  }

  return centres.sort((left, right) =>
    (left[0] + left[1] + left[2]) - (right[0] + right[1] + right[2])
  );
}

export function mapArtworkClustersToFilaments(centres, palette) {
  const options = normalizePhotoFilamentPalette(palette).map(item => ({
    ...item,
    rgb: hexToRgb(item.hex)
  }));
  if (!options.length) return [];

  const mapped = [];
  const used = new Set();
  centres.forEach(centre => {
    const centreLab = rgbToLab(centre);
    let bestIndex = -1;
    let bestDistance = Infinity;
    options.forEach((option, index) => {
      if (used.has(index)) return;
      const distance = labDistance(centreLab, rgbToLab(option.rgb));
      if (distance < bestDistance) {
        bestIndex = index;
        bestDistance = distance;
      }
    });
    if (bestIndex < 0) bestIndex = 0;
    used.add(bestIndex);
    const { rgb, ...item } = options[bestIndex];
    mapped.push(item);
  });
  return mapped;
}
