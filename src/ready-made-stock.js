export function getUnavailableReadyMadeColours(
  selections = {},
  colourOptions = [],
  unavailableColourNames = []
) {
  const unavailableNames = new Set(
    Array.from(unavailableColourNames || []).map(name => String(name || "").trim().toLowerCase())
  );
  const stockByName = new Map(
    (Array.isArray(colourOptions) ? colourOptions : []).map(colour => [
      String(colour?.name || "").trim().toLowerCase(),
      colour
    ])
  );

  return Object.entries(selections || {})
    .filter(([optionName]) => String(optionName).toLowerCase().includes("colour"))
    .map(([, value]) => String(value || "").trim())
    .filter(Boolean)
    .filter((name, index, list) => list.indexOf(name) === index)
    .filter(name => {
      const stockColour = stockByName.get(name.toLowerCase());
      return !stockColour || !stockColour.active || unavailableNames.has(name.toLowerCase());
    });
}
