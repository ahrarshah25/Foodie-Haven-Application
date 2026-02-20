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
let shopId = null;
let currentShop = null;
let selectedCategories = [];
let shopLogoFile = null;
let shopCoverFile = null;
let shopLogoUrl = null;
let shopCoverUrl = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  currentUser = user;
  document.getElementById("vendorEmail").value = user.email || "";

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
      currentShop = shopDoc.data();
      shopId = shopDoc.id;
      loadShopData();
    }

    setupEventListeners();
    initializeForm();
  } catch (error) {
    console.error("Error initializing shop settings:", error);
    notyf.error("Failed to initialize shop settings");
  }
});

function loadShopData() {
  if (!currentShop) return;

  document.getElementById("shopName").value = currentShop.shopName || "";
  document.getElementById("shopDescription").value =
    currentShop.shopDescription || "";
  document.getElementById("contactPhone").value =
    currentShop.contactPhone || "";
  document.getElementById("contactEmail").value =
    currentShop.contactEmail || "";

  if (currentShop.address) {
    document.getElementById("addressFull").value =
      currentShop.address.full || "";
    document.getElementById("addressCity").value =
      currentShop.address.city || "";
    document.getElementById("addressArea").value =
      currentShop.address.area || "";
  }

  if (currentShop.categoryList) {
    selectedCategories = [...currentShop.categoryList];
    renderCategories();
  }

  if (currentShop.operatingHours) {
    if (currentShop.operatingHours.monday_friday) {
      document.getElementById("monFriOpen").value =
        currentShop.operatingHours.monday_friday.open || "09:00";
      document.getElementById("monFriClose").value =
        currentShop.operatingHours.monday_friday.close || "23:00";
    }
    if (currentShop.operatingHours.saturday) {
      document.getElementById("satOpen").value =
        currentShop.operatingHours.saturday.open || "10:00";
      document.getElementById("satClose").value =
        currentShop.operatingHours.saturday.close || "22:00";
    }
    if (currentShop.operatingHours.sunday) {
      document.getElementById("sunOpen").value =
        currentShop.operatingHours.sunday.open || "11:00";
      document.getElementById("sunClose").value =
        currentShop.operatingHours.sunday.close || "21:00";
    }
  }

  document.getElementById("deliveryAvailable").checked =
    currentShop.deliveryAvailable !== false;
  document.getElementById("pickupAvailable").checked =
    currentShop.pickupAvailable || false;
  document.getElementById("deliveryFee").value = currentShop.deliveryFee || 200;
  document.getElementById("minOrderAmount").value =
    currentShop.minOrderAmount || 500;
  document.getElementById("estimatedDeliveryTime").value =
    currentShop.estimatedDeliveryTime || "30-45 min";

  if (currentShop.shopLogo) {
    shopLogoUrl = currentShop.shopLogo;
    const logoPlaceholder = document.getElementById("logoPlaceholder");
    const logoPreview = document.getElementById("logoPreview");
    const logoImage = document.getElementById("logoImage");
    logoPlaceholder.style.display = "none";
    logoPreview.style.display = "block";
    logoImage.src = currentShop.shopLogo;
  }

  if (currentShop.shopCover) {
    shopCoverUrl = currentShop.shopCover;
    const coverPlaceholder = document.getElementById("coverPlaceholder");
    const coverPreview = document.getElementById("coverPreview");
    const coverImage = document.getElementById("coverImage");
    coverPlaceholder.style.display = "none";
    coverPreview.style.display = "block";
    coverImage.src = currentShop.shopCover;
  }

  if (currentShop.shopLogo || currentShop.shopCover || currentShop.shopName) {
    updatePreview();
  }

  document.getElementById("previewRating").textContent =
    `${currentShop.averageRating || 4.8} (${currentShop.reviewCount || 128} reviews)`;

  if (currentShop.isActive) {
    document.getElementById("shopStatusBadge").innerHTML = `
            <i class="fas fa-check-circle"></i> Verified Shop
        `;
  }
}

function setupEventListeners() {
  const description = document.getElementById("shopDescription");
  description.addEventListener("input", () => {
    const count = description.value.length;
    document.getElementById("descCharCount").textContent = count;
    updatePreview();
  });

  const logoUploadArea = document.getElementById("logoUploadArea");
  const logoInput = document.getElementById("shopLogo");
  const logoPlaceholder = document.getElementById("logoPlaceholder");
  const logoPreview = document.getElementById("logoPreview");
  const logoImage = document.getElementById("logoImage");
  const removeLogo = document.getElementById("removeLogo");

  logoUploadArea.addEventListener("click", (e) => {
    if (e.target !== removeLogo && !removeLogo.contains(e.target)) {
      logoInput.click();
    }
  });

  logoInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        logoImage.src = e.target.result;
        logoPlaceholder.style.display = "none";
        logoPreview.style.display = "block";
        shopLogoFile = file;
        shopLogoUrl = null;
        updatePreview();
      };
      reader.readAsDataURL(file);
    }
  });

  removeLogo?.addEventListener("click", (e) => {
    e.stopPropagation();
    logoInput.value = "";
    logoPlaceholder.style.display = "flex";
    logoPreview.style.display = "none";
    shopLogoFile = null;
    shopLogoUrl = null;
    updatePreview();
  });

  const coverUploadArea = document.getElementById("coverUploadArea");
  const coverInput = document.getElementById("shopCover");
  const coverPlaceholder = document.getElementById("coverPlaceholder");
  const coverPreview = document.getElementById("coverPreview");
  const coverImage = document.getElementById("coverImage");
  const removeCover = document.getElementById("removeCover");

  coverUploadArea.addEventListener("click", (e) => {
    if (e.target !== removeCover && !removeCover.contains(e.target)) {
      coverInput.click();
    }
  });

  coverInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        coverImage.src = e.target.result;
        coverPlaceholder.style.display = "none";
        coverPreview.style.display = "block";
        shopCoverFile = file;
        shopCoverUrl = null;
        updatePreview();
      };
      reader.readAsDataURL(file);
    }
  });

  removeCover?.addEventListener("click", (e) => {
    e.stopPropagation();
    coverInput.value = "";
    coverPlaceholder.style.display = "flex";
    coverPreview.style.display = "none";
    shopCoverFile = null;
    shopCoverUrl = null;
    updatePreview();
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
        updatePreview();
      }
    });
  });

  document.getElementById("addCategoryBtn").addEventListener("click", () => {
    const input = document.getElementById("newCategory");
    const category = input.value.trim();
    if (category && !selectedCategories.includes(category)) {
      selectedCategories.push(category);
      renderCategories();
      updatePreview();
      input.value = "";
    }
  });

  document.getElementById("newCategory").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("addCategoryBtn").click();
    }
  });

  const navItems = document.querySelectorAll(".nav-item");
  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const tabId = item.dataset.tab;

      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");

      document.querySelectorAll(".settings-tab").forEach((tab) => {
        tab.classList.remove("active");
      });

      document.getElementById(`${tabId}-tab`).classList.add("active");
    });
  });

  document.getElementById("shopName").addEventListener("input", updatePreview);
  document
    .getElementById("shopDescription")
    .addEventListener("input", updatePreview);
  document
    .getElementById("contactPhone")
    .addEventListener("input", updatePreview);
  document
    .getElementById("contactEmail")
    .addEventListener("input", updatePreview);
  document
    .getElementById("addressFull")
    .addEventListener("input", updatePreview);
  document
    .getElementById("addressCity")
    .addEventListener("input", updatePreview);
  document
    .getElementById("addressArea")
    .addEventListener("input", updatePreview);

  document
    .getElementById("shopSettingsForm")
    .addEventListener("submit", submitShop);
}

function initializeForm() {
  const activeTab = document.querySelector(".nav-item.active");
  if (activeTab) {
    const tabId = activeTab.dataset.tab;
    document.querySelectorAll(".settings-tab").forEach((tab) => {
      tab.classList.remove("active");
    });
    document.getElementById(`${tabId}-tab`).classList.add("active");
  }
}

window.removeCategory = (category) => {
  selectedCategories = selectedCategories.filter((c) => c !== category);
  renderCategories();
  updatePreview();

  document.querySelectorAll(".suggested-category").forEach((btn) => {
    if (btn.dataset.category === category) {
      btn.classList.remove("selected");
    }
  });
};

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
}

function updatePreview() {
  const shopName =
    document.getElementById("shopName").value.trim() || "Your Shop Name";
  const shopDescription =
    document.getElementById("shopDescription").value.trim() ||
    "Your shop description will appear here";
  const contactPhone =
    document.getElementById("contactPhone").value.trim() || "+92 300 1234567";
  const contactEmail =
    document.getElementById("contactEmail").value.trim() || "shop@example.com";
  const addressFull =
    document.getElementById("addressFull").value.trim() || "Your address";
  const addressCity =
    document.getElementById("addressCity").value.trim() || "City";
  const addressArea =
    document.getElementById("addressArea").value.trim() || "Area";

  document.getElementById("previewShopName").textContent = shopName;

  const categoryText =
    selectedCategories.length > 0
      ? selectedCategories.slice(0, 3).join(" • ") +
        (selectedCategories.length > 3 ? " • more" : "")
      : "Food Category";
  document.getElementById("previewCategory").textContent = categoryText;
}

async function uploadImages() {
  const uploads = [];

  if (shopLogoFile) {
    const logoLoading = showLoading(notyf, "Uploading logo...");
    try {
      const result = await imageUploadHandler(shopLogoFile);
      notyf.dismiss(logoLoading);
      if (result.success) {
        shopLogoUrl = result.url;
      } else {
        notyf.error("Logo upload failed");
      }
    } catch (error) {
      notyf.dismiss(logoLoading);
      notyf.error("Logo upload error");
    }
  }

  if (shopCoverFile) {
    const coverLoading = showLoading(notyf, "Uploading cover...");
    try {
      const result = await imageUploadHandler(shopCoverFile);
      notyf.dismiss(coverLoading);
      if (result.success) {
        shopCoverUrl = result.url;
      } else {
        notyf.error("Cover upload failed");
      }
    } catch (error) {
      notyf.dismiss(coverLoading);
      notyf.error("Cover upload error");
    }
  }
}

async function submitShop(e) {
  e.preventDefault();

  const shopName = document.getElementById("shopName").value.trim();
  const shopDescription = document
    .getElementById("shopDescription")
    .value.trim();
  const contactPhone = document.getElementById("contactPhone").value.trim();
  const contactEmail = document.getElementById("contactEmail").value.trim();
  const addressFull = document.getElementById("addressFull").value.trim();
  const addressCity = document.getElementById("addressCity").value.trim();
  const addressArea = document.getElementById("addressArea").value.trim();

  if (!shopName) {
    notyf.error("Shop name is required");
    document.querySelector('[data-tab="general"]').click();
    return;
  }

  if (!shopDescription) {
    notyf.error("Shop description is required");
    document.querySelector('[data-tab="general"]').click();
    return;
  }

  if (!contactPhone) {
    notyf.error("Contact phone is required");
    document.querySelector('[data-tab="general"]').click();
    return;
  }

  if (!contactEmail) {
    notyf.error("Contact email is required");
    document.querySelector('[data-tab="general"]').click();
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(contactEmail)) {
    notyf.error("Please enter a valid email address");
    document.querySelector('[data-tab="general"]').click();
    return;
  }

  if (!addressFull || !addressCity || !addressArea) {
    notyf.error("Please fill in all address fields");
    document.querySelector('[data-tab="address"]').click();
    return;
  }

  if (selectedCategories.length === 0) {
    notyf.error("Please add at least one category");
    document.querySelector('[data-tab="categories"]').click();
    return;
  }

  if (!document.getElementById("termsAgreement").checked) {
    notyf.error("Please agree to the Terms of Service");
    document.querySelector('[data-tab="delivery"]').click();
    return;
  }

  const loading = showLoading(notyf, "Saving shop settings...");

  try {
    await uploadImages();

    const shopData = {
      vendorId: currentUser.uid,
      vendorEmail: currentUser.email,
      shopName: shopName,
      shopDescription: shopDescription,
      shopLogo: shopLogoUrl || currentShop?.shopLogo || null,
      shopCover: shopCoverUrl || currentShop?.shopCover || null,
      contactPhone: contactPhone,
      contactEmail: contactEmail,
      address: {
        full: addressFull,
        city: addressCity,
        area: addressArea,
      },
      categoryList: selectedCategories,
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
      isActive: currentShop?.isActive ?? true,
      updatedAt: serverTimestamp(),
    };

    if (!currentShop) {
      shopData.createdAt = serverTimestamp();
      shopData.totalOrders = 0;
      shopData.totalRevenue = 0;
      shopData.averageRating = 0;
      shopData.reviewCount = 0;
    }

    if (shopId) {
      await updateDoc(doc(db, "shops", shopId), shopData);
    } else {
      await addDoc(collection(db, "shops"), shopData);
    }

    notyf.dismiss(loading);

    document.getElementById("successModal").classList.add("show");

    setTimeout(() => {
      window.location.href = "/vendor";
    }, 3000);
  } catch (error) {
    console.error("Error saving shop:", error);
    notyf.dismiss(loading);
    notyf.error("Failed to save shop: " + error.message);
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
