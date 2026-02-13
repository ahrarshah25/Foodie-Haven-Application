import {
  auth,
  db,
  onAuthStateChanged,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  onSnapshot,
} from "../Firebase/config.js";
import notyf from "../Notyf/notyf.js";
import showLoading from "../Notyf/loader.js";

let currentUser = null;
let currentShop = null;
let shopId = null;
let currentFilter = "all";
let searchTerm = "";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login";
    return;
  }

  currentUser = user;

  try {
    const loading = showLoading(notyf, "Loading dashboard...");

    const userDoc = await getDoc(doc(db, "users", user.uid));

    if (!userDoc.exists() || userDoc.data().userRole !== "vendor") {
      notyf.error("Access denied. Vendor only area.");
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
      return;
    }

    const userData = userDoc.data();

    if (!userData.isVerified) {
      showUnverifiedScreen();
      notyf.error(
        "Your vendor account is pending verification. You cannot access the dashboard yet.",
      );
      return;
    }

    const shopsQuery = query(
      collection(db, "shops"),
      where("vendorId", "==", user.uid),
      limit(1),
    );

    const shopsSnapshot = await getDocs(shopsQuery);

    if (shopsSnapshot.empty) {
      showShopSetupScreen();
      notyf.error("Please set up your shop first.");
    } else {
      const shopDoc = shopsSnapshot.docs[0];
      currentShop = shopDoc.data();
      shopId = shopDoc.id;

      document.getElementById("shopName").textContent =
        currentShop.shopName || "My Shop";

      const statusBadge = document.getElementById("shopStatusBadge");
      statusBadge.className = `status-badge ${currentShop.isActive ? "verified" : "pending"}`;
      statusBadge.innerHTML = currentShop.isActive
        ? '<i class="fas fa-check-circle"></i> Active'
        : '<i class="fas fa-clock"></i> Inactive';

      notyf.dismiss(loading);

      loadDashboardData();
      setupRealtimeListeners();
    }
  } catch (error) {
    notyf.error("Error loading dashboard: " + error.message);
  }
});

function showUnverifiedScreen() {
  const dashboardContent = document.getElementById("dashboardContent");
  dashboardContent.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-clock"></i>
            <h3>Account Pending Verification</h3>
            <p>Your vendor account is currently under review by our admin team.</p>
            <p style="margin-top: 16px; color: var(--text-light);">This process usually takes 24-48 hours. You'll receive an email once your account is verified.</p>
        </div>
    `;
}

function showShopSetupScreen() {
  const dashboardContent = document.getElementById("dashboardContent");
  dashboardContent.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-store"></i>
            <h3>Set Up Your Shop</h3>
            <p>You haven't created your shop yet. Let's get started!</p>
            <button class="btn-primary" style="margin-top: 24px;" onclick="window.location.href='/vendor/shop-setup'">
                Create Your Shop
            </button>
        </div>
    `;
}

async function loadDashboardData() {
  if (!shopId) return;

  const dashboardContent = document.getElementById("dashboardContent");

  try {
    // Fix: orders query - each order has shopIds array, need to check if shopId is in that array
    const ordersQuery = query(
      collection(db, "orders"),
      where("shopIds", "array-contains", shopId),
      orderBy("createdAt", "desc"),
      limit(50),
    );

    const productsQuery = query(
      collection(db, "items"),
      where("shopId", "==", shopId),
      orderBy("createdAt", "desc"),
    );

    const [ordersSnapshot, productsSnapshot, categories] = await Promise.all([
      getDocs(ordersQuery),
      getDocs(productsQuery),
      getShopCategories(),
    ]);

    const orders = [];
    let totalRevenue = 0;
    let pendingCount = 0;
    let completedCount = 0;

    ordersSnapshot.forEach((doc) => {
      const order = { id: doc.id, ...doc.data() };
      orders.push(order);

      if (order.status === "completed") {
        totalRevenue += order.total || 0;
        completedCount++;
      } else if (order.status === "pending") {
        pendingCount++;
      }
    });

    const products = [];
    productsSnapshot.forEach((doc) => {
      products.push({ id: doc.id, ...doc.data() });
    });

    updateStats(
      totalRevenue,
      orders.length,
      pendingCount,
      completedCount,
      products.length,
    );

    updatePendingBadges(pendingCount);

    renderDashboardView(orders, products, categories);
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    notyf.error("Failed to load dashboard data");
  }
}

function updateStats(revenue, totalOrders, pending, completed, totalProducts) {
  const totalRevenueEl = document.getElementById("totalRevenue");
  if (totalRevenueEl) {
    totalRevenueEl.textContent = `PKR ${revenue.toLocaleString()}`;
  }

  const totalOrdersEl = document.getElementById("totalOrders");
  if (totalOrdersEl) totalOrdersEl.textContent = totalOrders;

  const pendingOrdersEl = document.getElementById("pendingOrders");
  if (pendingOrdersEl) pendingOrdersEl.textContent = pending;

  const completedOrdersEl = document.getElementById("completedOrders");
  if (completedOrdersEl) completedOrdersEl.textContent = completed;

  const totalProductsEl = document.getElementById("totalProducts");
  if (totalProductsEl) totalProductsEl.textContent = totalProducts;

  const badge = document.getElementById("pendingOrdersNavBadge");
  if (badge) {
    badge.textContent = pending;
    badge.style.display = pending > 0 ? "inline" : "none";
  }
}

function updatePendingBadges(count) {
  const badge = document.getElementById("pendingOrdersNavBadge");
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? "inline" : "none";
  }
}

function renderDashboardView(orders, products, categories) {
  const dashboardContent = document.getElementById("dashboardContent");

  const pendingOrders = orders
    .filter((o) => o.status === "pending")
    .slice(0, 5);
  const recentOrders = orders.slice(0, 5);

  const topProducts = products
    .map((p) => ({
      ...p,
      orderCount: p.orderCount || Math.floor(Math.random() * 50) + 10,
    }))
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 5);

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);

  dashboardContent.innerHTML = `
        <div class="welcome-section">
            <h1>Welcome back, <span>${currentShop?.shopName || "Vendor"}</span> 👋</h1>
            <p>Here's what's happening with your shop today</p>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-chart-line"></i>
                </div>
                <div class="stat-info">
                    <h3 id="totalRevenue">PKR ${totalRevenue.toLocaleString()}</h3>
                    <p>Total Revenue</p>
                </div>
                <div class="stat-trend up">
                    <i class="fas fa-arrow-up"></i>
                    <span>+12.5%</span>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-shopping-cart"></i>
                </div>
                <div class="stat-info">
                    <h3 id="totalOrders">${orders.length}</h3>
                    <p>Total Orders</p>
                </div>
                <div class="stat-trend up">
                    <i class="fas fa-arrow-up"></i>
                    <span>+8.2%</span>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-clock"></i>
                </div>
                <div class="stat-info">
                    <h3 id="pendingOrders">${pendingOrders.length}</h3>
                    <p>Pending Orders</p>
                </div>
                <div class="stat-trend">
                    <i class="fas fa-minus"></i>
                    <span>Pending</span>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <div class="stat-info">
                    <h3 id="completedOrders">${orders.filter((o) => o.status === "completed").length}</h3>
                    <p>Completed</p>
                </div>
                <div class="stat-trend up">
                    <i class="fas fa-arrow-up"></i>
                    <span>+15.3%</span>
                </div>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-box"></i>
                </div>
                <div class="stat-info">
                    <h3 id="totalProducts">${products.length}</h3>
                    <p>Products</p>
                </div>
                <a href="upload" class="stat-action">
                    <i class="fas fa-plus"></i> Add New
                </a>
            </div>
            
            <div class="stat-card">
                <div class="stat-icon">
                    <i class="fas fa-star"></i>
                </div>
                <div class="stat-info">
                    <h3>4.8</h3>
                    <p>Average Rating</p>
                </div>
                <div class="rating-stars">
                    <i class="fas fa-star"></i>
                    <i class="fas fa-star"></i>
                    <i class="fas fa-star"></i>
                    <i class="fas fa-star"></i>
                    <i class="fas fa-star-half-alt"></i>
                </div>
            </div>
        </div>
        
        <div class="dashboard-grid">
            <div class="recent-orders-card">
                <div class="card-header">
                    <div>
                        <h2>Recent Orders</h2>
                        <p>Latest orders from your customers</p>
                    </div>
                    <div class="order-filters">
                        <button class="filter-btn ${currentFilter === "all" ? "active" : ""}" data-filter="all">All</button>
                        <button class="filter-btn ${currentFilter === "pending" ? "active" : ""}" data-filter="pending">Pending</button>
                        <button class="filter-btn ${currentFilter === "completed" ? "active" : ""}" data-filter="completed">Completed</button>
                        <button class="filter-btn ${currentFilter === "cancelled" ? "active" : ""}" data-filter="cancelled">Cancelled</button>
                    </div>
                </div>
                
                <div class="orders-table-container">
                    <table class="orders-table">
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Customer</th>
                                <th>Items</th>
                                <th>Total</th>
                                <th>Status</th>
                                <th>Payment</th>
                                <th>Proof</th>
                                <th>Date</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody id="ordersTableBody">
                            ${renderOrdersTable(recentOrders)}
                        </tbody>
                    </table>
                    ${
                      orders.length === 0
                        ? `
                        <div class="empty-state">
                            <i class="fas fa-shopping-bag"></i>
                            <h3>No orders yet</h3>
                            <p>When customers place orders, they'll appear here</p>
                        </div>
                    `
                        : ""
                    }
                </div>
            </div>
            
            <div class="top-products-card">
                <h2>Top Selling Products</h2>
                <div class="products-list" id="topProductsList">
                    ${renderTopProducts(topProducts)}
                </div>
                ${
                  products.length === 0
                    ? `
                    <div class="empty-state">
                        <i class="fas fa-box-open"></i>
                        <h3>No products yet</h3>
                        <p>Start adding products to your shop</p>
                        <a href="upload" class="btn-primary" style="margin-top: 16px; display: inline-block; padding: 10px 20px; text-decoration: none;">
                            Add Your First Product
                        </a>
                    </div>
                `
                    : ""
                }
            </div>
        </div>
    `;

  attachFilterListeners();
}

function renderOrdersTable(orders) {
  if (orders.length === 0) {
    return `<tr><td colspan="9" class="empty-cell">No orders found</td></tr>`;
  }

  return orders
    .map(
      (order) => `
        <tr class="order-row">
            <td class="order-id">#${order.id.slice(-6)}</td>
            <td>
                <div class="customer-info">
                    <strong>${order.customerName || "Customer"}</strong>
                    <span>${order.customerPhone || "No phone"}</span>
                    <small>${order.shippingAddress || "No address"}</small>
                </div>
            </td>
            <td>${order.items?.length || 0} items</td>
            <td class="order-total">PKR ${(order.total || 0).toLocaleString()}</td>
            <td>
                <span class="status-badge ${order.status || "pending"}">
                    <i class="fas fa-${order.status === "completed" ? "check-circle" : order.status === "cancelled" ? "ban" : "clock"}"></i> 
                    ${order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : "Pending"}
                </span>
            </td>
            <td>
                <span class="payment-method">
                    <i class="fas fa-${order.paymentMethod === "jazzcash" ? "mobile-alt" : order.paymentMethod === "easypaisa" ? "mobile-alt" : "credit-card"}"></i> 
                    ${order.paymentMethod ? order.paymentMethod.charAt(0).toUpperCase() + order.paymentMethod.slice(1) : "Card"}
                </span>
            </td>
            <td>
                ${
                  order.paymentProof
                    ? `
                    <button class="view-proof-btn" onclick="window.viewProof('${order.paymentProof}')">
                        <i class="fas fa-image"></i> View
                    </button>
                `
                    : "No proof"
                }
            </td>
            <td>${
              order.createdAt
                ? new Date(order.createdAt.toDate()).toLocaleDateString(
                    "en-PK",
                    {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )
                : "N/A"
            }</td>
            <td>
                <div class="order-actions">
                    ${
                      order.status === "pending"
                        ? `
                        <button class="action-btn accept" onclick="window.updateOrderStatus('${order.id}', 'completed')" title="Accept Order">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="action-btn reject" onclick="window.updateOrderStatus('${order.id}', 'cancelled')" title="Reject Order">
                            <i class="fas fa-times"></i>
                        </button>
                    `
                        : ""
                    }
                    <button class="action-btn view" onclick="window.viewOrderDetails('${order.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </td>
        </tr>
    `,
    )
    .join("");
}

function renderTopProducts(products) {
  if (products.length === 0) {
    return `<div class="empty-state">No products yet</div>`;
  }

  return products
    .map(
      (product) => `
        <div class="product-item">
            <div class="product-image">
                ${
                  product.images && product.images[0]
                    ? `<img src="${product.images[0]}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;">`
                    : `<i class="fas fa-${getProductIcon(product.category)}"></i>`
                }
            </div>
            <div class="product-details">
                <h4>${product.name}</h4>
                <p>${product.orderCount || 0} orders this month</p>
            </div>
            <div class="product-revenue">
                <strong>PKR ${((product.price || 0) * (product.orderCount || 0)).toLocaleString()}</strong>
            </div>
        </div>
    `,
    )
    .join("");
}

function getProductIcon(category) {
  const icons = {
    Pizza: "pizza-slice",
    Burger: "hamburger",
    Drinks: "coffee",
    Desserts: "ice-cream",
    Chinese: "dragon",
    BBQ: "fire",
    Seafood: "fish",
    Vegetarian: "carrot",
    "Fast Food": "hamburger",
    Biryani: "rice",
    Bread: "bread-slice",
    Pasta: "wheat-alt",
    Salad: "salad",
    Breakfast: "egg",
  };
  return icons[category] || "utensils";
}

async function loadOrdersView(filter = "all") {
  if (!shopId) return;

  const dashboardContent = document.getElementById("dashboardContent");
  dashboardContent.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <p>Loading orders...</p>
        </div>
    `;

  try {
    let ordersQuery;

    if (filter !== "all") {
      ordersQuery = query(
        collection(db, "orders"),
        where("shopIds", "array-contains", shopId),
        where("status", "==", filter),
        orderBy("createdAt", "desc"),
      );
    } else {
      ordersQuery = query(
        collection(db, "orders"),
        where("shopIds", "array-contains", shopId),
        orderBy("createdAt", "desc"),
      );
    }

    const ordersSnapshot = await getDocs(ordersQuery);
    const orders = [];

    ordersSnapshot.forEach((doc) => {
      orders.push({ id: doc.id, ...doc.data() });
    });

    dashboardContent.innerHTML = `
            <div class="recent-orders-card">
                <div class="card-header">
                    <div>
                        <h2>Orders Management</h2>
                        <p>${filter === "all" ? "All orders" : filter.charAt(0).toUpperCase() + filter.slice(1) + " orders"}</p>
                    </div>
                    <div class="order-filters">
                        <button class="filter-btn ${filter === "all" ? "active" : ""}" data-filter="all">All</button>
                        <button class="filter-btn ${filter === "pending" ? "active" : ""}" data-filter="pending">Pending</button>
                        <button class="filter-btn ${filter === "completed" ? "active" : ""}" data-filter="completed">Completed</button>
                        <button class="filter-btn ${filter === "cancelled" ? "active" : ""}" data-filter="cancelled">Cancelled</button>
                    </div>
                </div>
                
                <div class="orders-table-container">
                    <table class="orders-table">
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Customer</th>
                                <th>Items</th>
                                <th>Total</th>
                                <th>Status</th>
                                <th>Payment</th>
                                <th>Proof</th>
                                <th>Date</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody id="ordersTableBody">
                            ${renderOrdersTable(orders)}
                        </tbody>
                    </table>
                    ${
                      orders.length === 0
                        ? `
                        <div class="empty-state">
                            <i class="fas fa-shopping-bag"></i>
                            <h3>No ${filter === "all" ? "" : filter} orders found</h3>
                            <p>When customers place orders, they'll appear here</p>
                        </div>
                    `
                        : ""
                    }
                </div>
            </div>
        `;

    attachFilterListeners();
  } catch (error) {
    console.error("Error loading orders:", error);
    notyf.error("Failed to load orders");
  }
}

async function loadProductsView() {
  if (!shopId) return;

  const dashboardContent = document.getElementById("dashboardContent");
  dashboardContent.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <p>Loading products...</p>
        </div>
    `;

  try {
    const productsSnapshot = await getDocs(
      query(
        collection(db, "items"),
        where("shopId", "==", shopId),
        orderBy("createdAt", "desc"),
      ),
    );

    const products = [];
    productsSnapshot.forEach((doc) => {
      products.push({ id: doc.id, ...doc.data() });
    });

    dashboardContent.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <div>
                    <h2 style="font-size: 1.8rem; font-weight: 700;">My Products</h2>
                    <p style="color: var(--text-light);">${products.length} products in your inventory</p>
                </div>
                <a href="upload" style="background: var(--primary-yellow); color: var(--text-dark); padding: 12px 24px; border-radius: 50px; text-decoration: none; font-weight: 600; display: flex; align-items: center; gap: 8px; transition: var(--transition);">
                    <i class="fas fa-plus"></i> Add New Product
                </a>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 2rem;">
                ${products
                  .map(
                    (product) => `
                    <div style="background: var(--white); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow); border: 1px solid var(--medium-gray); transition: var(--transition);">
                        <div style="height: 200px; background: var(--light-gray); display: flex; align-items: center; justify-content: center;">
                            ${
                              product.images && product.images[0]
                                ? `<img src="${product.images[0]}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: cover;">`
                                : `<i class="fas fa-${getProductIcon(product.category)}" style="font-size: 3rem; color: var(--medium-gray);"></i>`
                            }
                        </div>
                        <div style="padding: 1.5rem;">
                            <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 0.5rem;">${product.name}</h3>
                            <p style="color: var(--text-light); font-size: 0.9rem; margin-bottom: 1rem;">${product.description?.substring(0, 60) || "No description"}</p>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 1.3rem; font-weight: 700; color: var(--primary-yellow);">PKR ${(product.price || 0).toLocaleString()}</span>
                                <div style="display: flex; gap: 8px;">
                                    <button onclick="window.editProduct('${product.id}')" style="background: var(--light-gray); border: none; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: var(--transition);" title="Edit Product">
                                        <i class="fas fa-edit" style="color: var(--text-dark);"></i>
                                    </button>
                                    <button onclick="window.deleteProduct('${product.id}')" style="background: var(--light-gray); border: none; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: var(--transition);" title="Delete Product">
                                        <i class="fas fa-trash" style="color: var(--error-red);"></i>
                                    </button>
                                </div>
                            </div>
                            <small style="color: var(--text-light); display: block; margin-top: 8px;">
                                Category: ${product.category || "Uncategorized"}
                            </small>
                        </div>
                    </div>
                `,
                  )
                  .join("")}
            </div>
            
            ${
              products.length === 0
                ? `
                <div class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <h3>No products yet</h3>
                    <p>Start adding products to your shop</p>
                    <a href="upload" style="background: var(--primary-yellow); color: var(--text-dark); padding: 12px 24px; border-radius: 50px; text-decoration: none; font-weight: 600; display: inline-block; margin-top: 16px;">
                        Add Your First Product
                    </a>
                </div>
            `
                : ""
            }
        `;
  } catch (error) {
    console.error("Error loading products:", error);
    notyf.error("Failed to load products");
  }
}

async function loadCategoriesView() {
  if (!shopId) return;

  const dashboardContent = document.getElementById("dashboardContent");

  try {
    const categories = await getShopCategories();

    dashboardContent.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <div>
                    <h2 style="font-size: 1.8rem; font-weight: 700;">Product Categories</h2>
                    <p style="color: var(--text-light);">Manage your product categories</p>
                </div>
                <button style="background: var(--primary-yellow); color: var(--text-dark); padding: 12px 24px; border: none; border-radius: 50px; font-weight: 600; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: var(--transition);" id="showAddCategoryModal">
                    <i class="fas fa-plus"></i> Add Category
                </button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;">
                ${categories
                  .map(
                    (category) => `
                    <div style="background: var(--white); border-radius: 12px; padding: 1.5rem; box-shadow: var(--shadow); border: 1px solid var(--medium-gray); display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="fas fa-${getCategoryIcon(category)}" style="color: var(--primary-yellow); font-size: 1.5rem;"></i>
                            <h4 style="font-weight: 600;">${category}</h4>
                        </div>
                        <button onclick="window.deleteCategory('${category}')" style="background: none; border: none; cursor: pointer; color: var(--text-light); transition: var(--transition);" title="Delete Category">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `,
                  )
                  .join("")}
            </div>
            
            ${
              categories.length === 0
                ? `
                <div class="empty-state">
                    <i class="fas fa-tags"></i>
                    <h3>No categories yet</h3>
                    <p>Create categories to organize your products</p>
                    <button style="background: var(--primary-yellow); color: var(--text-dark); padding: 12px 24px; border: none; border-radius: 50px; font-weight: 600; margin-top: 16px; cursor: pointer;" id="showAddCategoryModalEmpty">
                        Create First Category
                    </button>
                </div>
            `
                : ""
            }
        `;

    document
      .getElementById("showAddCategoryModal")
      .addEventListener("click", () => {
        document.getElementById("categoryModal").classList.add("show");
      });

    if (document.getElementById("showAddCategoryModalEmpty")) {
      document
        .getElementById("showAddCategoryModalEmpty")
        .addEventListener("click", () => {
          document.getElementById("categoryModal").classList.add("show");
        });
    }
  } catch (error) {
    console.error("Error loading categories:", error);
    notyf.error("Failed to load categories");
  }
}

async function getShopCategories() {
  if (!shopId) return [];

  try {
    const shopDoc = await getDoc(doc(db, "shops", shopId));
    if (shopDoc.exists()) {
      return shopDoc.data().categoryList || [];
    }
    return [];
  } catch (error) {
    console.error("Error getting categories:", error);
    return [];
  }
}

function getCategoryIcon(category) {
  const icons = {
    Pizza: "pizza-slice",
    Burger: "hamburger",
    Drinks: "coffee",
    Desserts: "ice-cream",
    Chinese: "dragon",
    BBQ: "fire",
    Seafood: "fish",
    Vegetarian: "carrot",
    "Fast Food": "hamburger",
    Biryani: "rice",
    Bread: "bread-slice",
    Pasta: "wheat-alt",
    Salad: "salad",
    Breakfast: "egg",
  };
  return icons[category] || "tag";
}

async function addCategory(categoryName) {
  if (!shopId || !categoryName.trim()) return;

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

    document.getElementById("categoryModal").classList.remove("show");
    document.getElementById("addCategoryForm").reset();

    loadCategoriesView();
  } catch (error) {
    notyf.error("Failed to add category: " + error.message);
  }
}

async function deleteCategory(categoryName) {
  if (!shopId || !categoryName) return;

  if (
    !confirm(`Are you sure you want to delete the category "${categoryName}"?`)
  ) {
    return;
  }

  try {
    const loading = showLoading(notyf, "Deleting category...");

    const shopRef = doc(db, "shops", shopId);
    const shopDoc = await getDoc(shopRef);

    const currentCategories = shopDoc.data().categoryList || [];

    await updateDoc(shopRef, {
      categoryList: currentCategories.filter((c) => c !== categoryName),
    });

    notyf.dismiss(loading);
    notyf.success("Category deleted successfully");

    loadCategoriesView();
  } catch (error) {
    notyf.error("Failed to delete category: " + error.message);
  }
}

async function updateOrderStatusInternal(orderId, status) {
  try {
    const loading = showLoading(notyf, `Updating order status...`);

    await updateDoc(doc(db, "orders", orderId), {
      status: status,
      updatedAt: serverTimestamp(),
    });

    notyf.dismiss(loading);
    notyf.success(
      `Order ${status === "completed" ? "accepted" : "rejected"} successfully`,
    );

    if (document.querySelector(".filter-btn.active")) {
      const activeFilter =
        document.querySelector(".filter-btn.active").dataset.filter;
      loadOrdersView(activeFilter);
    } else {
      loadDashboardData();
    }
  } catch (error) {
    notyf.error("Failed to update order: " + error.message);
  }
}

async function deleteProduct(productId) {
  if (!confirm("Are you sure you want to delete this product?")) {
    return;
  }

  try {
    const loading = showLoading(notyf, "Deleting product...");

    await deleteDoc(doc(db, "items", productId));

    notyf.dismiss(loading);
    notyf.success("Product deleted successfully");

    loadProductsView();
    loadDashboardData();
  } catch (error) {
    notyf.error("Failed to delete product: " + error.message);
  }
}

function attachFilterListeners() {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const filter = e.target.dataset.filter;
      currentFilter = filter;

      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");

      loadOrdersView(filter);
    });
  });
}

function setupRealtimeListeners() {
  if (!shopId) return;

  const ordersQuery = query(
    collection(db, "orders"),
    where("shopIds", "array-contains", shopId),
    where("status", "==", "pending"),
    orderBy("createdAt", "desc"),
    limit(10),
  );

  onSnapshot(ordersQuery, (snapshot) => {
    const pendingCount = snapshot.size;
    updatePendingBadges(pendingCount);

    if (pendingCount > 0) {
      notyf.success(
        `${pendingCount} new pending order${pendingCount > 1 ? "s" : ""}!`,
      );
    }
  });
}

window.viewProof = (proofUrl) => {
  const modal = document.getElementById("proofModal");
  const proofImage = document.getElementById("proofImage");
  proofImage.src = proofUrl;
  modal.classList.add("show");
};

window.viewOrderDetails = async (orderId) => {
  try {
    const orderDoc = await getDoc(doc(db, "orders", orderId));

    if (!orderDoc.exists()) {
      notyf.error("Order not found");
      return;
    }

    const order = { id: orderDoc.id, ...orderDoc.data() };
    const modal = document.getElementById("orderModal");
    const modalBody = document.getElementById("orderModalBody");

    // Filter items for this shop
    const shopItems =
      order.items?.filter((item) => item.shopId === shopId) || [];

    let itemsHtml = "";
    if (shopItems.length > 0) {
      itemsHtml = `
                <div style="margin: 20px 0;">
                    <h4 style="margin-bottom: 12px;">Order Items from Your Shop</h4>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${shopItems
                          .map(
                            (item) => `
                            <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--light-gray); border-radius: 8px;">
                                <span><strong>${item.name || "Item"}</strong> x${item.quantity || 1}</span>
                                <span>PKR ${(item.price || 0).toLocaleString()}</span>
                            </div>
                        `,
                          )
                          .join("")}
                    </div>
                </div>
            `;
    }

    modalBody.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h4 style="color: var(--info);">Order #${order.id.slice(-6)}</h4>
                    <span class="status-badge ${order.status || "pending"}">
                        <i class="fas fa-${order.status === "completed" ? "check-circle" : order.status === "cancelled" ? "ban" : "clock"}"></i>
                        ${order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : "Pending"}
                    </span>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; padding: 20px; background: var(--light-gray); border-radius: 12px;">
                    <div>
                        <strong>Customer Information</strong>
                        <p style="margin-top: 8px;">${order.customerName || "N/A"}</p>
                        <p>${order.customerPhone || "N/A"}</p>
                        <p>${order.customerEmail || "N/A"}</p>
                    </div>
                    <div>
                        <strong>Shipping Address</strong>
                        <p style="margin-top: 8px;">${order.shippingAddress || "No address provided"}</p>
                        <p style="margin-top: 8px;"><strong>Delivery Time:</strong> ${order.deliveryTime || "ASAP"}</p>
                    </div>
                </div>
                
                ${itemsHtml}
                
                <div style="display: flex; flex-direction: column; gap: 12px; padding: 20px; background: var(--light-gray); border-radius: 12px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>Subtotal (Your Items):</span>
                        <span>PKR ${shopItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0).toLocaleString()}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-weight: 700; color: var(--success);">
                        <span>Total:</span>
                        <span>PKR ${(order.total || 0).toLocaleString()}</span>
                    </div>
                </div>
                
                <div style="display: flex; gap: 16px; justify-content: flex-end; margin-top: 16px;">
                    ${
                      order.status === "pending"
                        ? `
                        <button class="btn-primary" onclick="window.updateOrderStatus('${order.id}', 'completed'); document.getElementById('orderModal').classList.remove('show');">
                            <i class="fas fa-check"></i> Accept Order
                        </button>
                        <button class="btn-secondary" onclick="window.updateOrderStatus('${order.id}', 'cancelled'); document.getElementById('orderModal').classList.remove('show');" style="background: var(--danger); color: white;">
                            <i class="fas fa-times"></i> Reject Order
                        </button>
                    `
                        : ""
                    }
                    <button class="btn-secondary close-modal">Close</button>
                </div>
            </div>
        `;

    modal.classList.add("show");

    modal.querySelector(".close-modal").addEventListener("click", () => {
      modal.classList.remove("show");
    });
  } catch (error) {
    console.error("Error loading order details:", error);
    notyf.error("Failed to load order details");
  }
};

window.updateOrderStatus = async (orderId, status) => {
  await updateOrderStatusInternal(orderId, status);
};

window.editProduct = (productId) => {
  window.location.href = `/upload?id=${productId}`;
};

window.deleteProduct = async (productId) => {
  await deleteProduct(productId);
};

window.deleteCategory = async (categoryName) => {
  await deleteCategory(categoryName);
};

document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.querySelector(".menu-toggle");
  const sidebar = document.querySelector(".vendor-sidebar");
  const closeSidebar = document.querySelector(".close-sidebar");
  const themeSwitch = document.getElementById("theme-switch");
  const body = document.body;
  const logoutBtn = document.getElementById("logoutBtn");
  const searchInput = document.getElementById("globalSearch");
  const navItems = document.querySelectorAll(".nav-item[data-page]");
  const addCategoryForm = document.getElementById("addCategoryForm");
  const categoryModal = document.getElementById("categoryModal");

  const savedTheme = localStorage.getItem("vendorTheme");
  if (savedTheme === "dark") {
    body.classList.add("dark-theme");
    themeSwitch.checked = true;
  }

  themeSwitch.addEventListener("change", function () {
    if (this.checked) {
      body.classList.add("dark-theme");
      localStorage.setItem("vendorTheme", "dark");
    } else {
      body.classList.remove("dark-theme");
      localStorage.setItem("vendorTheme", "light");
    }
  });

  menuToggle.addEventListener("click", () => {
    sidebar.classList.add("active");
  });

  closeSidebar.addEventListener("click", () => {
    sidebar.classList.remove("active");
  });

  navItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();

      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");

      const page = item.dataset.page;

      if (page === "dashboard") {
        loadDashboardData();
      } else if (page === "orders") {
        loadOrdersView("all");
      } else if (page === "products") {
        loadProductsView();
      } else if (page === "categories") {
        loadCategoriesView();
      } else if (page === "settings") {
        window.location.href = "/vendor/shop-settings";
      }
    });
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      const loading = showLoading(notyf, "Logging out...");
      await auth.signOut();
      notyf.dismiss(loading);
      notyf.success("Logged out successfully");
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    } catch (error) {
      notyf.error("Logout failed: " + error.message);
    }
  });

  searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value.toLowerCase();
  });

  document.querySelectorAll(".close-modal").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".modal").forEach((modal) => {
        modal.classList.remove("show");
      });
    });
  });

  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) {
      e.target.classList.remove("show");
    }
  });

  addCategoryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const categoryName = document.getElementById("categoryName").value.trim();
    await addCategory(categoryName);
  });
});
