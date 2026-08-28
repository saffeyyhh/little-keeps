import { getPencilCharacterStlName } from "./pencil-characters.js";

const PENCIL_BODY_FILE = "Pencil Body.stl";
const PENCIL_TOP_FILE = "Blanked Customizable TOP.stl";
const PENCIL_NOSE_FILE = "Pencil Nose.stl";
const PENCIL_TIP_FILE = "Pencil Tip.stl";
const PENCIL_FERRULE_FILE = "Ferrule.stl";
const PENCIL_ERASER_FILE = "Eraser.stl";
const PENCIL_END_CAP_FILE = "Pencil End Cap - Single Color.stl";

function colourName(value, fallback) {
  if (value && typeof value === "object") return String(value.name || fallback);
  return String(value || fallback);
}

function colourAt(values, index, fallback) {
  const list = Array.isArray(values) ? values.filter(Boolean) : [];
  return colourName(list[index % Math.max(1, list.length)], fallback);
}

function addPart(parts, sourceName, role, colour, pieces) {
  const existing = parts.find(part =>
    part.sourceName === sourceName &&
    part.role === role &&
    part.colour === colour
  );
  if (existing) existing.pieces += pieces;
  else parts.push({ sourceName, role, colour, pieces });
}

export function buildPencilStlPackPlan({ order = {}, item = {}, quantity = 1 } = {}) {
  const design = item.design || {};
  const pencil = design.pencil || {};
  const orderedQuantity = Math.max(1, Number(quantity) || Number(item.quantity) || 1);
  const rawCharacters = Array.from(String(item.clean_name || item.name || ""))
    .filter(character => character !== "\uFE0F");
  const unsupported = rawCharacters.filter(character => !getPencilCharacterStlName(character));

  if (!rawCharacters.length) throw new Error("This pencil design has no characters.");
  if (unsupported.length) {
    throw new Error(`Missing licensed STL mapping for: ${Array.from(new Set(unsupported)).join(" ")}`);
  }

  const blocks = rawCharacters.map((character, index) => ({
    position: index + 1,
    character,
    bodyColour: colourAt(design.bases, index, "Sunflower Yellow"),
    topColour: colourAt(design.caps, index, "Sunflower Yellow"),
    characterColour: colourAt(design.letters, index, "Jade White"),
    characterFile: getPencilCharacterStlName(character)
  }));
  const parts = [];

  blocks.forEach(block => {
    addPart(parts, PENCIL_BODY_FILE, "Pencil block", block.bodyColour, orderedQuantity);
    addPart(parts, PENCIL_TOP_FILE, "Clicker top", block.topColour, orderedQuantity);
    addPart(parts, block.characterFile, `Character ${block.character}`, block.characterColour, orderedQuantity);
  });

  const woodColour = colourName(pencil.wood, "Desert Tan");
  const tipColour = colourName(pencil.tip, "Black");
  addPart(parts, PENCIL_NOSE_FILE, "Wood nose", woodColour, orderedQuantity);
  addPart(parts, PENCIL_TIP_FILE, "Pencil tip", tipColour, orderedQuantity);

  const endingStyle = String(pencil.ending_style || "eraser") === "endCap"
    ? "endCap"
    : "eraser";
  if (endingStyle === "endCap") {
    addPart(
      parts,
      PENCIL_END_CAP_FILE,
      "End cap",
      colourName(pencil.end_cap, "Sunflower Yellow"),
      orderedQuantity
    );
  } else {
    addPart(
      parts,
      PENCIL_FERRULE_FILE,
      "Metal band",
      colourName(pencil.ferrule, "Blue Grey"),
      orderedQuantity
    );
    addPart(
      parts,
      PENCIL_ERASER_FILE,
      "Eraser",
      colourName(pencil.eraser, "Pink"),
      orderedQuantity
    );
  }

  return {
    orderReference: String(order.order_ref || order.id || "ORDER"),
    designName: String(item.name || item.clean_name || "Custom Pencil"),
    orderedQuantity,
    endingStyle,
    blocks,
    parts,
    requiredFiles: Array.from(new Set(parts.map(part => part.sourceName)))
  };
}

export function buildPencilStlManifest(plan) {
  const lines = [
    "LITTLE KEEPS · CUSTOM PENCIL CLICKER STL PACK",
    `Order: ${plan.orderReference}`,
    `Design: ${plan.designName}`,
    `Finished pencils required: ${plan.orderedQuantity}`,
    "",
    "ASSEMBLY ORDER (nose to ending)",
    ...plan.blocks.map(block =>
      `${block.position}. ${block.character} · body ${block.bodyColour} · top ${block.topColour} · character ${block.characterColour} · ${block.characterFile}`
    ),
    "",
    `ENDING: ${plan.endingStyle === "endCap" ? "End cap" : "Ferrule + eraser"}`,
    "",
    "PRINT LIST",
    ...plan.parts.map(part =>
      `- ${part.sourceName} · ${part.role} · ${part.colour} · ${part.pieces} piece${part.pieces === 1 ? "" : "s"}`
    ),
    "",
    "The STL files are the original licensed source parts selected from your local folder.",
    "Use the quantities and colours above, then assemble one block per character in the listed order."
  ];
  return `${lines.join("\n")}\n`;
}
