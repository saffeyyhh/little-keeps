const baseColours = [
  { name: "Pink", value: "#ff8fab" },
  { name: "Blue", value: "#8ecae6" },
  { name: "Purple", value: "#cdb4db" }
];

const tileColours = [
  { name: "Pink", value: "#ff8fab" },
  { name: "Blue", value: "#8ecae6" },
  { name: "White", value: "#ffffff" },
  { name: "Black", value: "#222222" }
];

const letterColours = [
  { name: "White", value: "#ffffff" },
  { name: "Black", value: "#222222" }
];

let selectedBase = baseColours[0].value;
let selectedTile = tileColours[1].value;
let selectedLetter = letterColours[0].value;

function createColourButtons(list, containerId, type) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  list.forEach(colour => {
    const button = document.createElement("button");
    button.className = "colour-btn";
    button.onclick = () => selectColour(type, colour.value);

    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = colour.value;

    const label = document.createElement("span");
    label.innerText = colour.name;

    button.appendChild(swatch);
    button.appendChild(label);
    container.appendChild(button);
  });
}

function selectColour(type, value) {
  if (type === "base") selectedBase = value;
  if (type === "tile") selectedTile = value;
  if (type === "letter") selectedLetter = value;

  document.documentElement.style.setProperty("--base-colour", selectedBase);
  document.documentElement.style.setProperty("--tile-colour", selectedTile);
  document.documentElement.style.setProperty("--letter-colour", selectedLetter);

  updateSelectedButtons();
}

function updateSelectedButtons() {
  document.querySelectorAll(".colour-btn").forEach(button => {
    button.classList.remove("selected");
  });
}

function updatePreview() {
  const name = document.getElementById("nameInput").value || "KAYLEE";
  const preview = document.getElementById("previewName");

  preview.innerHTML = "";

  name.toUpperCase().split("").forEach(letter => {
    const tile = document.createElement("div");
    tile.className = "letter-tile";

    const inner = document.createElement("div");
    inner.className = "inner-tile";

    const text = document.createElement("span");
    text.className = "letter";
    text.innerText = letter;

    inner.appendChild(text);
    tile.appendChild(inner);
    preview.appendChild(tile);
  });
}

document.getElementById("nameInput").addEventListener("input", updatePreview);

createColourButtons(baseColours, "baseColours", "base");
createColourButtons(tileColours, "tileColours", "tile");
createColourButtons(letterColours, "letterColours", "letter");

updatePreview();
