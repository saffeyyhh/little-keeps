function updatePreview() {
  let name = document.getElementById("nameInput").value || "KAYLEE";
  let preview = document.getElementById("previewName");

  preview.innerHTML = "";

  name.toUpperCase().split("").forEach(letter => {
    let tile = document.createElement("span");
    tile.className = "letter-tile";
    tile.innerText = letter;
    preview.appendChild(tile);
  });
}

function chooseBase(colour) {
  document.documentElement.style.setProperty("--base-colour", colour);
}

function chooseLetter(colour) {
  document.documentElement.style.setProperty("--letter-colour", colour);
}

updatePreview();
