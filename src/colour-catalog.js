export const DEFAULT_COLOUR_OPTIONS = [
  { name: "Jade White", hex: "#FFFFFF", active: true },
  { name: "Sunflower Yellow", hex: "#FEC600", active: true },
  { name: "Gold", hex: "#E4BD68", active: true },
  { name: "Pink", hex: "#F55A74", active: true },
  { name: "Maroon Red", hex: "#9D2235", active: true },
  { name: "Turquoise", hex: "#00B1B7", active: true },
  { name: "Cyan", hex: "#0086D6", active: true },
  { name: "Mistletoe Green", hex: "#3F8E43", active: true },
  { name: "Dark Green", hex: "#68724D", active: true },
  { name: "Purple", hex: "#5E43B7", active: true },
  { name: "Indigo Purple", hex: "#482960", active: true },
  { name: "Black", hex: "#000000", active: true }
];

function normalizeHex(value) {
  const hex = String(value || "").trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(hex)) return hex;
  if (/^#[0-9A-F]{3}$/.test(hex)) {
    return `#${hex.slice(1).split("").map(character => character.repeat(2)).join("")}`;
  }
  return "";
}

export function normalizeColourOptions(value, fallback = DEFAULT_COLOUR_OPTIONS) {
  const source = Array.isArray(value) && value.length ? value : fallback;
  const seenNames = new Set();
  const seenHexes = new Set();

  const normalized = source.flatMap(item => {
    const name = String(item?.name || "").trim();
    const hex = normalizeHex(item?.hex || item?.colour);
    const nameKey = name.toLowerCase();

    if (!name || !hex || seenNames.has(nameKey) || seenHexes.has(hex)) return [];
    seenNames.add(nameKey);
    seenHexes.add(hex);
    return [{ name, hex, active: item?.active !== false }];
  });

  return normalized.length
    ? normalized
    : DEFAULT_COLOUR_OPTIONS.map(colour => ({ ...colour }));
}
