import {
  auth,
  db,
  googleProvider,
  createUserWithEmailAndPassword,
  signInWithPopup,
  doc,
  setDoc,
  getDoc,
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

const VENDOR_APPROVAL_WAIT_MS = 2000;

const redirectToLogin = () => {
  setTimeout(() => {
    window.location.href = "/login";
  }, 1500);
};

const showSignupSuccess = (role) => {
  if (role === "vendor") {
    notyf.success("Account Created Successfully!\nWait For Admin Approval.");
    return;
  }

  notyf.success("Account Created Successfully!");
};

const triggerVendorApprovalRequest = async (userEmail, userName) => {
  try {
    const response = await Promise.race([
      approveSignup(userEmail, userName),
      new Promise((resolve) =>
        setTimeout(() => resolve(null), VENDOR_APPROVAL_WAIT_MS),
      ),
    ]);

    if (!response) {
      notyf.success("Approval request is still processing in background.");
      return;
    }

    if (response.data?.success === false) {
      notyf.error("Approval request is delayed. Please contact support.");
    }
  } catch (error) {
    console.error("Approve request error:", error);
    notyf.error("Approval request is delayed. Please contact support.");
  }
};

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

    firstName.value = "";
    lastName.value = "";
    email.value = "";
    password.value = "";
    confirmPassword.value = "";

    return;
  }

  if (!emailHandler(email.value)) {
    notyf.error(
      "Please Enter Correct Email With Correct Syntax\nFor Examle: name@domain.com.",
    );

    firstName.value = "";
    lastName.value = "";
    email.value = "";
    password.value = "";
    confirmPassword.value = "";

    return;
  }

  if (!passwordHandler(password.value)) {
    notyf.error("Password Should Match With Requirements.");

    firstName.value = "";
    lastName.value = "";
    email.value = "";
    password.value = "";
    confirmPassword.value = "";

    return;
  }

  if (password.value !== confirmPassword.value) {
    notyf.error("Please Enter Same Password In Confirm Password Section.");

    firstName.value = "";
    lastName.value = "";
    email.value = "";
    password.value = "";
    confirmPassword.value = "";

    return;
  }

  const fullName = firstName.value + " " + lastName.value || "";
  const role = localStorage.getItem("role") || "user";

  let loading;
  try {
     loading = showLoading(notyf, "Creating Account...");
    const user = await createUserWithEmailAndPassword(
      auth,
      email.value,
      password.value,
    );

    await setDoc(doc(db, "users", user.user.uid), {
      userName: fullName,
      userEmail: email.value,
      isVerified: false,
      userRole: role || "user",
      createdAt: serverTimestamp(),
    });

    await updateProfile(user.user, {
      displayName: fullName,
    });

    notyf.dismiss(loading);
    showSignupSuccess(role);

    if (role === "vendor") {
      triggerVendorApprovalRequest(email.value, fullName);
    }

    redirectToLogin();
  } catch (error) {
    notyf.dismiss(loading);
    notyf.error(error.message);

    firstName.value = "";
    lastName.value = "";
    email.value = "";
    password.value = "";
    confirmPassword.value = "";
  }
};

const googleLogin = async () => {
  let loading;
  try {
    const role = localStorage.getItem("role");
    loading = showLoading(notyf, "Creating Account...");

    const response = await signInWithPopup(auth, googleProvider);
    const userRef = doc(db, "users", response.user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
  await setDoc(userRef, {
    userName: response.user.displayName,
    userEmail: response.user.email,
    isVerified: false,
    userRole: role || "user",
    createdAt: serverTimestamp(),
  });
}

    notyf.dismiss(loading);
    showSignupSuccess(role);

    if (role === "vendor") {
      triggerVendorApprovalRequest(
        response.user.email,
        response.user.displayName,
      );
    }

    redirectToLogin();
  } catch (error) {
    notyf.dismiss(loading);
    notyf.error(error.message);
  }
};

const githubLogin = async () => {
  let loading;
  try {
    const role = localStorage.getItem("role");
    loading = showLoading(notyf, "Creating Account...");

    const response = await signInWithPopup(auth, githubProvider);
    const userRef = doc(db, "users", response.user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
  await setDoc(userRef, {
    userName: response.user.displayName,
    userEmail: response.user.email,
    isVerified: false,
    userRole: role || "user",
    createdAt: serverTimestamp(),
  });
}

    notyf.dismiss(loading);
    showSignupSuccess(role);

    if (role === "vendor") {
      triggerVendorApprovalRequest(
        response.user.email,
        response.user.displayName,
      );
    }

    redirectToLogin();
  } catch (error) {
    notyf.dismiss(loading);
    notyf.error(error.message);
  }
};

const submitBtn = document.getElementById("submitBtn");

submitBtn.addEventListener("click", (e) => {
  e.preventDefault();

  const key = e.keyCode || e.which;

  if (key === 13) {
    userSignup();
    return;
  }

  userSignup();
});

const googleBtn = document.getElementById("googleBtn");

googleBtn.addEventListener("click", (e) => {
  e.preventDefault();
  googleLogin();
});

const githubBtn = document.getElementById("githubBtn");

githubBtn.addEventListener("click", (e) => {
  e.preventDefault();
  githubLogin();
});
