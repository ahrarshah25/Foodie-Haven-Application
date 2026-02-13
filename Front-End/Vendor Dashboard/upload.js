import {
  db,
  auth,
  storage,
  onAuthStateChanged,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  deleteDoc,
  limit,
} from "../Firebase/config.js";
import notyf from "../Notyf/notyf.js";
import showLoading from "../Notyf/loader.js";
import imageUploadHandler from "../Cloudinary/imageUploadHandler.js";
import videoUploadHandler from "../Cloudinary/videoUploadHandler.js";

let currentUser = null;
let currentShop = null;
let shopId = null;
let productId = null;
let uploadedImages = [];
let uploadedVideos = [];
let selectedTags = [];
let existingImages = [];
let existingVideos = [];

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  currentUser = user;

  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (
      !userDoc.exists() ||
      userDoc.data().userRole !== "vendor" ||
      !userDoc.data().isVerified
    ) {
      notyf.error("Access denied. Only verified vendors can upload products.");
      setTimeout(() => {
        window.location.href = "/vendor";
      }, 2000);
      return;
    }

    const shopsQuery = query(
      collection(db, "shops"),
      where("vendorId", "==", user.uid),
      limit(1),
    );

    const shopsSnapshot = await getDocs(shopsQuery);

    if (shopsSnapshot.empty) {
      notyf.error("Please set up your shop first.");
      window.location.href = "/vendor/shop-setup";
      return;
    }

    const shopDoc = shopsSnapshot.docs[0];
    currentShop = shopDoc.data();
    shopId = shopDoc.id;

    const urlParams = new URLSearchParams(window.location.search);
    productId = urlParams.get("id");

    if (productId) {
      document.querySelector("h1").textContent = "Edit Product";
      document.querySelector(".btn-submit span").textContent = "Update Product";
      await loadProductData();
    }

    await loadCategories();
    setupEventListeners();
    setupImageUpload();
    setupVideoUpload();
    setupVariations();
  } catch (error) {
    console.error("Error initializing upload page:", error);
    notyf.error("Failed to initialize upload page");
  }
});

async function loadCategories() {
  try {
    const shopDoc = await getDoc(doc(db, "shops", shopId));
    const categories = shopDoc.data().categoryList || [];

    const categorySelect = document.getElementById("category");
    if (!categorySelect) return;

    categorySelect.innerHTML =
      '<option value="" disabled selected>Select a category</option>';

    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      categorySelect.appendChild(option);
    });

    const addNewOption = document.createElement("option");
    addNewOption.value = "__new__";
    addNewOption.textContent = "+ Add New Category";
    categorySelect.appendChild(addNewOption);

    categorySelect.addEventListener("change", (e) => {
      if (e.target.value === "__new__") {
        const newCategory = prompt("Enter new category name:");
        if (newCategory && newCategory.trim()) {
          addNewCategory(newCategory.trim());
        }
        e.target.value = "";
      }
    });
  } catch (error) {
    console.error("Error loading categories:", error);
  }
}

async function addNewCategory(categoryName) {
  try {
    const loading = showLoading(notyf, "Adding category...");

    const shopRef = doc(db, "shops", shopId);
    const shopDoc = await getDoc(shopRef);

    const currentCategories = shopDoc.data().categoryList || [];

    if (currentCategories.includes(categoryName)) {
      notyf.error("Category already exists");
      notyf.dismiss(loading);
      return;
    }

    await updateDoc(shopRef, {
      categoryList: [...currentCategories, categoryName],
    });

    notyf.dismiss(loading);
    notyf.success("Category added successfully");

    const categorySelect = document.getElementById("category");
    const option = document.createElement("option");
    option.value = categoryName;
    option.textContent = categoryName;
    categorySelect.appendChild(option);
    categorySelect.value = categoryName;
  } catch (error) {
    notyf.error("Failed to add category: " + error.message);
  }
}

async function loadProductData() {
  if (!productId || !shopId) return;

  try {
    const loading = showLoading(notyf, "Loading product data...");

    const productDoc = await getDoc(doc(db, "items", productId));

    if (!productDoc.exists()) {
      notyf.error("Product not found");
      return;
    }

    const product = productDoc.data();

    if (product.shopId !== shopId) {
      notyf.error("You do not have permission to edit this product");
      return;
    }

    document.getElementById("productName").value = product.name || "";
    document.getElementById("description").value = product.description || "";
    document.getElementById("price").value = product.price || "";
    document.getElementById("discountPrice").value =
      product.discountPrice || "";
    document.getElementById("category").value = product.category || "";
    document.getElementById("stock").value = product.stock || "";
    document.getElementById("preparationTime").value =
      product.preparationTime || "";

    if (product.tags) {
      selectedTags = [...product.tags];
      renderTags();
    }

    if (product.dietary) {
      document.getElementById("vegetarian").checked =
        product.dietary.vegetarian || false;
      document.getElementById("vegan").checked = product.dietary.vegan || false;
      document.getElementById("glutenFree").checked =
        product.dietary.glutenFree || false;
      document.getElementById("spicy").checked = product.dietary.spicy || false;
    }

    if (product.nutrition) {
      document.getElementById("calories").value =
        product.nutrition.calories || "";
      document.getElementById("protein").value =
        product.nutrition.protein || "";
      document.getElementById("carbs").value = product.nutrition.carbs || "";
      document.getElementById("fat").value = product.nutrition.fat || "";
    }

    if (product.variations) {
      renderVariations(product.variations);
    }

    if (product.images && product.images.length > 0) {
      existingImages = product.images;
      renderExistingImages();
    }

    if (product.videos && product.videos.length > 0) {
      existingVideos = product.videos;
      renderExistingVideos();
    }

    document.getElementById("isAvailable").checked =
      product.isAvailable !== false;

    notyf.dismiss(loading);
  } catch (error) {
    console.error("Error loading product:", error);
    notyf.error("Failed to load product data");
  }
}

function renderExistingImages() {
  const previewGrid = document.getElementById("imagePreviewGrid");
  if (!previewGrid) return;

  existingImages.forEach((image, index) => {
    const previewItem = document.createElement("div");
    previewItem.className = "preview-item";
    previewItem.setAttribute("data-existing", "true");
    previewItem.setAttribute("data-index", index);
    previewItem.innerHTML = `
            <img src="${image}" alt="Product image ${index + 1}">
            <button type="button" class="remove-image" data-index="${index}" data-existing="true">
                <i class="fas fa-times"></i>
            </button>
            <span class="image-order">${index + 1}</span>
        `;
    previewGrid.appendChild(previewItem);
  });

  attachRemoveImageListeners();
}

function renderExistingVideos() {
  const previewGrid = document.getElementById("imagePreviewGrid");
  if (!previewGrid) return;

  existingVideos.forEach((video, index) => {
    const previewItem = document.createElement("div");
    previewItem.className = "preview-item";
    previewItem.setAttribute("data-existing-video", "true");
    previewItem.setAttribute("data-index", index);
    previewItem.innerHTML = `
            <video src="${video}" controls></video>
            <button type="button" class="remove-video" data-index="${index}" data-existing="true">
                <i class="fas fa-times"></i>
            </button>
            <span class="image-order">${existingImages.length + index + 1}</span>
            <span class="video-badge"><i class="fas fa-video"></i></span>
        `;
    previewGrid.appendChild(previewItem);
  });

  attachRemoveVideoListeners();
}

function setupImageUpload() {
  const uploadArea = document.getElementById("imageUploadArea");
  const fileInput = document.getElementById("imageInput");
  const browseBtn = document.getElementById("browseBtn");

  if (!uploadArea || !fileInput) return;

  uploadArea.addEventListener("click", (e) => {
    if (e.target !== browseBtn && !browseBtn.contains(e.target)) {
      fileInput.click();
    }
  });

  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("dragover");
  });

  uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("dragover");
  });

  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleImageFiles(files);
    }
  });

  if (browseBtn) {
    browseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      fileInput.click();
    });
  }

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleImageFiles(e.target.files);
    }
  });
}

function setupVideoUpload() {
  const videoFile = document.getElementById("videoFile");
  const videoArea = document.querySelector(".video-upload-area");

  if (!videoFile || !videoArea) return;

  videoArea.addEventListener("click", () => {
    videoFile.click();
  });

  videoFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      handleVideoFile(file);
    }
  });
}

async function handleImageFiles(files) {
  const validFiles = Array.from(files).filter((file) =>
    file.type.startsWith("image/"),
  );

  if (validFiles.length === 0) {
    notyf.error("Please select valid image files");
    return;
  }

  const loading = showLoading(
    notyf,
    `Uploading ${validFiles.length} image(s)...`,
  );
  let successCount = 0;

  for (const file of validFiles) {
    try {
      const result = await imageUploadHandler(file);

      if (result.success) {
        uploadedImages.push({
          url: result.url,
          type: "image",
          publicId: result.publicId,
        });
        successCount++;
      } else {
        notyf.error(`Failed to upload ${file.name}: ${result.error}`);
      }
    } catch (error) {
      notyf.error(`Error uploading ${file.name}`);
    }
  }

  notyf.dismiss(loading);

  if (successCount > 0) {
    notyf.success(`${successCount} image(s) uploaded successfully`);
    renderUploadedImages();
  }

  document.getElementById("imageInput").value = "";
}

async function handleVideoFile(file) {
  if (!file.type.startsWith("video/")) {
    notyf.error("Please select a valid video file");
    return;
  }

  const loading = showLoading(notyf, "Uploading video...");

  try {
    const result = await videoUploadHandler(file);

    if (result.success) {
      uploadedVideos.push({
        url: result.url,
        type: "video",
        publicId: result.publicId,
        duration: result.duration,
      });

      notyf.dismiss(loading);
      notyf.success("Video uploaded successfully");

      renderUploadedVideos();
    } else {
      notyf.dismiss(loading);
      notyf.error(result.error || "Video upload failed");
    }
  } catch (error) {
    notyf.dismiss(loading);
    notyf.error("Video upload failed: " + error.message);
  }

  document.getElementById("videoFile").value = "";
}

function renderUploadedImages() {
  const previewGrid = document.getElementById("imagePreviewGrid");
  if (!previewGrid) return;

  const existingItems = previewGrid.querySelectorAll('[data-existing="true"]');
  const existingVideoItems = previewGrid.querySelectorAll(
    '[data-existing-video="true"]',
  );

  const uploadedItems = previewGrid.querySelectorAll(
    '[data-uploaded="true"], [data-uploaded-video="true"]',
  );
  uploadedItems.forEach((item) => item.remove());

  const allImages = [
    ...existingImages,
    ...uploadedImages.map((img) => img.url),
  ];

  uploadedImages.forEach((image, index) => {
    const previewItem = document.createElement("div");
    previewItem.className = "preview-item";
    previewItem.setAttribute("data-uploaded", "true");
    previewItem.setAttribute("data-index", index);
    previewItem.innerHTML = `
            <img src="${image.url}" alt="Uploaded image">
            <button type="button" class="remove-image" data-index="${index}" data-uploaded="true">
                <i class="fas fa-times"></i>
            </button>
            <span class="image-order">${allImages.length - uploadedImages.length + index + 1}</span>
        `;
    previewGrid.appendChild(previewItem);
  });

  attachRemoveImageListeners();
  reorderAllItems();
}

function renderUploadedVideos() {
  const previewGrid = document.getElementById("imagePreviewGrid");
  if (!previewGrid) return;

  uploadedVideos.forEach((video, index) => {
    const previewItem = document.createElement("div");
    previewItem.className = "preview-item";
    previewItem.setAttribute("data-uploaded-video", "true");
    previewItem.setAttribute("data-index", index);
    previewItem.innerHTML = `
            <video src="${video.url}" controls></video>
            <button type="button" class="remove-video" data-index="${index}" data-uploaded="true">
                <i class="fas fa-times"></i>
            </button>
            <span class="image-order">${previewGrid.children.length + 1}</span>
            <span class="video-badge"><i class="fas fa-video"></i></span>
        `;
    previewGrid.appendChild(previewItem);
  });

  attachRemoveVideoListeners();
  reorderAllItems();
}

function attachRemoveImageListeners() {
  document.querySelectorAll(".remove-image").forEach((btn) => {
    btn.removeEventListener("click", handleImageRemove);
    btn.addEventListener("click", handleImageRemove);
  });
}

function handleImageRemove(e) {
  e.preventDefault();
  e.stopPropagation();

  const btn = e.currentTarget;
  const index = parseInt(btn.dataset.index);
  const isExisting = btn.dataset.existing === "true";
  const isUploaded = btn.dataset.uploaded === "true";

  if (isExisting) {
    existingImages.splice(index, 1);
  } else if (isUploaded) {
    uploadedImages.splice(index, 1);
  }

  btn.closest(".preview-item").remove();
  reorderAllItems();
}

function attachRemoveVideoListeners() {
  document.querySelectorAll(".remove-video").forEach((btn) => {
    btn.removeEventListener("click", handleVideoRemove);
    btn.addEventListener("click", handleVideoRemove);
  });
}

function handleVideoRemove(e) {
  e.preventDefault();
  e.stopPropagation();

  const btn = e.currentTarget;
  const index = parseInt(btn.dataset.index);
  const isExisting = btn.dataset.existing === "true";
  const isUploaded = btn.dataset.uploaded === "true";

  if (isExisting) {
    existingVideos.splice(index, 1);
  } else if (isUploaded) {
    uploadedVideos.splice(index, 1);
  }

  btn.closest(".preview-item").remove();
  reorderAllItems();
}

function reorderAllItems() {
  const previewItems = document.querySelectorAll(".preview-item");
  previewItems.forEach((item, index) => {
    const orderSpan = item.querySelector(".image-order");
    if (orderSpan) {
      orderSpan.textContent = index + 1;
    }
  });
}

function setupVariations() {
  const addVariationBtn = document.getElementById("addVariationBtn");
  const container = document.getElementById("variationsContainer");

  if (!addVariationBtn || !container) return;

  addVariationBtn.addEventListener("click", () => {
    const variationRow = document.createElement("div");
    variationRow.className = "variation-row";
    variationRow.innerHTML = `
            <input type="text" placeholder="e.g., Extra Cheese" class="variation-name">
            <input type="number" placeholder="Price" class="variation-price" step="0.01">
            <button type="button" class="remove-variation">
                <i class="fas fa-times"></i>
            </button>
        `;
    container.appendChild(variationRow);

    variationRow
      .querySelector(".remove-variation")
      .addEventListener("click", () => {
        variationRow.remove();
      });
  });

  document.querySelectorAll(".remove-variation").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.target.closest(".variation-row").remove();
    });
  });
}

function renderVariations(variations) {
  const container = document.getElementById("variationsContainer");
  if (!container || !variations) return;

  container.innerHTML = "";

  variations.forEach((variation) => {
    const variationRow = document.createElement("div");
    variationRow.className = "variation-row";
    variationRow.innerHTML = `
            <input type="text" value="${variation.name}" class="variation-name">
            <input type="number" value="${variation.price}" class="variation-price" step="0.01">
            <button type="button" class="remove-variation">
                <i class="fas fa-times"></i>
            </button>
        `;
    container.appendChild(variationRow);

    variationRow
      .querySelector(".remove-variation")
      .addEventListener("click", () => {
        variationRow.remove();
      });
  });
}

function setupEventListeners() {
  const form = document.getElementById("productForm");
  const tagInput = document.getElementById("tagInput");
  const cancelBtn = document.querySelector(".btn-cancel");

  if (form) {
    form.addEventListener("submit", handleSubmit);
  }

  if (tagInput) {
    tagInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const tag = tagInput.value.trim();
        if (tag && !selectedTags.includes(tag)) {
          selectedTags.push(tag);
          renderTags();
          tagInput.value = "";
        }
      }
    });

    tagInput.addEventListener("blur", () => {
      const tag = tagInput.value.trim();
      if (tag && !selectedTags.includes(tag)) {
        selectedTags.push(tag);
        renderTags();
        tagInput.value = "";
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "/vendor";
    });
  }

  const description = document.getElementById("description");
  const descCharCount = document.getElementById("descCharCount");

  if (description && descCharCount) {
    description.addEventListener("input", () => {
      descCharCount.textContent = description.value.length;
    });
  }
}

function renderTags() {
  const tagsContainer = document.getElementById("tagsContainer");
  if (!tagsContainer) return;

  tagsContainer.innerHTML = "";

  selectedTags.forEach((tag, index) => {
    const tagElement = document.createElement("span");
    tagElement.className = "tag";
    tagElement.innerHTML = `
            ${tag}
            <i class="fas fa-times" data-index="${index}"></i>
        `;
    tagsContainer.appendChild(tagElement);
  });

  document.querySelectorAll(".tag i").forEach((icon) => {
    icon.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const index = parseInt(e.target.dataset.index);
      selectedTags.splice(index, 1);
      renderTags();
    });
  });
}

async function handleSubmit(e) {
  e.preventDefault();

  if (!shopId) {
    notyf.error("Shop not found");
    return;
  }

  const variations = [];
  const variationRows = document.querySelectorAll(".variation-row");
  variationRows.forEach((row) => {
    const name = row.querySelector(".variation-name")?.value.trim();
    const price = parseFloat(row.querySelector(".variation-price")?.value);
    if (name && !isNaN(price)) {
      variations.push({ name, price });
    }
  });

  const formData = {
    name: document.getElementById("productName").value.trim(),
    description: document.getElementById("description").value.trim(),
    price: parseFloat(document.getElementById("price").value),
    discountPrice:
      parseFloat(document.getElementById("discountPrice").value) || 0,
    category: document.getElementById("category").value,
    stock: parseInt(document.getElementById("stock").value) || 0,
    preparationTime:
      parseInt(document.getElementById("preparationTime").value) || 0,
    tags: selectedTags,
    variations: variations,
    dietary: {
      vegetarian: document.getElementById("vegetarian")?.checked || false,
      vegan: document.getElementById("vegan")?.checked || false,
      glutenFree: document.getElementById("glutenFree")?.checked || false,
      spicy: document.getElementById("spicy")?.checked || false,
    },
    nutrition: {
      calories: document.getElementById("calories")?.value || null,
      protein: document.getElementById("protein")?.value || null,
      carbs: document.getElementById("carbs")?.value || null,
      fat: document.getElementById("fat")?.value || null,
    },
    isAvailable: document.getElementById("isAvailable")?.checked || false,
  };

  if (
    !formData.name ||
    !formData.price ||
    !formData.category ||
    !formData.preparationTime
  ) {
    notyf.error("Please fill in all required fields");
    return;
  }

  if (formData.discountPrice >= formData.price && formData.discountPrice > 0) {
    notyf.error("Discount price must be less than regular price");
    return;
  }

  const allImages = [
    ...existingImages,
    ...uploadedImages.map((img) => img.url),
  ];
  const allVideos = [
    ...existingVideos,
    ...uploadedVideos.map((vid) => vid.url),
  ];

  if (allImages.length === 0) {
    notyf.error("Please upload at least one image");
    return;
  }

  const loading = showLoading(
    notyf,
    productId ? "Updating product..." : "Creating product...",
  );

  try {
    const productData = {
      ...formData,
      shopId: shopId,
      images: allImages,
      videos: allVideos,
      updatedAt: serverTimestamp(),
    };

    if (!productId) {
      productData.createdAt = serverTimestamp();
      productData.soldCount = 0;
      productData.rating = 0;
      productData.reviewCount = 0;
    }

    if (productId) {
      await updateDoc(doc(db, "items", productId), productData);
      notyf.success("Product updated successfully");
    } else {
      await addDoc(collection(db, "items"), productData);
      notyf.success("Product created successfully");
    }

    notyf.dismiss(loading);

    setTimeout(() => {
      window.location.href = "/vendor";
    }, 1500);
  } catch (error) {
    notyf.dismiss(loading);
    notyf.error("Failed to save product: " + error.message);
  }
}

async function handleDelete(productId) {
  if (!productId) return;

  const confirmed = confirm(
    "Are you sure you want to delete this product? This action cannot be undone.",
  );

  if (!confirmed) return;

  const loading = showLoading(notyf, "Deleting product...");

  try {
    await deleteDoc(doc(db, "items", productId));

    notyf.dismiss(loading);
    notyf.success("Product deleted successfully");

    setTimeout(() => {
      window.location.href = "/vendor";
    }, 1500);
  } catch (error) {
    notyf.dismiss(loading);
    notyf.error("Failed to delete product: " + error.message);
  }
}
