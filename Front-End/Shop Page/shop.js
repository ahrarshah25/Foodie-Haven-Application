import {
  db,
  auth,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  orderBy,
  limit,
  onAuthStateChanged
} from "../Firebase/config.js";
import notyf from "../Notyf/notyf.js";
import showLoading from "../Notyf/loader.js";

let currentUser = null;
let allProducts = [];
let filteredProducts = [];
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let shopsCache = {};

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  await loadAllProducts();
  setupEventListeners();
  updateCartCount();
});

async function loadAllProducts() {
  try {
    const productsQuery = query(
      collection(db, "items"),
      where("isAvailable", "==", true),
      orderBy("createdAt", "desc"),
    );

    const productsSnapshot = await getDocs(productsQuery);

    allProducts = await Promise.all(
      productsSnapshot.docs.map(async (docu) => {
        const product = { id: docu.id, ...docu.data() };

        if (!shopsCache[product.shopId]) {
          const shopDoc = await getDoc(doc(db, "shops", product.shopId));
          if (shopDoc.exists()) {
            shopsCache[product.shopId] = shopDoc.data();
          }
        }

        return product;
      }),
    );

    filteredProducts = [...allProducts];

    renderProducts();
    renderCategories();
  } catch (error) {
    console.error("Error loading products:", error);
    notyf.error("Failed to load products");
    document.getElementById("productsGrid").innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Failed to Load Products</h3>
                <p>Please refresh the page to try again</p>
            </div>
        `;
  }
}

function renderProducts() {
  const grid = document.getElementById("productsGrid");

  if (filteredProducts.length === 0) {
    grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-utensils"></i>
                <h3>No Products Found</h3>
                <p>Try adjusting your filters or check back later</p>
            </div>
        `;
    return;
  }

  grid.innerHTML = filteredProducts
    .map((product) => {
      const shop = shopsCache[product.shopId] || {};

      return `
        <div class="product-card" data-product-id="${product.id}">
            <div class="product-image">
                <img src="${product.images?.[0] || "https://res.cloudinary.com/dnkuvmxuv/image/upload/v1770992966/default_food_qvzrjl.png"}" alt="${product.name}">
                ${
                  product.discountPrice > 0
                    ? `
                    <span class="product-badge">
                        ${Math.round((1 - product.discountPrice / product.price) * 100)}% OFF
                    </span>
                `
                    : ""
                }
            </div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <p class="product-description">${product.description?.substring(0, 80)}${product.description?.length > 80 ? "..." : ""}</p>
                <div class="product-meta">
                    <div class="product-rating">
                        <i class="fas fa-star"></i>
                        <span>${(product.rating || 4.5).toFixed(1)}</span>
                        <span>(${product.reviewCount || 0})</span>
                    </div>
                    <div class="product-price">
                        ${
                          product.discountPrice > 0
                            ? `
                            <span class="original-price">PKR ${product.price}</span>
                            <span>PKR ${product.discountPrice}</span>
                        `
                            : `
                            <span>PKR ${product.price}</span>
                        `
                        }
                    </div>
                </div>
                <div class="product-footer">
                    <div class="vendor-name">
                        <i class="fas fa-store"></i>
                        <span>${shop.shopName || "Foodie Haven"}</span>
                    </div>
                    <div class="dietary-tags">
                        ${product.dietary?.vegetarian ? '<span class="dietary-tag active" title="Vegetarian"><i class="fas fa-leaf"></i></span>' : ""}
                        ${product.dietary?.vegan ? '<span class="dietary-tag active" title="Vegan"><i class="fas fa-seedling"></i></span>' : ""}
                        ${product.dietary?.glutenFree ? '<span class="dietary-tag active" title="Gluten Free"><i class="fas fa-wheat-alt"></i></span>' : ""}
                        ${product.dietary?.spicy ? '<span class="dietary-tag active" title="Spicy"><i class="fas fa-pepper-hot"></i></span>' : ""}
                    </div>
                </div>
            </div>
        </div>
    `;
    })
    .join("");

  document.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (!e.target.closest(".add-to-cart-btn")) {
        const productId = card.dataset.productId;
        window.location.href = `/product?id=${productId}`;
      }
    });
  });
}

function renderCategories() {
  const categories = new Set();
  allProducts.forEach((product) => {
    if (product.category) categories.add(product.category);
  });

  const categoryList = document.getElementById("categoryList");
  categoryList.innerHTML = `
        <button class="category-item active" data-category="all">All Products</button>
        ${Array.from(categories)
          .map(
            (cat) => `
            <button class="category-item" data-category="${cat}">${cat}</button>
        `,
          )
          .join("")}
    `;

  document.querySelectorAll(".category-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".category-item")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filterProducts();
    });
  });
}

function filterProducts() {
  const activeCategory = document.querySelector(".category-item.active")
    ?.dataset.category;
  const searchTerm = document.getElementById("searchInput").value.toLowerCase();
  const vegetarian = document.getElementById("filterVegetarian").checked;
  const vegan = document.getElementById("filterVegan").checked;
  const glutenFree = document.getElementById("filterGlutenFree").checked;
  const spicy = document.getElementById("filterSpicy").checked;
  const minPrice = parseFloat(document.getElementById("minPrice").textContent);
  const maxPrice = parseFloat(document.getElementById("maxPrice").textContent);
  const sortBy = document.getElementById("sortSelect").value;

  filteredProducts = allProducts.filter((product) => {
    if (activeCategory !== "all" && product.category !== activeCategory)
      return false;

    if (
      searchTerm &&
      !product.name.toLowerCase().includes(searchTerm) &&
      !product.description?.toLowerCase().includes(searchTerm)
    )
      return false;

    const price = product.discountPrice || product.price;
    if (price < minPrice || price > maxPrice) return false;

    if (vegetarian && !product.dietary?.vegetarian) return false;
    if (vegan && !product.dietary?.vegan) return false;
    if (glutenFree && !product.dietary?.glutenFree) return false;
    if (spicy && !product.dietary?.spicy) return false;

    return true;
  });

  switch (sortBy) {
    case "price-low":
      filteredProducts.sort(
        (a, b) => (a.discountPrice || a.price) - (b.discountPrice || b.price),
      );
      break;
    case "price-high":
      filteredProducts.sort(
        (a, b) => (b.discountPrice || b.price) - (a.discountPrice || a.price),
      );
      break;
    case "rating":
      filteredProducts.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    case "newest":
      filteredProducts.sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
      );
      break;
  }

  renderProducts();
}

function updateCartCount() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById("cartCount").textContent = count;
}

function setupEventListeners() {
  document
    .getElementById("searchInput")
    .addEventListener("input", filterProducts);

  document
    .getElementById("filterVegetarian")
    .addEventListener("change", filterProducts);
  document
    .getElementById("filterVegan")
    .addEventListener("change", filterProducts);
  document
    .getElementById("filterGlutenFree")
    .addEventListener("change", filterProducts);
  document
    .getElementById("filterSpicy")
    .addEventListener("change", filterProducts);

  document
    .getElementById("sortSelect")
    .addEventListener("change", filterProducts);

  const priceMin = document.getElementById("priceMin");
  const priceMax = document.getElementById("priceMax");

  priceMin.addEventListener("input", () => {
    if (parseInt(priceMin.value) <= parseInt(priceMax.value)) {
      document.getElementById("minPrice").textContent = priceMin.value;
      filterProducts();
    }
  });

  priceMax.addEventListener("input", () => {
    if (parseInt(priceMax.value) >= parseInt(priceMin.value)) {
      document.getElementById("maxPrice").textContent = priceMax.value;
      filterProducts();
    }
  });

  document.getElementById("cartIcon").addEventListener("click", () => {
    document.getElementById("cartSidebar").classList.add("open");
    renderCart();
  });

  document.getElementById("closeCart").addEventListener("click", () => {
    document.getElementById("cartSidebar").classList.remove("open");
  });

  document.getElementById("checkoutBtn").addEventListener("click", () => {
    if (cart.length === 0) {
      notyf.error("Your cart is empty");
      return;
    }
    window.location.href = "/checkout";
  });

  document.getElementById("userMenu").addEventListener("click", () => {
    if (currentUser) {
      window.location.href = "/shop";
    } else {
      window.location.href = "/account-type";
    }
  });
}

function renderCart() {
  const cartItems = document.getElementById("cartItems");

  if (cart.length === 0) {
    cartItems.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-shopping-basket"></i>
                <p>Your cart is empty</p>
                <p class="empty-sub">Add items to get started</p>
            </div>
        `;
    updateCartTotal();
    return;
  }

  cartItems.innerHTML = cart
    .map(
      (item, index) => `
        <div class="cart-item" data-index="${index}">
            <div class="cart-item-image">
                <img src="${item.image || "https://res.cloudinary.com/dnkuvmxuv/image/upload/v1770992966/default_food_qvzrjl.png"}" alt="${item.name}">
            </div>
            <div class="cart-item-details">
                <h4>${item.name}</h4>
                <div class="cart-item-price">PKR ${item.price}</div>
                ${
                  item.selectedVariations?.length > 0
                    ? `
                    <div class="cart-item-variations">
                        ${item.selectedVariations
                          .map(
                            (v) => `
                            <small>+ ${v.name} (PKR ${v.price})</small>
                        `,
                          )
                          .join("")}
                    </div>
                `
                    : ""
                }
                <div class="cart-item-quantity">
                    <button class="quantity-btn minus">-</button>
                    <span>${item.quantity}</span>
                    <button class="quantity-btn plus">+</button>
                </div>
            </div>
            <button class="remove-item">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `,
    )
    .join("");

  document.querySelectorAll(".cart-item .minus").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const index = btn.closest(".cart-item").dataset.index;
      updateCartQuantity(index, -1);
    });
  });

  document.querySelectorAll(".cart-item .plus").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const index = btn.closest(".cart-item").dataset.index;
      updateCartQuantity(index, 1);
    });
  });

  document.querySelectorAll(".remove-item").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const index = btn.closest(".cart-item").dataset.index;
      removeFromCart(index);
    });
  });

  updateCartTotal();
}

function updateCartQuantity(index, change) {
  const item = cart[index];
  item.quantity += change;

  if (item.quantity <= 0) {
    cart.splice(index, 1);
    notyf.success("Item removed from cart");
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
  renderCart();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
  renderCart();
  notyf.success("Item removed from cart");
}

function updateCartTotal() {
  const total = cart.reduce((sum, item) => {
    const itemTotal = (item.price || 0) * (item.quantity || 0);
    const variationsTotal =
      (item.selectedVariations || []).reduce((s, v) => s + (v.price || 0), 0) *
      (item.quantity || 0);
    return sum + itemTotal + variationsTotal;
  }, 0);
  document.getElementById("cartTotal").textContent =
    `PKR ${total.toLocaleString()}`;
}
