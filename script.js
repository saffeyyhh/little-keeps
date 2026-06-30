const baseColours = [
  { name: "Pink", value: "#ff8fab" },
  { name: "Blue", value: "#8ecae6" },
  { name: "Purple", value: "#cdb4db" },
  { name: "Yellow", value: "#ffd166" }
];

const tileColours = [
  { name: "Blue", value: "#8ecae6" },
  { name: "Pink", value: "#ff8fab" },
  { name: "White", value: "#ffffff" },
  { name: "Black", value: "#222222" }
];

const letterColours = [
  { name: "White", value: "#ffffff" },
  { name: "Black", value: "#222222" }
];

let selectedBases = ["#ff8fab", "#8ecae6"]; // alternating colours
let selectedTile = "#8ecae6";
let selectedLetter = "#ffffff";

function createColourButtons(list, containerId, type) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  list.forEach(colour => {
    const button = document.createElement("button");
    button.className = "colour-btn";
    button.innerHTML = `
      <span class="swatch" style="background:${colour.value}"></span>
      ${colour.name}
    `;

    button.onclick = () => {
      if (type === "base") {
        selectedBases.push(colour.value);

        if (selectedBases.length > 2) {
          selectedBases.shift();
        }
      }

      if (type === "tile") {
        selectedTile = colour.value;
        document.documentElement.style.setProperty("--tile-colour", selectedTile);
      }

      if (type === "letter") {
        selectedLetter = colour.value;
        document.documentElement.style.setProperty("--letter-colour", selectedLetter);
      }

      updatePreview();
    };

    container.appendChild(button);
  });
}

function updatePreview() {
  const name = document.getElementById("nameInput").value || "KIEY";
  const preview = document.getElementById("previewName");

  preview.innerHTML = "";

  const connector = document.createElement("div");
  connector.className = "connector";
  preview.appendChild(connector);

  name.toUpperCase().split("").forEach((letter, index) => {
    const block = document.createElement("div");
    block.className = "letter-block";
    block.style.setProperty("--base", selectedBases[index % selectedBases.length]);

    const inner = document.createElement("div");
    inner.className = "inner-tile";

    const text = document.createElement("span");
    text.className = "letter";
    text.innerText = letter;

    inner.appendChild(text);
    block.appendChild(inner);
    preview.appendChild(block);
  });
}

document.getElementById("nameInput").addEventListener("input", updatePreview);

createColourButtons(baseColours, "baseColours", "base");
createColourButtons(tileColours, "tileColours", "tile");
createColourButtons(letterColours, "letterColours", "letter");

document.documentElement.style.setProperty("--tile-colour", selectedTile);
document.documentElement.style.setProperty("--letter-colour", selectedLetter);

updatePreview();
