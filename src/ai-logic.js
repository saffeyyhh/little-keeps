export function normalizeAiDesignSuggestions(suggestions, availableColours, allowedIcons = []) {
  const byHex = new Map((availableColours || []).map(item => [String(item.hex || item.colour || "").toUpperCase(), item]));
  const icons = new Set(allowedIcons || []);
  return (Array.isArray(suggestions) ? suggestions : []).flatMap(item => {
    const baseHex = String(item?.base_hex || "").toUpperCase();
    const capHex = String(item?.cap_hex || "").toUpperCase();
    const letterHex = String(item?.letter_hex || "").toUpperCase();
    if (!byHex.has(baseHex) || !byHex.has(capHex) || !byHex.has(letterHex)) return [];
    return [{
      title: String(item?.title || "Colour idea").slice(0, 60),
      description: String(item?.description || "").slice(0, 140),
      reason: String(item?.reason || "").slice(0, 180),
      icon: icons.has(item?.icon) ? item.icon : "",
      baseHex,
      capHex,
      letterHex,
      colours: [byHex.get(baseHex), byHex.get(capHex), byHex.get(letterHex)]
    }];
  }).slice(0, 3);
}
