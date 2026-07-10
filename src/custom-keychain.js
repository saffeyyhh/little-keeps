const steps = document.querySelectorAll(".step");
const nextBtns = document.querySelectorAll(".next");
const backBtns = document.querySelectorAll(".back");
const progressBar = document.getElementById("progressBar");
const stepText = document.getElementById("stepText");
const photoInput = document.getElementById("petPhoto");
const photoPreview = document.getElementById("photoPreview");
const reviewBox = document.getElementById("reviewBox");
const form = document.getElementById("customForm");

let currentStep = 0;
let uploadedImageUrl = "";

function showStep(index) {
  steps.forEach((step, i) => {
    step.classList.toggle("active", i === index);
  });

  const progress = ((index + 1) / steps.length) * 100;
  progressBar.style.width = `${progress}%`;
  stepText.textContent = `Step ${index + 1} of ${steps.length}`;

  if (index === steps.length - 1) {
    updateReview();
  }
}

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) return;

  uploadedImageUrl = URL.createObjectURL(file);
  photoPreview.src = uploadedImageUrl;
  photoPreview.classList.remove("hidden");

  try {
  photoPreview.classList.add("loading");

  const aiImage = await generateAIPreview(file);
    uploadedImageUrl = aiImage;
    photoPreview.src = aiImage;
    } catch (error) {
    console.error(error);
    alert("AI preview failed, showing original photo for now.");
    } finally {
    photoPreview.classList.remove("loading");
    }
});

nextBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (currentStep === 0 && !photoInput.files[0]) {
      alert("Please upload a pet photo first.");
      return;
    }

    if (currentStep < steps.length - 1) {
      currentStep++;
      showStep(currentStep);
    }
  });
});

backBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (currentStep > 0) {
      currentStep--;
      showStep(currentStep);
    }
  });
});

function updateReview() {
  const petName = document.getElementById("petName").value || "No name added";
  const style = document.querySelector("input[name='style']:checked").value;
  const size = document.querySelector("input[name='size']:checked").value;

  reviewBox.innerHTML = `
    ${uploadedImageUrl ? `<img src="${uploadedImageUrl}" alt="Pet preview">` : ""}
    <strong>Pet name:</strong> ${petName}<br>
    <strong>Style:</strong> ${style}<br>
    <strong>Size:</strong> ${size}<br>
    <strong>Estimated price:</strong> S$14.90 onwards<br><br>
    <small>Design preview will be sent before printing.</small>
  `;
}

async function generateAIPreview(file) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch("http://localhost:3001/api/pet-preview", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) throw new Error("AI preview failed");

  const data = await response.json();
  return data.image;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  alert("Order submitted! Next we connect this to Firebase.");
});

showStep(currentStep);