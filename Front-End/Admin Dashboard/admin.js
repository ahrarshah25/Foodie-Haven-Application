import {
  db,
  auth,
  onAuthStateChanged,
  collection,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "../Firebase/config.js";

import notyf from "../Notyf/notyf.js";
import showLoading from "../Notyf/loader.js";
import approveSuccess from "../api/Admin-Approve-Success/approveSuccess.api.js";

const SECTION_USERS = "users";
const SECTION_PRODUCTS = "products";
const SECTION_ANALYTICS = "analytics";
const SECTION_SETTINGS = "settings";

const SECTION_META = {
  [SECTION_USERS]: {
    title: "User Management",
    subtitle: "Manage and verify vendor accounts",
    cardTitle: "Vendor List",
    searchPlaceholder: "Search vendors...",
  },
  [SECTION_PRODUCTS]: {
    title: "Product Management",
    subtitle: "Monitor and control marketplace products",
    cardTitle: "Product Inventory",
    searchPlaceholder: "Search products or vendors...",
  },
  [SECTION_ANALYTICS]: {
    title: "Analytics",
    subtitle: "Track real platform performance metrics",
    cardTitle: "Performance Snapshot",
    searchPlaceholder: "Search disabled in analytics",
  },
  [SECTION_SETTINGS]: {
    title: "Settings",
    subtitle: "Configure admin dashboard behavior",
    cardTitle: "Admin Preferences",
    searchPlaceholder: "Search disabled in settings",
  },
};

const ui = {};

const state = {
  currentSection: SECTION_USERS,
  allUsers: [],
  vendors: [],
  products: [],
  orders: [],
  shopsMap: new Map(),
  usersMap: new Map(),
};

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return null;
};

const formatPercent = (value) => {
  if (!Number.isFinite(value)) return "0%";
  const rounded = Number(value.toFixed(1));
  return `${rounded >= 0 ? "+" : ""}${rounded}%`;
};

const calculateMonthlyGrowth = (dates) => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const previousDate = new Date(currentYear, currentMonth - 1, 1);
  const previousMonth = previousDate.getMonth();
  const previousYear = previousDate.getFullYear();

  let currentCount = 0;
  let previousCount = 0;

  dates.forEach((dateValue) => {
    const date = toDate(dateValue);
    if (!date || Number.isNaN(date.getTime())) return;

    if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
      currentCount += 1;
    } else if (
      date.getMonth() === previousMonth &&
      date.getFullYear() === previousYear
    ) {
      previousCount += 1;
    }
  });

  if (previousCount === 0) {
    return currentCount > 0 ? 100 : 0;
  }

  return ((currentCount - previousCount) / previousCount) * 100;
};

const calculateRevenueGrowth = (orders) => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const previousDate = new Date(currentYear, currentMonth - 1, 1);
  const previousMonth = previousDate.getMonth();
  const previousYear = previousDate.getFullYear();

  let currentRevenue = 0;
  let previousRevenue = 0;

  orders.forEach((order) => {
    const createdAt = toDate(order.createdAt);
    if (!createdAt || order.status !== "completed") return;

    if (
      createdAt.getMonth() === currentMonth &&
      createdAt.getFullYear() === currentYear
    ) {
      currentRevenue += Number(order.total || 0);
    } else if (
      createdAt.getMonth() === previousMonth &&
      createdAt.getFullYear() === previousYear
    ) {
      previousRevenue += Number(order.total || 0);
    }
  });

  if (previousRevenue === 0) {
    return currentRevenue > 0 ? 100 : 0;
  }

  return ((currentRevenue - previousRevenue) / previousRevenue) * 100;
};

const updateTopStats = () => {
  let first = 0;
  let second = 0;
  let third = 0;
  let growth = 0;

  if (state.currentSection === SECTION_USERS) {
    first = state.vendors.length;
    second = state.vendors.filter((u) => u.isVerified).length;
    third = state.vendors.filter((u) => !u.isVerified).length;
    growth = calculateMonthlyGrowth(state.vendors.map((u) => u.createdAt));

    document.querySelector(".stats-grid .stat-card:nth-child(1) p").textContent =
      "Total Vendors";
    document.querySelector(".stats-grid .stat-card:nth-child(2) p").textContent =
      "Verified Vendors";
    document.querySelector(".stats-grid .stat-card:nth-child(3) p").textContent =
      "Unverified Vendors";
  }

  if (state.currentSection === SECTION_PRODUCTS) {
    first = state.products.length;
    second = state.products.filter((p) => p.isAvailable !== false).length;
    third = state.products.filter((p) => p.isAvailable === false).length;
    growth = calculateMonthlyGrowth(state.products.map((p) => p.createdAt));

    document.querySelector(".stats-grid .stat-card:nth-child(1) p").textContent =
      "Total Products";
    document.querySelector(".stats-grid .stat-card:nth-child(2) p").textContent =
      "Active Products";
    document.querySelector(".stats-grid .stat-card:nth-child(3) p").textContent =
      "Inactive Products";
  }

  if (state.currentSection === SECTION_ANALYTICS) {
    const completedOrders = state.orders.filter((o) => o.status === "completed");
    const totalRevenue = completedOrders.reduce(
      (sum, o) => sum + Number(o.total || 0),
      0,
    );

    first = Math.round(totalRevenue);
    second = state.orders.length;
    third = state.orders.length
      ? Math.round(totalRevenue / Math.max(1, completedOrders.length))
      : 0;
    growth = calculateRevenueGrowth(state.orders);

    document.querySelector(".stats-grid .stat-card:nth-child(1) p").textContent =
      "Total Revenue (PKR)";
    document.querySelector(".stats-grid .stat-card:nth-child(2) p").textContent =
      "Total Orders";
    document.querySelector(".stats-grid .stat-card:nth-child(3) p").textContent =
      "Avg Order Value";
  }

  if (state.currentSection === SECTION_SETTINGS) {
    first = state.vendors.length;
    second = state.products.length;
    third = state.orders.length;
    growth = calculateMonthlyGrowth(state.allUsers.map((u) => u.createdAt));

    document.querySelector(".stats-grid .stat-card:nth-child(1) p").textContent =
      "Vendors";
    document.querySelector(".stats-grid .stat-card:nth-child(2) p").textContent =
      "Products";
    document.querySelector(".stats-grid .stat-card:nth-child(3) p").textContent =
      "Orders";
  }

  ui.totalUsers.textContent = String(first);
  ui.verifiedCount.textContent = String(second);
  ui.unverifiedCount.textContent = String(third);
  ui.monthlyGrowth.textContent = formatPercent(growth);
};

const setFilterOptions = () => {
  if (state.currentSection === SECTION_USERS) {
    ui.filterSelect.innerHTML = `
      <option value="all">All Vendors</option>
      <option value="verified">Verified Only</option>
      <option value="unverified">Unverified Only</option>
    `;
    ui.filterSelect.parentElement.style.display = "block";
    ui.searchInput.disabled = false;
    return;
  }

  if (state.currentSection === SECTION_PRODUCTS) {
    ui.filterSelect.innerHTML = `
      <option value="all">All Products</option>
      <option value="active">Active Only</option>
      <option value="inactive">Inactive Only</option>
    `;
    ui.filterSelect.parentElement.style.display = "block";
    ui.searchInput.disabled = false;
    return;
  }

  ui.filterSelect.parentElement.style.display = "none";
  ui.searchInput.disabled = true;
};

const renderUsersTable = () => {
  const searchTerm = ui.searchInput.value.toLowerCase();
  const filter = ui.filterSelect.value;

  const filtered = state.vendors.filter((vendor) => {
    const matchesSearch =
      vendor.userName?.toLowerCase().includes(searchTerm) ||
      vendor.userEmail?.toLowerCase().includes(searchTerm);

    if (!matchesSearch) return false;

    if (filter === "verified") return vendor.isVerified === true;
    if (filter === "unverified") return vendor.isVerified === false;
    return true;
  });

  ui.tableHead.innerHTML = `
    <tr>
      <th>Name</th>
      <th>Email</th>
      <th>Status</th>
      <th>Joined</th>
      <th>Actions</th>
    </tr>
  `;

  if (!filtered.length) {
    ui.tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-cell">
          <i class="fas fa-users-slash"></i>
          <span>No vendors found</span>
        </td>
      </tr>
    `;
    return;
  }

  ui.tableBody.innerHTML = filtered
    .map((vendor) => {
      const joinedDate = toDate(vendor.createdAt);
      return `
        <tr>
          <td class="user-name">${vendor.userName || "N/A"}</td>
          <td class="user-email">${vendor.userEmail || "N/A"}</td>
          <td>
            <span class="status-badge ${vendor.isVerified ? "status-verified" : "status-unverified"}">
              ${vendor.isVerified ? "Verified" : "Unverified"}
            </span>
          </td>
          <td>${joinedDate ? joinedDate.toLocaleDateString("en-PK") : "N/A"}</td>
          <td>
            <button class="btn-toggle ${vendor.isVerified ? "btn-unverify" : "btn-verify"}" data-action="toggle-vendor" data-id="${vendor.id}" data-verified="${vendor.isVerified ? "1" : "0"}">
              ${vendor.isVerified ? "Unverify" : "Verify"}
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
};

const renderProductsTable = () => {
  const searchTerm = ui.searchInput.value.toLowerCase();
  const filter = ui.filterSelect.value;

  const filtered = state.products.filter((product) => {
    const shop = state.shopsMap.get(product.shopId) || {};
    const vendor = state.usersMap.get(shop.vendorId) || {};

    const matchesSearch =
      product.name?.toLowerCase().includes(searchTerm) ||
      shop.shopName?.toLowerCase().includes(searchTerm) ||
      vendor.userName?.toLowerCase().includes(searchTerm);

    if (!matchesSearch) return false;

    if (filter === "active") return product.isAvailable !== false;
    if (filter === "inactive") return product.isAvailable === false;
    return true;
  });

  ui.tableHead.innerHTML = `
    <tr>
      <th>Product</th>
      <th>Vendor</th>
      <th>Shop</th>
      <th>Price</th>
      <th>Status</th>
      <th>Created</th>
      <th>Actions</th>
    </tr>
  `;

  if (!filtered.length) {
    ui.tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">
          <i class="fas fa-box-open"></i>
          <span>No products found</span>
        </td>
      </tr>
    `;
    return;
  }

  ui.tableBody.innerHTML = filtered
    .map((product) => {
      const shop = state.shopsMap.get(product.shopId) || {};
      const vendor = state.usersMap.get(shop.vendorId) || {};
      const createdDate = toDate(product.createdAt);
      const isActive = product.isAvailable !== false;

      return `
        <tr>
          <td class="user-name">${product.name || "N/A"}</td>
          <td class="user-email">${vendor.userName || "N/A"}</td>
          <td>${shop.shopName || "N/A"}</td>
          <td>PKR ${Number(product.discountPrice || product.price || 0).toLocaleString()}</td>
          <td>
            <span class="status-badge ${isActive ? "status-verified" : "status-unverified"}">
              ${isActive ? "Active" : "Inactive"}
            </span>
          </td>
          <td>${createdDate ? createdDate.toLocaleDateString("en-PK") : "N/A"}</td>
          <td>
            <button class="btn-toggle ${isActive ? "btn-unverify" : "btn-verify"}" data-action="toggle-product" data-id="${product.id}" data-active="${isActive ? "1" : "0"}">
              ${isActive ? "Deactivate" : "Activate"}
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
};

const renderAnalytics = () => {
  const completedOrders = state.orders.filter((o) => o.status === "completed");
  const totalRevenue = completedOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const totalOrders = state.orders.length;
  const avgOrderValue = completedOrders.length
    ? totalRevenue / completedOrders.length
    : 0;

  const vendorGrowth = calculateMonthlyGrowth(state.vendors.map((v) => v.createdAt));
  const productGrowth = calculateMonthlyGrowth(state.products.map((p) => p.createdAt));
  const revenueGrowth = calculateRevenueGrowth(state.orders);

  ui.tableHead.innerHTML = `<tr><th>Analytics Overview</th></tr>`;
  ui.tableBody.innerHTML = `
    <tr>
      <td>
        <div class="analytics-grid">
          <div class="analytics-item">
            <h4>Total Revenue</h4>
            <p>PKR ${Math.round(totalRevenue).toLocaleString()}</p>
            <small>${formatPercent(revenueGrowth)} vs last month</small>
          </div>
          <div class="analytics-item">
            <h4>Total Orders</h4>
            <p>${totalOrders}</p>
            <small>${state.orders.filter((o) => o.status === "pending").length} pending</small>
          </div>
          <div class="analytics-item">
            <h4>Average Order Value</h4>
            <p>PKR ${Math.round(avgOrderValue).toLocaleString()}</p>
            <small>Completed orders only</small>
          </div>
          <div class="analytics-item">
            <h4>Vendor Growth</h4>
            <p>${formatPercent(vendorGrowth)}</p>
            <small>Monthly vendor onboarding</small>
          </div>
          <div class="analytics-item">
            <h4>Product Growth</h4>
            <p>${formatPercent(productGrowth)}</p>
            <small>Monthly product additions</small>
          </div>
          <div class="analytics-item">
            <h4>Conversion Snapshot</h4>
            <p>${totalOrders ? ((completedOrders.length / totalOrders) * 100).toFixed(1) : "0.0"}%</p>
            <small>Completed / total orders</small>
          </div>
        </div>
      </td>
    </tr>
  `;
};

const renderSettings = () => {
  const prefs = {
    autoRefresh: localStorage.getItem("adminAutoRefresh") === "1",
    emailNotifications: localStorage.getItem("adminEmailNotifications") !== "0",
    compactMode: localStorage.getItem("adminCompactMode") === "1",
  };

  ui.tableHead.innerHTML = `<tr><th>Dashboard Settings</th></tr>`;
  ui.tableBody.innerHTML = `
    <tr>
      <td>
        <form id="adminSettingsForm" class="admin-settings-form">
          <label class="settings-row">
            <span>Enable Auto Refresh</span>
            <input type="checkbox" id="settingAutoRefresh" ${prefs.autoRefresh ? "checked" : ""} />
          </label>
          <label class="settings-row">
            <span>Email Notifications</span>
            <input type="checkbox" id="settingEmailNotifications" ${prefs.emailNotifications ? "checked" : ""} />
          </label>
          <label class="settings-row">
            <span>Compact Table Mode</span>
            <input type="checkbox" id="settingCompactMode" ${prefs.compactMode ? "checked" : ""} />
          </label>
          <button type="submit" class="btn-export" style="margin-top: 16px;">
            <i class="fas fa-save"></i>
            Save Settings
          </button>
        </form>
      </td>
    </tr>
  `;

  const settingsForm = document.getElementById("adminSettingsForm");
  settingsForm.addEventListener("submit", (e) => {
    e.preventDefault();

    localStorage.setItem(
      "adminAutoRefresh",
      document.getElementById("settingAutoRefresh").checked ? "1" : "0",
    );
    localStorage.setItem(
      "adminEmailNotifications",
      document.getElementById("settingEmailNotifications").checked ? "1" : "0",
    );
    localStorage.setItem(
      "adminCompactMode",
      document.getElementById("settingCompactMode").checked ? "1" : "0",
    );

    document.body.classList.toggle(
      "compact-mode",
      document.getElementById("settingCompactMode").checked,
    );

    notyf.success("Settings saved successfully");
  });
};

const renderSection = () => {
  const meta = SECTION_META[state.currentSection];
  ui.pageTitle.textContent = meta.title;
  ui.pageSubtitle.textContent = meta.subtitle;
  ui.cardTitle.textContent = meta.cardTitle;
  ui.searchInput.placeholder = meta.searchPlaceholder;

  setFilterOptions();
  updateTopStats();

  if (state.currentSection === SECTION_USERS) renderUsersTable();
  if (state.currentSection === SECTION_PRODUCTS) renderProductsTable();
  if (state.currentSection === SECTION_ANALYTICS) renderAnalytics();
  if (state.currentSection === SECTION_SETTINGS) renderSettings();
};

const setActiveMenu = (targetSection) => {
  document.querySelectorAll(".menu-item[data-section]").forEach((item) => {
    item.classList.toggle("active", item.dataset.section === targetSection);
  });
};

const loadData = async () => {
  const [usersSnap, productsSnap, ordersSnap, shopsSnap] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "items")),
    getDocs(collection(db, "orders")),
    getDocs(collection(db, "shops")),
  ]);

  state.allUsers = [];
  state.products = [];
  state.orders = [];
  state.shopsMap.clear();
  state.usersMap.clear();

  usersSnap.forEach((d) => {
    const user = { id: d.id, ...d.data() };
    state.allUsers.push(user);
    state.usersMap.set(user.id, user);
  });

  state.vendors = state.allUsers.filter((u) => u.userRole === "vendor");

  productsSnap.forEach((d) => {
    state.products.push({ id: d.id, ...d.data() });
  });

  ordersSnap.forEach((d) => {
    state.orders.push({ id: d.id, ...d.data() });
  });

  shopsSnap.forEach((d) => {
    state.shopsMap.set(d.id, { id: d.id, ...d.data() });
  });
};

const handleTableActions = async (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;

  if (action === "toggle-vendor") {
    const isVerified = btn.dataset.verified === "1";
    const vendor = state.vendors.find((u) => u.id === id);
    if (!vendor) return;

    const loading = showLoading(notyf, "Updating vendor status...");

    try {
      await updateDoc(doc(db, "users", id), {
        isVerified: !isVerified,
        updatedAt: serverTimestamp(),
      });

      if (!isVerified) {
        const res = await approveSuccess(vendor.userEmail, vendor.userName);
        if (res?.data?.success === false) {
          notyf.error("Vendor approved but email could not be sent");
        }
      }

      const target = state.vendors.find((u) => u.id === id);
      if (target) target.isVerified = !isVerified;

      notyf.dismiss(loading);
      notyf.success(`Vendor ${!isVerified ? "verified" : "unverified"} successfully`);
      renderSection();
    } catch (error) {
      notyf.dismiss(loading);
      notyf.error("Failed to update vendor: " + error.message);
    }
    return;
  }

  if (action === "toggle-product") {
    const isActive = btn.dataset.active === "1";
    const loading = showLoading(notyf, "Updating product status...");

    try {
      await updateDoc(doc(db, "items", id), {
        isAvailable: !isActive,
        updatedAt: serverTimestamp(),
      });

      const target = state.products.find((p) => p.id === id);
      if (target) target.isAvailable = !isActive;

      notyf.dismiss(loading);
      notyf.success(`Product ${!isActive ? "activated" : "deactivated"} successfully`);
      renderSection();
    } catch (error) {
      notyf.dismiss(loading);
      notyf.error("Failed to update product: " + error.message);
    }
  }
};

const exportCurrentTable = () => {
  if (![SECTION_USERS, SECTION_PRODUCTS].includes(state.currentSection)) {
    notyf.info("Export is available for Users and Products only");
    return;
  }

  const rows = [];
  if (state.currentSection === SECTION_USERS) {
    state.vendors.forEach((v) => {
      rows.push([
        v.userName || "",
        v.userEmail || "",
        v.isVerified ? "Verified" : "Unverified",
        v.id,
      ]);
    });
  }

  if (state.currentSection === SECTION_PRODUCTS) {
    state.products.forEach((p) => {
      const shop = state.shopsMap.get(p.shopId) || {};
      const vendor = state.usersMap.get(shop.vendorId) || {};
      rows.push([
        p.name || "",
        vendor.userName || "",
        shop.shopName || "",
        String(p.discountPrice || p.price || 0),
        p.isAvailable === false ? "Inactive" : "Active",
      ]);
    });
  }

  if (!rows.length) {
    notyf.error("No data available to export");
    return;
  }

  const headers =
    state.currentSection === SECTION_USERS
      ? ["Name", "Email", "Status", "User ID"]
      : ["Product", "Vendor", "Shop", "Price", "Status"];

  const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${state.currentSection}_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);

  notyf.success("Export complete");
};

const bootstrapUI = () => {
  ui.tableBody = document.getElementById("tableBody");
  ui.tableHead = document.getElementById("tableHead");
  ui.totalUsers = document.getElementById("totalUsers");
  ui.verifiedCount = document.getElementById("verifiedCount");
  ui.unverifiedCount = document.getElementById("unverifiedCount");
  ui.monthlyGrowth = document.getElementById("monthlyGrowth");
  ui.searchInput = document.getElementById("searchInput");
  ui.filterSelect = document.getElementById("filterSelect");
  ui.pageTitle = document.getElementById("pageTitle");
  ui.pageSubtitle = document.getElementById("pageSubtitle");
  ui.cardTitle = document.getElementById("cardTitle");
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    notyf.error("Please login first");
    setTimeout(() => {
      window.location.href = "/login";
    }, 1200);
    return;
  }

  const userSnap = await getDoc(doc(db, "users", user.uid));
  if (!userSnap.exists() || userSnap.data().userRole !== "admin") {
    notyf.error("You are not authorized for admin dashboard");
    setTimeout(() => {
      window.location.href = "/login";
    }, 1200);
    return;
  }

  bootstrapUI();

  const body = document.body;
  const themeSwitch = document.getElementById("theme-switch");
  const sidebar = document.querySelector(".sidebar");
  const hamburger = document.querySelector(".hamburger");
  const closeSidebar = document.querySelector(".close-sidebar");
  const notificationBell = document.querySelector(".notification");
  const logoutBtn = document.getElementById("logoutBtn");
  const exportBtn = document.querySelector(".btn-export");

  document.getElementById("adminName").textContent = user.displayName || "Admin User";

  const savedTheme = localStorage.getItem("adminTheme");
  if (savedTheme === "dark") {
    body.classList.add("dark-theme");
    themeSwitch.checked = true;
  }

  body.classList.toggle("compact-mode", localStorage.getItem("adminCompactMode") === "1");

  themeSwitch.addEventListener("change", function () {
    body.classList.toggle("dark-theme", this.checked);
    localStorage.setItem("adminTheme", this.checked ? "dark" : "light");
  });

  hamburger.addEventListener("click", () => sidebar.classList.add("active"));
  closeSidebar.addEventListener("click", () => sidebar.classList.remove("active"));
  document.addEventListener("click", (event) => {
    if (
      !sidebar.contains(event.target) &&
      !hamburger.contains(event.target) &&
      sidebar.classList.contains("active")
    ) {
      sidebar.classList.remove("active");
    }
  });

  notificationBell.addEventListener("click", () => {
    notyf.success("Notifications checked");
    const badge = notificationBell.querySelector(".notification-badge");
    if (badge) badge.style.display = "none";
  });

  logoutBtn.addEventListener("click", async () => {
    const loading = showLoading(notyf, "Logging out...");
    try {
      await auth.signOut();
      notyf.dismiss(loading);
      notyf.success("Logged out successfully");
      setTimeout(() => {
        window.location.href = "/login";
      }, 800);
    } catch (error) {
      notyf.dismiss(loading);
      notyf.error("Logout failed: " + error.message);
    }
  });

  exportBtn.addEventListener("click", exportCurrentTable);

  ui.searchInput.addEventListener("input", () => {
    if ([SECTION_USERS, SECTION_PRODUCTS].includes(state.currentSection)) {
      renderSection();
    }
  });

  ui.filterSelect.addEventListener("change", () => {
    if ([SECTION_USERS, SECTION_PRODUCTS].includes(state.currentSection)) {
      renderSection();
    }
  });

  document.querySelectorAll(".menu-item[data-section]").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      state.currentSection = item.dataset.section;
      setActiveMenu(state.currentSection);
      renderSection();
      if (sidebar.classList.contains("active")) {
        sidebar.classList.remove("active");
      }
    });
  });

  ui.tableBody.addEventListener("click", handleTableActions);

  const loading = showLoading(notyf, "Loading admin data...");
  try {
    await loadData();
    setActiveMenu(state.currentSection);
    renderSection();
    notyf.dismiss(loading);
  } catch (error) {
    notyf.dismiss(loading);
    notyf.error("Failed to load dashboard data: " + error.message);
  }
});
