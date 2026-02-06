import {
  db,
  auth,
  onAuthStateChanged,
  collection,
  getDocs,
  getDoc,
  updateDoc,
  doc,
} from "../Firebase/config.js";

import notyf from "../Notyf/notyf.js";
import showLoading from "../Notyf/loader.js";
import approveSuccess from "../api/Admin-Approve-Success/approveSuccess.api.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    notyf.error("Please login first");
    setTimeout(() => {
      window.location.href = "/login";
    }, 1500);
    return;
  }

  const snap = await getDoc(doc(db, "users", user.uid));
  const data = snap.data();

  if (data.userRole !== "admin") {
    notyf.error("You Are Not Admin");
    setTimeout(() => {
      window.location.href = "/login";
    }, 1500);
    return;
  }

  const usersList = document.getElementById("users");
  const loadingSpinner = document.getElementById("loadingSpinner");
  const noUsersMessage = document.getElementById("noUsersMessage");
  const totalUsers = document.getElementById("totalUsers");
  const verifiedCount = document.getElementById("verifiedCount");
  const unverifiedCount = document.getElementById("unverifiedCount");
  const searchInput = document.getElementById("searchInput");
  const filterSelect = document.getElementById("filterSelect");
  const hamburger = document.querySelector(".hamburger");
  const sidebar = document.querySelector(".sidebar");
  const closeSidebar = document.querySelector(".close-sidebar");
  const themeSwitch = document.getElementById("theme-switch");
  const body = document.body;
  const adminName = document.getElementById("adminName");
  const logoutBtn = document.getElementById("logoutBtn");
  const exportBtn = document.querySelector(".btn-export");
  const notificationBell = document.querySelector(".notification");

  let allUsers = [];
  let filteredUsers = [];

  const savedTheme = localStorage.getItem("adminTheme");
  if (savedTheme === "dark") {
    body.classList.add("dark-theme");
    themeSwitch.checked = true;
  }

  adminName.textContent = user.displayName || "Admin User";

  themeSwitch.addEventListener("change", function () {
    if (this.checked) {
      body.classList.add("dark-theme");
      localStorage.setItem("adminTheme", "dark");
    } else {
      body.classList.remove("dark-theme");
      localStorage.setItem("adminTheme", "light");
    }
  });

  hamburger.addEventListener("click", function () {
    sidebar.classList.add("active");
  });

  closeSidebar.addEventListener("click", function () {
    sidebar.classList.remove("active");
  });

  document.addEventListener("click", function (event) {
    if (
      !sidebar.contains(event.target) &&
      !hamburger.contains(event.target) &&
      sidebar.classList.contains("active")
    ) {
      sidebar.classList.remove("active");
    }
  });

  notificationBell.addEventListener("click", function () {
    notyf.success("You have some new notifications");
    this.querySelector(".notification-badge").style.display = "none";
  });

  usersList.innerHTML = "";
  loadingSpinner.style.display = "";
  noUsersMessage.style.display = "none";

  const loading = showLoading(notyf, "Loading users...");

  try {
    const snap = await getDocs(collection(db, "users"));

    notyf.dismiss(loading);

    if (snap.empty) {
      noUsersMessage.style.display = "";
      notyf.error("No users found in database");
      return;
    }

    let verified = 0;
    let unverified = 0;

    snap.forEach((u) => {
      const data = u.data();

      if(data.userRole === "admin" || data.userEmail === "admin@foodiehaven.app" || data.userName === "Admin") {
        return;
      }

      if (data.isVerified) {
        verified++;
      } else {
        unverified++;
      }

      allUsers.push({
        id: u.id,
        ...data,
      });
    });

    totalUsers.textContent = allUsers.length;
    verifiedCount.textContent = verified;
    unverifiedCount.textContent = unverified;

    notyf.success(`Loaded ${allUsers.length} users successfully`);

    filteredUsers = [...allUsers];
    renderUsers();
  } catch (error) {
    notyf.dismiss(loading);
    notyf.error("Failed to load users: " + error.message);
  }

  searchInput.addEventListener("input", () => {
    filterUsers();
  });

  filterSelect.addEventListener("change", () => {
    filterUsers();
  });

  function filterUsers() {
    const searchTerm = searchInput.value.toLowerCase();
    const filterValue = filterSelect.value;

    filteredUsers = allUsers.filter((user) => {
      const matchesSearch =
        user.userName?.toLowerCase().includes(searchTerm) ||
        user.userEmail?.toLowerCase().includes(searchTerm);

      let matchesFilter = true;
      if (filterValue === "verified") {
        matchesFilter = user.isVerified === true;
      } else if (filterValue === "unverified") {
        matchesFilter = user.isVerified === false;
      }

      return matchesSearch && matchesFilter;
    });

    renderUsers();
  }

  async function renderUsers() {
    usersList.innerHTML = "";

    if (filteredUsers.length === 0) {
      noUsersMessage.style.display = "";
      return;
    }

    noUsersMessage.style.display = "none";

    filteredUsers.forEach((user) => {

      if(user.userEmail === "admin@foodiehaven.app" || user.userName === "Admin") {
        return;
      }

      const row = document.createElement("tr");

      const nameCell = document.createElement("td");
      nameCell.className = "user-name";
      nameCell.textContent = user.userName || "N/A";

      const emailCell = document.createElement("td");
      emailCell.className = "user-email";
      emailCell.textContent = user.userEmail || "N/A";

      const statusCell = document.createElement("td");
      const statusBadge = document.createElement("span");
      statusBadge.className = `status-badge ${user.isVerified ? "status-verified" : "status-unverified"}`;
      statusBadge.textContent = user.isVerified ? "Verified" : "Unverified";
      statusCell.appendChild(statusBadge);

      const actionCell = document.createElement("td");
      const toggleBtn = document.createElement("button");
      toggleBtn.className = `btn-toggle ${user.isVerified ? "btn-unverify" : "btn-verify"}`;
      toggleBtn.textContent = user.isVerified ? "Unverify" : "Verify";

      toggleBtn.onclick = async () => {
        try {
          const loading = showLoading(notyf, "Updating user status...");

          await updateDoc(doc(db, "users", user.id), {
            isVerified: !user.isVerified,
          });

          if(statusBadge.textContent === "Unverified") {
          const res = await approveSuccess(user.userEmail, user.userName);

          if(res.data.success === false) {
            return;
          }
          }

          notyf.dismiss(loading);

          notyf.success(
            `User ${user.userName} has been ${!user.isVerified ? "verified" : "unverified"}`,
          );

          user.isVerified = !user.isVerified;

          let verified = parseInt(verifiedCount.textContent);
          let unverified = parseInt(unverifiedCount.textContent);

          if (user.isVerified) {
            verified++;
            unverified--;
          } else {
            verified--;
            unverified++;
          }

          verifiedCount.textContent = verified;
          unverifiedCount.textContent = unverified;

          filterUsers();
        } catch (error) {
          notyf.dismiss(loading);
          notyf.error("Failed to update user: " + error.message);
        }
      };

      actionCell.appendChild(toggleBtn);

      row.appendChild(nameCell);
      row.appendChild(emailCell);
      row.appendChild(statusCell);
      row.appendChild(actionCell);

      usersList.appendChild(row);
    });
  }

  logoutBtn.addEventListener("click", async () => {
    try {
      const loading = showLoading(notyf, "Logging out...");
      await auth.signOut();
      notyf.dismiss(loading);
      notyf.success("Logged out successfully");
      setTimeout(() => {
        window.location.href = "/login";
      }, 1000);
    } catch (error) {
      notyf.dismiss(loading);
      notyf.error("Logout failed: " + error.message);
    }
  });

  exportBtn.addEventListener("click", () => {
    if (filteredUsers.length === 0) {
      notyf.error("No users to export");
      return;
    }

    try {
      const csvContent = convertToCSV(filteredUsers);
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `users_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      notyf.success(`Exported ${filteredUsers.length} users successfully`);
    } catch (error) {
      notyf.error("Export failed: " + error.message);
    }
  });

  function convertToCSV(users) {
    const headers = ["Name", "Email", "Status", "User ID"];
    const rows = users.map((user) => [
      `"${user.userName || ""}"`,
      `"${user.userEmail || ""}"`,
      `"${user.isVerified ? "Verified" : "Unverified"}"`,
      `"${user.id}"`,
    ]);

    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  }

  const menuItems = document.querySelectorAll(".menu-item");
  menuItems.forEach((item) => {
    item.addEventListener("click", function (e) {
      if (this.getAttribute("href") === "#") {
        e.preventDefault();

        menuItems.forEach((i) => i.classList.remove("active"));
        this.classList.add("active");

        const section = this.textContent
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "-");
        notyf.info(`Switched to ${this.textContent.trim()}`);

        if (mobileSidebar.classList.contains("active")) {
          mobileSidebar.classList.remove("active");
          document.body.style.overflow = "auto";
        }
      }
    });
  });
});
