function updatePreview() {
  let name = document.getElementById("nameInput").value || "KAYLEE";
  let preview = document.getElementById("previewName");

  preview.innerHTML = "";

  name.toUpperCase().split("").forEach(letter => {
    let tile = document.createElement("div");
    tile.className = "letter-tile";

    let inner = document.createElement("div");
    inner.className = "inner-tile";

    let text = document.createElement("span");
    text.className = "letter";
    text.innerText = letter;

    inner.appendChild(text);
    tile.appendChild(inner);
    preview.appendChild(tile);
  });
}

function chooseBase(colour) {
  document.documentElement.style.setProperty("--base-colour", colour);
}

function chooseLetter(colour) {
  document.documentElement.style.setProperty("--letter-colour", colour);
}

function chooseTile(colour) {
  document.documentElement.style.setProperty("--tile-colour", colour);
}

updatePreview();
