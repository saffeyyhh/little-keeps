export const PENCIL_SYMBOLS = Object.freeze({
  "@": "@",
  "&": "Ampersand",
  "🦋": "Butterfly",
  "👑": "Crown",
  "=": "Equals",
  "!": "Exclamation Mark",
  "✿": "Flower",
  "#": "Hashtag",
  "♡": "Heart",
  "⚡": "Lightning Bolt",
  "👍": "Like",
  "🌙": "Moon",
  "♪": "Music Note",
  "🐾": "Paw Print",
  "%": "Percent",
  "+": "Plus",
  "?": "Question Mark",
  "🚀": "Rocket",
  "☺": "Smiley Face",
  "★": "Star",
  "☀": "Sun",
  "▶": "YouTube"
});

export const PENCIL_ICON_CATEGORIES = Object.freeze([
  {
    key: "all",
    label: "All",
    icons: Object.keys(PENCIL_SYMBOLS)
  },
  {
    key: "symbols",
    label: "Symbols",
    icons: ["@", "&", "=", "!", "#", "%", "+", "?"]
  },
  {
    key: "pictures",
    label: "Picture symbols",
    icons: ["🦋", "👑", "✿", "♡", "⚡", "👍", "🌙", "♪", "🐾", "🚀", "☺", "★", "☀", "▶"]
  }
]);

export function getPencilCharacterStlName(character) {
  const normalized = String(character || "").toUpperCase();
  if (/^[A-Z]$/.test(normalized)) return `Letter ${normalized} (Raised).stl`;
  if (/^[0-9]$/.test(normalized)) return `Number ${normalized} (Raised).stl`;
  const symbolName = PENCIL_SYMBOLS[character];
  return symbolName ? `Symbol ${symbolName} (Raised).stl` : "";
}

export function sanitizePencilCharacters(value) {
  return Array.from(String(value || ""))
    .map(character => /[a-z]/i.test(character) ? character.toUpperCase() : character)
    .filter(character => /^[A-Z0-9]$/.test(character) || PENCIL_SYMBOLS[character])
    .join("");
}
