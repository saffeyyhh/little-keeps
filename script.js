alert("script loaded");

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

let selectedBase = "#ff8fab";
let selectedTile = "#8ecae6";
let selectedLetter = "#ffffff";

function createColourButtons(list, containerId, type) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  list.forEach(colour => {
    const button = document.createElement("button");
    button.className = "colour-btn";
    button.onclick = function () {
      selectColour(type, colour.value);
    };

    button.innerHTML = `
      <span class="swatch" style="background:${colour.value}"></span>
      <span>${colour.name}</span>
    `;

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
}

function updatePreview() {
  const name = document.getElementById("nameInput").value || "KAYLEE";
  const preview = document.getElementById("previewName");

  preview.innerHTML = "";

  name.toUpperCase().split("").forEach(letter => {
    const outer = document.createElement("div");
    outer.className = "letter-tile";

    const inner = document.createElement("div");
    inner.className = "inner-tile";

    const text = document.createElement("span");
    text.className = "letter";
    text.innerText = letter;

    inner.appendChild(text);
    outer.appendChild(inner);
    preview.appendChild(outer);
  });
}

document.getElementById("nameInput").addEventListener("input", updatePreview);

createColourButtons(baseColours, "baseColours", "base");
createColourButtons(tileColours, "tileColours", "tile");
createColourButtons(letterColours, "letterColours", "letter");

selectColour("base", selectedBase);
selectColour("tile", selectedTile);
selectColour("letter", selectedLetter);
updatePreview();
