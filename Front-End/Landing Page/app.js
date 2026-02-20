import { auth, db, getDoc, doc, signOut, onAuthStateChanged } from "../Firebase/config.js";
import notyf from "../Notyf/notyf.js";
import emailHandler from "../helpers/emailHandler.js";

document.addEventListener("DOMContentLoaded", function () {
  const themeSwitch = document.getElementById("theme-switch");
  const body = document.body;
  const hamburger = document.querySelector(".hamburger");
  const mobileSidebar = document.querySelector(".mobile-sidebar");
  const closeSidebar = document.querySelector(".close-sidebar");

  const currentYear = new Date().getFullYear();
  document.getElementById("currentYear").textContent = currentYear

  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "dark") {
    body.classList.add("dark-theme");
    themeSwitch.checked = true;
  }

  themeSwitch.addEventListener("change", function () {
    if (this.checked) {
      body.classList.add("dark-theme");
      localStorage.setItem("theme", "dark");
    } else {
      body.classList.remove("dark-theme");
      localStorage.setItem("theme", "light");
    }
  });

  hamburger.addEventListener("click", function () {
    mobileSidebar.classList.add("active");
    document.body.style.overflow = "hidden";
  });

  closeSidebar.addEventListener("click", function () {
    mobileSidebar.classList.remove("active");
    document.body.style.overflow = "auto";
  });

  document.addEventListener("click", function (event) {
    if (
      !mobileSidebar.contains(event.target) &&
      !hamburger.contains(event.target) &&
      mobileSidebar.classList.contains("active")
    ) {
      mobileSidebar.classList.remove("active");
      document.body.style.overflow = "auto";
    }
  });

  const navLinks = document.querySelectorAll(".nav-link, .sidebar-link");
  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      if (this.getAttribute("href") === "#") {
        e.preventDefault();

        if (mobileSidebar.classList.contains("active")) {
          mobileSidebar.classList.remove("active");
          document.body.style.overflow = "auto";
        }

        const targetId = this.textContent.toLowerCase().replace(" ", "");
        const sections = document.querySelectorAll("section");

        sections.forEach((section) => {
          if (section.id === targetId || section.classList.contains(targetId)) {
            section.scrollIntoView({ behavior: "smooth" });
          }
        });
      }
    });
  });

  const buttons = document.querySelectorAll(".btn");
  buttons.forEach((button) => {
    button.addEventListener("mouseenter", function () {
      this.style.transform = "translateY(-2px)";
    });

    button.addEventListener("mouseleave", function () {
      this.style.transform = "translateY(0)";
    });
  });

  const productCards = document.querySelectorAll(
    ".product-card, .feature-card",
  );
  productCards.forEach((card) => {
    card.addEventListener("mouseenter", function () {
      this.style.transform = "translateY(-10px)";
    });

    card.addEventListener("mouseleave", function () {
      this.style.transform = "translateY(0)";
    });
  });

  window.addEventListener("scroll", function () {
    const navbar = document.querySelector(".navbar");
    if (window.scrollY > 100) {
      navbar.style.padding = "0.5rem 0";
      navbar.style.boxShadow = "0 2px 20px var(--shadow)";
    } else {
      navbar.style.padding = "1rem 0";
      navbar.style.boxShadow = "0 2px 20px var(--shadow)";
    }
  });
});


const loginBtn = document.getElementById("login");
const signupBtn = document.getElementById("signup");

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const snap = await getDoc(doc(db, "users", user.uid));
    const data = snap.data();

    signupBtn.textContent = "Logout";
    signupBtn.onclick = async () => {
      await signOut(auth);
    };

    if (data.userRole === "vendor") {
      loginBtn.textContent = "Dashboard";
      loginBtn.onclick = () => window.location.href = "/vendor";
      return;
    }

    if (data.userRole === "user") {
      loginBtn.textContent = "Dashboard";
      loginBtn.onclick = () => window.location.href = "/shop";
      return;
    }

    if (data.userRole === "admin") {
      loginBtn.textContent = "Admin Panel";
      loginBtn.onclick = () => window.location.href = "/admin";
      return;
    }
  }

  loginBtn.textContent = "Login";
  signupBtn.textContent = "Signup";

  loginBtn.onclick = () => window.location.href = "/account-type";
  signupBtn.onclick = () => window.location.href = "/account-type";
});

const subscribeEmail = async () => {
  const email = document.getElementById("email").value;

  if (!email) {
    notyf.error("Please enter your email address.");
    return;
  }

  if (!emailHandler(email)) {
    notyf.error("Please enter a valid email address.");
    return;
  }
  notyf.success("Thank you for subscribing!");
}

const subscribeBtn = document.getElementById("subscribeBtn");
subscribeBtn.addEventListener("click", subscribeEmail);
