import {
  auth,
  db,
  googleProvider,
  createUserWithEmailAndPassword,
  signInWithPopup,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  updateProfile,
  serverTimestamp,
  githubProvider,
} from "../Firebase/config.js";

import notyf from "../Notyf/notyf.js";
import emailHandler from "../helpers/emailHandler.js";
import passwordHandler from "../helpers/passwordHanler.js";
import showLoading from "../Notyf/loader.js";
import approveSignup from "../api/Signup-Email/approveRequest.api.js";
import checkUser from "../utils/checkUser.js";

document.addEventListener("DOMContentLoaded", () => {
  checkUser();
});

const togglePassword = document.getElementById("togglePassword");
togglePassword.addEventListener("click", function () {
  const passwordInput = document.getElementById("password");
  const icon = this.querySelector("i");

  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    icon.classList.remove("fa-eye");
    icon.classList.add("fa-eye-slash");
  } else {
    passwordInput.type = "password";
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
  }
});

const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");
toggleConfirmPassword.addEventListener("click", function () {
  const confirmInput = document.getElementById("confirmPassword");
  const icon = this.querySelector("i");

  if (confirmInput.type === "password") {
    confirmInput.type = "text";
    icon.classList.remove("fa-eye");
    icon.classList.add("fa-eye-slash");
  } else {
    confirmInput.type = "password";
    icon.classList.remove("fa-eye-slash");
    icon.classList.add("fa-eye");
  }
});

const userSignup = async () => {
  let firstName = document.getElementById("firstName");
  let lastName = document.getElementById("lastName");
  let email = document.getElementById("email");
  let password = document.getElementById("password");
  let confirmPassword = document.getElementById("confirmPassword");

  if (
    !firstName.value.trim() ||
    !email.value.trim() ||
    !password.value.trim() ||
    !confirmPassword.value.trim()
  ) {
    notyf.error("Empty Inputs!");
    return;
  }

  if (!emailHandler(email.value)) {
    notyf.error("Please Enter Correct Email With Correct Syntax");
    return;
  }

  if (!passwordHandler(password.value)) {
    notyf.error("Password Should Match With Requirements.");
    return;
  }

  if (password.value !== confirmPassword.value) {
    notyf.error("Passwords Do Not Match.");
    return;
  }

  const fullName = `${firstName.value} ${lastName.value}`.trim();
  const role = localStorage.getItem("role") || "user";

  let loading;

  try {
    loading = showLoading(notyf, "Creating Account...");

    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email.value,
      password.value
    );

    await setDoc(doc(db, "users", userCredential.user.uid), {
      userName: fullName,
      userEmail: email.value,
      isVerified: role === "users",
      userRole: role,
      createdAt: serverTimestamp(),
    });

    await updateProfile(userCredential.user, {
      displayName: fullName,
    });

    if (role === "vendor") {
      const res = await approveSignup(email.value, fullName);
      if (!res?.data?.success) {
        notyf.dismiss(loading);
        notyf.error("Failed To Send Approve Request.");
        return;
      }
    }

    notyf.dismiss(loading);

    if (role === "vendor") {
      notyf.success("Account Created Successfully! Wait For Admin Approval.");
    } else {
      notyf.success("Account Created Successfully!");
    }

    setTimeout(() => {
      window.location.href = "/login";
    }, 1500);
  } catch (error) {
    if (loading) notyf.dismiss(loading);
    notyf.error(error.message);
  }
};

const googleLogin = async () => {
  const role = localStorage.getItem("role") || "user";
  let loading;

  try {
    loading = showLoading(notyf, "Creating Account...");

    const response = await signInWithPopup(auth, googleProvider);
    const userRef = doc(db, "users", response.user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await setDoc(userRef, {
        userName: response.user.displayName,
        userEmail: response.user.email,
        isVerified: role === "users",
        userRole: role,
        createdAt: serverTimestamp(),
      });
    }

    if (role === "vendor") {
      const res = await approveSignup(
        response.user.email,
        response.user.displayName
      );

      if (!res?.data?.success) {
        notyf.dismiss(loading);
        notyf.error("Failed To Send Approve Request.");
        return;
      }
    }

    notyf.dismiss(loading);

    if (role === "vendor") {
      notyf.success("Account Created Successfully! Wait For Admin Approval.");
    } else {
      notyf.success("Account Created Successfully!");
    }

    setTimeout(() => {
      window.location.href = "/login";
    }, 1500);
  } catch (error) {
    if (loading) notyf.dismiss(loading);
    notyf.error(error.message);
  }
};

const githubLogin = async () => {
  const role = localStorage.getItem("role") || "user";
  let loading;

  try {
    loading = showLoading(notyf, "Creating Account...");

    const response = await signInWithPopup(auth, githubProvider);
    const userRef = doc(db, "users", response.user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      await setDoc(userRef, {
        userName: response.user.displayName,
        userEmail: response.user.email,
        isVerified: role === "users",
        userRole: role,
        createdAt: serverTimestamp(),
      });
    }

    if (role === "vendor") {
      const res = await approveSignup(
        response.user.email,
        response.user.displayName
      );

      if (!res?.data?.success) {
        notyf.dismiss(loading);
        notyf.error("Failed To Send Approve Request.");
        return;
      }
    }

    notyf.dismiss(loading);

    if (role === "vendor") {
      notyf.success("Account Created Successfully! Wait For Admin Approval.");
    } else {
      notyf.success("Account Created Successfully!");
    }

    setTimeout(() => {
      window.location.href = "/login";
    }, 1500);
  } catch (error) {
    if (loading) notyf.dismiss(loading);
    notyf.error(error.message);
  }
};

document.getElementById("submitBtn").addEventListener("click", (e) => {
  e.preventDefault();
  userSignup();
});

document.getElementById("googleBtn").addEventListener("click", (e) => {
  e.preventDefault();
  googleLogin();
});

document.getElementById("githubBtn").addEventListener("click", (e) => {
  e.preventDefault();
  githubLogin();
});
