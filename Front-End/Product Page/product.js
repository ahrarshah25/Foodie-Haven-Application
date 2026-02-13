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
  serverTimestamp,
  orderBy,
  onAuthStateChanged
} from "../Firebase/config.js";
import notyf from "../Notyf/notyf.js";
import showLoading from "../Notyf/loader.js";

let currentUser = null;
let currentProduct = null;
let currentShop = null;
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let selectedVariations = [];
let currentRating = 0;

const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get("id");

if (!productId) {
  window.location.href = "/shop";
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  await loadProductData();
  setupEventListeners();
  updateCartCount();
});

async function loadProductData() {
  try {
    const productDoc = await getDoc(doc(db, "items", productId));

    if (!productDoc.exists()) {
      notyf.error("Product not found");
      setTimeout(() => {
        window.location.href = "/shop";
      }, 2000);
      return;
    }

    currentProduct = { id: productDoc.id, ...productDoc.data() };

    const shopDoc = await getDoc(doc(db, "shops", currentProduct.shopId));
    if (shopDoc.exists()) {
      currentShop = shopDoc.data();
    }

    renderProductDetails();
    loadReviews();
  } catch (error) {
    console.error("Error loading product:", error);
    notyf.error("Failed to load product details");
  }
}

function renderProductDetails() {
  const container = document.getElementById("productDetailContainer");

  const discount =
    currentProduct.discountPrice > 0
      ? Math.round(
          (1 - currentProduct.discountPrice / currentProduct.price) * 100,
        )
      : 0;

  container.innerHTML = `
        <div class="product-detail">
            <div class="product-gallery">
                <div class="main-image">
                    <img src="${currentProduct.images?.[0] || "https://res.cloudinary.com/dnkuvmxuv/image/upload/v1770992966/default_food_qvzrjl.png"}" alt="${currentProduct.name}" id="mainProductImage">
                </div>
                ${
                  currentProduct.images?.length > 1
                    ? `
                    <div class="thumbnail-grid">
                        ${currentProduct.images
                          .map(
                            (img, idx) => `
                            <div class="thumbnail ${idx === 0 ? "active" : ""}" data-index="${idx}">
                                <img src="${img}" alt="Thumbnail ${idx + 1}">
                            </div>
                        `,
                          )
                          .join("")}
                    </div>
                `
                    : ""
                }
                ${
                  currentProduct.videos?.length > 0
                    ? `
                    <div class="product-video">
                        <video controls>
                            <source src="${currentProduct.videos[0]}" type="video/mp4">
                        </video>
                    </div>
                `
                    : ""
                }
            </div>
            
            <div class="product-info">
                <h1>${currentProduct.name}</h1>
                
                <div class="product-meta">
                    <div class="product-rating">
                        <i class="fas fa-star"></i>
                        <span>${(currentProduct.rating || 4.5).toFixed(1)}</span>
                        <span>(${currentProduct.reviewCount || 0} reviews)</span>
                    </div>
                    <div class="vendor-info">
                        <a href="/shop?vendor=${currentProduct.shopId}" class="vendor-link">
                            <i class="fas fa-store"></i>
                            <span>${currentShop?.shopName || "View Shop"}</span>
                        </a>
                    </div>
                </div>
                
                <div class="price-section">
                    <div class="current-price">
                        <span class="price">PKR ${currentProduct.discountPrice || currentProduct.price}</span>
                        ${
                          currentProduct.discountPrice > 0
                            ? `
                            <span class="original-price">PKR ${currentProduct.price}</span>
                            <span class="discount-badge">${discount}% OFF</span>
                        `
                            : ""
                        }
                    </div>
                    <div class="preparation-time">
                        <i class="fas fa-clock"></i>
                        <span>Preparation Time: ${currentProduct.preparationTime || 30} minutes</span>
                    </div>
                </div>
                
                <div class="description-section">
                    <h3>Description</h3>
                    <p>${currentProduct.description || "No description available."}</p>
                </div>
                
                <div class="dietary-section">
                    <h3>Dietary Information</h3>
                    <div class="dietary-badges">
                        ${
                          currentProduct.dietary?.vegetarian
                            ? `
                            <span class="dietary-badge active">
                                <i class="fas fa-leaf"></i> Vegetarian
                            </span>
                        `
                            : ""
                        }
                        ${
                          currentProduct.dietary?.vegan
                            ? `
                            <span class="dietary-badge active">
                                <i class="fas fa-seedling"></i> Vegan
                            </span>
                        `
                            : ""
                        }
                        ${
                          currentProduct.dietary?.glutenFree
                            ? `
                            <span class="dietary-badge active">
                                <i class="fas fa-wheat-alt"></i> Gluten Free
                            </span>
                        `
                            : ""
                        }
                        ${
                          currentProduct.dietary?.spicy
                            ? `
                            <span class="dietary-badge active">
                                <i class="fas fa-pepper-hot"></i> Spicy
                            </span>
                        `
                            : ""
                        }
                    </div>
                </div>
                
                ${
                  currentProduct.nutrition
                    ? `
                    <div class="nutrition-section">
                        <h3>Nutritional Information (per serving)</h3>
                        <div class="nutrition-grid">
                            ${
                              currentProduct.nutrition.calories
                                ? `
                                <div class="nutrition-item">
                                    <span class="label">Calories</span>
                                    <span class="value">${currentProduct.nutrition.calories}</span>
                                </div>
                            `
                                : ""
                            }
                            ${
                              currentProduct.nutrition.protein
                                ? `
                                <div class="nutrition-item">
                                    <span class="label">Protein</span>
                                    <span class="value">${currentProduct.nutrition.protein}g</span>
                                </div>
                            `
                                : ""
                            }
                            ${
                              currentProduct.nutrition.carbs
                                ? `
                                <div class="nutrition-item">
                                    <span class="label">Carbs</span>
                                    <span class="value">${currentProduct.nutrition.carbs}g</span>
                                </div>
                            `
                                : ""
                            }
                            ${
                              currentProduct.nutrition.fat
                                ? `
                                <div class="nutrition-item">
                                    <span class="label">Fat</span>
                                    <span class="value">${currentProduct.nutrition.fat}g</span>
                                </div>
                            `
                                : ""
                            }
                        </div>
                    </div>
                `
                    : ""
                }
                
                ${
                  currentProduct.tags?.length > 0
                    ? `
                    <div class="tags-section">
                        <h3>Tags</h3>
                        <div class="tags-list">
                            ${currentProduct.tags
                              .map(
                                (tag) => `
                                <span class="tag">#${tag}</span>
                            `,
                              )
                              .join("")}
                        </div>
                    </div>
                `
                    : ""
                }
                
                ${
                  currentProduct.variations?.length > 0
                    ? `
                    <div class="variations-section">
                        <h3>Add-ons & Variations</h3>
                        ${currentProduct.variations
                          .map(
                            (variation, idx) => `
                            <div class="variation-option" data-index="${idx}" data-name="${variation.name}" data-price="${variation.price}">
                                <span class="variation-name">${variation.name}</span>
                                <span class="variation-price">+PKR ${variation.price}</span>
                            </div>
                        `,
                          )
                          .join("")}
                    </div>
                `
                    : ""
                }
                
                <div class="actions-section">
                    <button class="btn-add-to-cart" id="addToCartBtn">
                        <i class="fas fa-shopping-cart"></i>
                        <span>Add to Cart</span>
                    </button>
                    <button class="btn-buy-now" id="buyNowBtn">
                        <i class="fas fa-bolt"></i>
                        <span>Buy Now</span>
                    </button>
                </div>
            </div>
        </div>
        
        <div class="reviews-section">
            <h2>Customer Reviews</h2>
            
            ${
              currentUser
                ? `
                <div class="review-form">
                    <textarea id="reviewText" placeholder="Write your review..." rows="3"></textarea>
                    <div class="review-form-footer">
                        <div class="rating-input">
                            <i class="far fa-star" data-rating="1"></i>
                            <i class="far fa-star" data-rating="2"></i>
                            <i class="far fa-star" data-rating="3"></i>
                            <i class="far fa-star" data-rating="4"></i>
                            <i class="far fa-star" data-rating="5"></i>
                        </div>
                        <button class="submit-review" id="submitReview">Submit Review</button>
                    </div>
                </div>
            `
                : ""
            }
            
            <div class="reviews-list" id="reviewsList">
                <div class="loading-spinner">
                    <div class="spinner"></div>
                </div>
            </div>
        </div>
    `;

  setupProductDetailListeners();
}

function setupProductDetailListeners() {
  const thumbnails = document.querySelectorAll(".thumbnail");
  const mainImage = document.getElementById("mainProductImage");

  thumbnails.forEach((thumb) => {
    thumb.addEventListener("click", () => {
      thumbnails.forEach((t) => t.classList.remove("active"));
      thumb.classList.add("active");
      const img = thumb.querySelector("img").src;
      mainImage.src = img;
    });
  });

  const variationOptions = document.querySelectorAll(".variation-option");
  variationOptions.forEach((option) => {
    option.addEventListener("click", () => {
      option.classList.toggle("selected");

      const name = option.dataset.name;
      const price = parseFloat(option.dataset.price);

      if (option.classList.contains("selected")) {
        selectedVariations.push({ name, price });
      } else {
        selectedVariations = selectedVariations.filter((v) => v.name !== name);
      }
    });
  });

  document.getElementById("addToCartBtn").addEventListener("click", addToCart);
  document.getElementById("buyNowBtn").addEventListener("click", buyNow);

  if (document.getElementById("submitReview")) {
    const stars = document.querySelectorAll(".rating-input i");
    stars.forEach((star) => {
      star.addEventListener("mouseenter", () => {
        const rating = parseInt(star.dataset.rating);
        stars.forEach((s, idx) => {
          if (idx < rating) {
            s.classList.remove("far");
            s.classList.add("fas");
          } else {
            s.classList.remove("fas");
            s.classList.add("far");
          }
        });
      });

      star.addEventListener("click", () => {
        currentRating = parseInt(star.dataset.rating);
      });
    });

    document
      .getElementById("submitReview")
      .addEventListener("click", submitReview);
  }
}

function addToCart() {
  const price = currentProduct.discountPrice || currentProduct.price;
  const totalPrice =
    price + selectedVariations.reduce((sum, v) => sum + v.price, 0);

  const existingItem = cart.find((item) => item.id === currentProduct.id);

  if (existingItem) {
    existingItem.quantity++;
    existingItem.selectedVariations = selectedVariations;
  } else {
    cart.push({
      id: currentProduct.id,
      name: currentProduct.name,
      price: price,
      totalPrice: totalPrice,
      image: currentProduct.images?.[0],
      quantity: 1,
      selectedVariations: selectedVariations,
      shopId: currentProduct.shopId,
      shopName: currentShop?.shopName,
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();

  notyf.success(`${currentProduct.name} added to cart!`);
}

function buyNow() {
  addToCart();
  setTimeout(() => {
    window.location.href = "/checkout";
  }, 500);
}

function updateCartCount() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById("cartCount").textContent = count;
}

async function loadReviews() {
  try {
    const reviewsQuery = query(
      collection(db, "reviews"),
      where("productId", "==", productId),
      orderBy("createdAt", "desc"),
    );

    const reviewsSnapshot = await getDocs(reviewsQuery);

    const reviewsList = document.getElementById("reviewsList");

    if (reviewsSnapshot.empty) {
      reviewsList.innerHTML = `
                <div class="empty-reviews">
                    <i class="far fa-comment-dots"></i>
                    <p>No reviews yet. Be the first to review!</p>
                </div>
            `;
      return;
    }

    reviewsList.innerHTML = reviewsSnapshot.docs
      .map((doc) => {
        const review = doc.data();
        return `
                <div class="review-item">
                    <div class="review-header">
                        <div class="review-avatar">
                            ${review.userName?.charAt(0) || "U"}
                        </div>
                        <div class="review-user">
                            <h4>${review.userName || "Anonymous"}</h4>
                            <span class="review-date">${formatDate(review.createdAt)}</span>
                        </div>
                        <div class="review-rating">
                            ${Array(5)
                              .fill()
                              .map(
                                (_, i) => `
                                <i class="${i < review.rating ? "fas" : "far"} fa-star"></i>
                            `,
                              )
                              .join("")}
                        </div>
                    </div>
                    <p class="review-text">${review.text}</p>
                </div>
            `;
      })
      .join("");
  } catch (error) {
    console.error("Error loading reviews:", error);
    document.getElementById("reviewsList").innerHTML = `
            <div class="empty-reviews">
                <i class="fas fa-exclamation-circle"></i>
                <p>Failed to load reviews</p>
            </div>
        `;
  }
}

function formatDate(timestamp) {
  if (!timestamp) return "Recently";
  const date = timestamp.toDate();
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function submitReview() {
  if (!currentUser) {
    notyf.error("Please login to submit a review");
    return;
  }

  const text = document.getElementById("reviewText").value.trim();

  if (!text) {
    notyf.error("Please write a review");
    return;
  }

  if (currentRating === 0) {
    notyf.error("Please select a rating");
    return;
  }

  const loading = showLoading(notyf, "Submitting review...");

  try {
    await addDoc(collection(db, "reviews"), {
      productId: productId,
      userId: currentUser.uid,
      userName:
        currentUser.displayName || currentUser.email?.split("@")[0] || "Foodie",
      rating: currentRating,
      text: text,
      createdAt: serverTimestamp(),
    });

    notyf.dismiss(loading);
    notyf.success("Review submitted successfully!");

    document.getElementById("reviewText").value = "";
    currentRating = 0;

    document.querySelectorAll(".rating-input i").forEach((star) => {
      star.classList.remove("fas");
      star.classList.add("far");
    });

    loadReviews();
  } catch (error) {
    notyf.dismiss(loading);
    notyf.error("Failed to submit review: " + error.message);
  }
}

function setupEventListeners() {
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
      window.location.href = "/account";
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
