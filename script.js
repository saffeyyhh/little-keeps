function updatePreview() {
  let name = document.getElementById("nameInput").value;
  document.getElementById("previewName").innerText = name || "YOUR NAME";
}

function chooseBase(colour) {
  document.getElementById("previewBox").style.backgroundColor = colour;
}

function chooseLetter(colour) {
  document.getElementById("previewName").style.color = colour;
}
