import {
  db,
  auth,
  storage,
  limit,
  onAuthStateChanged,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "../Firebase/config.js";
import notyf from "../Notyf/notyf.js";
import showLoading from "../Notyf/loader.js";
import imageUploadHandler from "../Cloudinary/imageUploadHandler.js";

let currentUser = null;
let selectedCategories = [];
let shopLogoUrl = null;
let shopCoverUrl = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  currentUser = user;

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (!userDoc.exists() || userDoc.data().userRole !== "vendor") {
      notyf.error("Access denied. Vendor only area.");
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
      return;
    }

    const shopsQuery = query(
      collection(db, "shops"),
      where("vendorId", "==", user.uid),
      limit(1),
    );

    const shopsSnapshot = await getDocs(shopsQuery);

    if (!shopsSnapshot.empty) {
      const shopDoc = shopsSnapshot.docs[0];
      const shopData = shopDoc.data();

      if (shopData.isActive !== false) {
        notyf.info("You already have a shop. Redirecting to dashboard...");
        setTimeout(() => {
          window.location.href = "/vendor";
        }, 2000);
        return;
      }
    }

    setupEventListeners();
    initializeForm();
  } catch (error) {
    console.error("Error initializing shop setup:", error);
    notyf.error("Failed to initialize shop setup");
  }
});

function setupEventListeners() {
  const description = document.getElementById("shopDescription");
  description.addEventListener("input", () => {
    const count = description.value.length;
    document.getElementById("descCharCount").textContent = count;
  });

  const logoUploadArea = document.getElementById("logoUploadArea");
  const logoInput = document.getElementById("shopLogo");
  const logoPlaceholder = document.getElementById("logoPlaceholder");
  const logoPreview = document.getElementById("logoPreview");
  const logoImage = document.getElementById("logoImage");

  logoUploadArea.addEventListener("click", () => {
    logoInput.click();
  });

  logoInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        logoImage.src = e.target.result;
        logoPlaceholder.style.display = "none";
        logoPreview.style.display = "block";
      };
      reader.readAsDataURL(file);
      shopLogoUrl = file;
    }
  });

  document.querySelector(".remove-logo")?.addEventListener("click", (e) => {
    e.stopPropagation();
    logoInput.value = "";
    logoPlaceholder.style.display = "flex";
    logoPreview.style.display = "none";
    shopLogoUrl = null;
  });

  const coverUploadArea = document.getElementById("coverUploadArea");
  const coverInput = document.getElementById("shopCover");
  const coverPlaceholder = document.getElementById("coverPlaceholder");
  const coverPreview = document.getElementById("coverPreview");
  const coverImage = document.getElementById("coverImage");

  coverUploadArea.addEventListener("click", () => {
    coverInput.click();
  });

  coverInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        coverImage.src = e.target.result;
        coverPlaceholder.style.display = "none";
        coverPreview.style.display = "block";
      };
      reader.readAsDataURL(file);
      shopCoverUrl = file;
    }
  });

  document.querySelector(".remove-cover")?.addEventListener("click", (e) => {
    e.stopPropagation();
    coverInput.value = "";
    coverPlaceholder.style.display = "flex";
    coverPreview.style.display = "none";
    shopCoverUrl = null;
  });

  const deliveryAvailable = document.getElementById("deliveryAvailable");
  const deliveryFeeGroup = document.getElementById("deliveryFeeGroup");

  deliveryAvailable.addEventListener("change", () => {
    if (deliveryAvailable.checked) {
      deliveryFeeGroup.style.display = "block";
    } else {
      deliveryFeeGroup.style.display = "none";
      document.getElementById("deliveryFee").value = "";
    }
  });

  document.querySelectorAll(".suggested-category").forEach((btn) => {
    btn.addEventListener("click", () => {
      const category = btn.dataset.category;
      if (!selectedCategories.includes(category)) {
        selectedCategories.push(category);
        btn.classList.add("selected");
        renderCategories();
      }
    });
  });

  document.getElementById("addCategoryBtn").addEventListener("click", () => {
    const input = document.getElementById("newCategory");
    const category = input.value.trim();
    if (category && !selectedCategories.includes(category)) {
      selectedCategories.push(category);
      renderCategories();
      input.value = "";
    }
  });

  document.getElementById("newCategory").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("addCategoryBtn").click();
    }
  });

  document.getElementById("step1Next").addEventListener("click", validateStep1);
  document
    .getElementById("step2Prev")
    .addEventListener("click", () => goToStep(1));
  document.getElementById("step2Next").addEventListener("click", validateStep2);
  document
    .getElementById("step3Prev")
    .addEventListener("click", () => goToStep(2));

  document
    .getElementById("shopSetupForm")
    .addEventListener("submit", submitShop);

  document
    .getElementById("deliveryAvailable")
    .addEventListener("change", updatePreview);
  document
    .getElementById("pickupAvailable")
    .addEventListener("change", updatePreview);
  document.getElementById("shopName").addEventListener("input", updatePreview);
  document
    .getElementById("shopDescription")
    .addEventListener("input", updatePreview);
  document.getElementById("shopPhone").addEventListener("input", updatePreview);
  document.getElementById("shopEmail").addEventListener("input", updatePreview);
  document
    .getElementById("shopAddress")
    .addEventListener("input", updatePreview);
  document.getElementById("shopCity").addEventListener("input", updatePreview);
  document.getElementById("shopArea").addEventListener("input", updatePreview);
}

function initializeForm() {
  document.querySelectorAll(".step").forEach((step, index) => {
    if (index === 0) step.classList.add("active");
    else step.classList.remove("active");
  });

  document.querySelectorAll(".step-connector").forEach((connector, index) => {
    connector.classList.remove("active");
  });
}

function goToStep(stepNumber) {
  document.querySelectorAll(".form-step").forEach((step) => {
    step.classList.remove("active");
  });
  document.getElementById(`step${stepNumber}`).classList.add("active");

  document.querySelectorAll(".step").forEach((step, index) => {
    if (index + 1 < stepNumber) {
      step.classList.add("completed");
      step.classList.remove("active");
    } else if (index + 1 === stepNumber) {
      step.classList.add("active");
      step.classList.remove("completed");
    } else {
      step.classList.remove("active", "completed");
    }
  });

  if (stepNumber === 3) {
    updatePreview();
  }
}

function validateStep1() {
  const shopName = document.getElementById("shopName").value.trim();
  const shopDescription = document
    .getElementById("shopDescription")
    .value.trim();
  const shopPhone = document.getElementById("shopPhone").value.trim();
  const shopEmail = document.getElementById("shopEmail").value.trim();
  const shopAddress = document.getElementById("shopAddress").value.trim();
  const shopCity = document.getElementById("shopCity").value.trim();
  const shopArea = document.getElementById("shopArea").value.trim();

  if (!shopName) {
    notyf.error("Shop name is required");
    return;
  }

  if (!shopDescription) {
    notyf.error("Shop description is required");
    return;
  }

  if (!shopPhone) {
    notyf.error("Contact number is required");
    return;
  }

  if (!shopEmail) {
    notyf.error("Contact email is required");
    return;
  }

  if (!shopAddress) {
    notyf.error("Shop address is required");
    return;
  }

  if (!shopCity) {
    notyf.error("City is required");
    return;
  }

  if (!shopArea) {
    notyf.error("Area is required");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(shopEmail)) {
    notyf.error("Please enter a valid email address");
    return;
  }

  goToStep(2);
}

function validateStep2() {
  if (selectedCategories.length === 0) {
    notyf.error("Please add at least one category");
    return;
  }

  goToStep(3);
}

function renderCategories() {
  const container = document.getElementById("categoriesList");
  container.innerHTML = "";

  selectedCategories.forEach((category) => {
    const tag = document.createElement("span");
    tag.className = "category-tag";
    tag.innerHTML = `
            ${category}
            <i class="fas fa-times" onclick="window.removeCategory('${category}')"></i>
        `;
    container.appendChild(tag);
  });

  document.querySelectorAll(".suggested-category").forEach((btn) => {
    if (selectedCategories.includes(btn.dataset.category)) {
      btn.classList.add("selected");
    } else {
      btn.classList.remove("selected");
    }
  });

  updatePreview();
}

window.removeCategory = (category) => {
  selectedCategories = selectedCategories.filter((c) => c !== category);
  renderCategories();
};

function updatePreview() {
  const shopName =
    document.getElementById("shopName").value.trim() || "Your Shop Name";
  const shopDescription =
    document.getElementById("shopDescription").value.trim() ||
    "Your shop description will appear here";
  const shopPhone =
    document.getElementById("shopPhone").value.trim() || "+92 300 1234567";
  const shopEmail =
    document.getElementById("shopEmail").value.trim() || "shop@example.com";
  const shopAddress =
    document.getElementById("shopAddress").value.trim() || "Your address";
  const shopCity = document.getElementById("shopCity").value.trim() || "City";
  const shopArea = document.getElementById("shopArea").value.trim() || "Area";

  document.getElementById("previewShopName").textContent = shopName;
  document.getElementById("previewShopDescription").textContent =
    shopDescription;
  document.getElementById("previewPhone").textContent = shopPhone;
  document.getElementById("previewEmail").textContent = shopEmail;
  document.getElementById("previewAddress").textContent =
    `${shopAddress}, ${shopArea}, ${shopCity}`;

  const previewCategories = document.getElementById("previewCategories");
  previewCategories.innerHTML = "";
  selectedCategories.slice(0, 5).forEach((category) => {
    const tag = document.createElement("span");
    tag.className = "category-tag";
    tag.style.margin = "0 4px 4px 0";
    tag.textContent = category;
    previewCategories.appendChild(tag);
  });

  if (selectedCategories.length > 5) {
    const more = document.createElement("span");
    more.className = "category-tag";
    more.textContent = `+${selectedCategories.length - 5} more`;
    previewCategories.appendChild(more);
  }

  if (shopLogoUrl && typeof shopLogoUrl === "string") {
    const previewLogo = document.getElementById("previewLogo");
    previewLogo.innerHTML = `<img src="${shopLogoUrl}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;">`;
  }
}

async function uploadImages() {
  const logoFile = document.getElementById("shopLogo").files[0];
  const coverFile = document.getElementById("shopCover").files[0];

  const uploads = [];

  if (logoFile) {
    uploads.push(
      imageUploadHandler(logoFile).then((url) => ({ type: "logo", url })),
    );
  }

  if (coverFile) {
    uploads.push(
      imageUploadHandler(coverFile).then((url) => ({ type: "cover", url })),
    );
  }

  const results = await Promise.all(uploads);

  const imageUrls = {
    logo: null,
    cover: null,
  };

  results.forEach((result) => {
    if (result.type === "logo") imageUrls.logo = result.url;
    if (result.type === "cover") imageUrls.cover = result.url;
  });

  return imageUrls;
}

async function submitShop(e) {
  e.preventDefault();

  if (!document.getElementById("termsAgreement").checked) {
    notyf.error("Please agree to the Terms of Service");
    return;
  }

  try {
    const loading = showLoading(notyf, "Creating your shop...");

    const imageUrls = await uploadImages();

    const shopData = {
      vendorId: currentUser.uid,
      vendorEmail: currentUser.email,
      shopName: document.getElementById("shopName").value.trim(),
      shopDescription: document.getElementById("shopDescription").value.trim(),
      shopLogo: imageUrls.logo || null,
      shopCover: imageUrls.cover || null,
      contactPhone: document.getElementById("shopPhone").value.trim(),
      contactEmail: document.getElementById("shopEmail").value.trim(),
      address: {
        full: document.getElementById("shopAddress").value.trim(),
        city: document.getElementById("shopCity").value.trim(),
        area: document.getElementById("shopArea").value.trim(),
      },
      deliveryAvailable: document.getElementById("deliveryAvailable").checked,
      pickupAvailable: document.getElementById("pickupAvailable").checked,
      deliveryFee: document.getElementById("deliveryAvailable").checked
        ? parseFloat(document.getElementById("deliveryFee").value) || 0
        : 0,
      minOrderAmount:
        parseFloat(document.getElementById("minOrderAmount").value) || 0,
      estimatedDeliveryTime:
        document.getElementById("estimatedDeliveryTime").value.trim() ||
        "30-45 min",
      operatingHours: {
        monday_friday: {
          open: document.getElementById("monFriOpen").value,
          close: document.getElementById("monFriClose").value,
        },
        saturday: {
          open: document.getElementById("satOpen").value,
          close: document.getElementById("satClose").value,
        },
        sunday: {
          open: document.getElementById("sunOpen").value,
          close: document.getElementById("sunClose").value,
        },
      },
      categoryList: selectedCategories,
      isActive: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      totalOrders: 0,
      totalRevenue: 0,
      averageRating: 0,
      reviewCount: 0,
    };

    const shopsQuery = query(
      collection(db, "shops"),
      where("vendorId", "==", currentUser.uid),
      limit(1),
    );

    const shopsSnapshot = await getDocs(shopsQuery);

    if (shopsSnapshot.empty) {
      await addDoc(collection(db, "shops"), shopData);
    } else {
      const shopDoc = shopsSnapshot.docs[0];
      await updateDoc(doc(db, "shops", shopDoc.id), shopData);
    }

    notyf.dismiss(loading);

    document.getElementById("successModal").classList.add("show");

    setTimeout(() => {
      window.location.href = "/vendor";
    }, 3000);
  } catch (error) {
    console.error("Error creating shop:", error);
    notyf.error("Failed to create shop: " + error.message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("successModal");

  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("show");
    }
  });
});
