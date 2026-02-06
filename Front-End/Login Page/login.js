import {
  auth,
  db,
  googleProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  githubProvider
} from "../Firebase/config.js";
import emailHandler from "../helpers/emailHandler.js";
import passwordHandler from "../helpers/passwordHanler.js";
import showLoading from "../Notyf/loader.js";
import handleRedirect from "../handlers/handleRedirect.js";
import notyf from "../Notyf/notyf.js";
import checkUser from "../utils/checkUser.js";

document.addEventListener('DOMContentLoaded', () => {
  checkUser();
})

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

const userLogin = async () => {
  let email = document.getElementById("email");
  let password = document.getElementById("password");

  if (!email.value || !password.value) {
    notyf.error("Empty Inputs!");

    email.value = "";
    password.value = "";

    return;
  }

  if (!emailHandler(email.value)) {
    notyf.error(
      "Please Enter Correct Email With Correct Syntax\nFor Examle: name@domain.com.",
    );

    email.value = "";
    password.value = "";

    return;
  }

  if (!passwordHandler(password.value)) {
    notyf.error("Password Should Match With Requirements.");

    email.value = "";
    password.value = "";

    return;
  }

  try {
    var loading = showLoading(notyf, "Authenticating Account...");

    const user = await signInWithEmailAndPassword(
      auth,
      email.value,
      password.value,
    );

    handleRedirect(user.user.uid, loading);
  } catch (error) {
    notyf.dismiss(loading);
    notyf.error(error.message);
  }
};

const googleLogin = async () => {
  try {
    const role = localStorage.getItem("role");
    var loading = showLoading(notyf, "Creating Account...");

    const response = await signInWithPopup(auth, googleProvider);
    const userRef = doc(db, "users", response.user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      setDoc(userRef, {
        userName: response.user.displayName,
        userEmail: response.user.email,
        isVerified: false,
        userRole: role || "user",
        createdAt: serverTimestamp(),
      });
     
    }

    if(role === "vendor") {
      const res = await approveRequest(email.value, fullName);

    if(res.data.success === false){
      // console.log(res);
      return;
    }
    }

    await handleRedirect(response.user.uid)

    
    
  } catch (error) {
    notyf.dismiss(loading);
    notyf.error(error.message);
  }
};

const githubLogin = async () => {
  try {
    const role = localStorage.getItem("role");
    var loading = showLoading(notyf, "Creating Account...");

    const response = await signInWithPopup(auth, githubProvider);
    const userRef = doc(db, "users", response.user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      setDoc(userRef, {
        userName: response.user.displayName,
        userEmail: response.user.email,
        isVerified: false,
        userRole: role || "user",
        createdAt: serverTimestamp(),
      });
    }

    if(role === "vendor") {
      const res = await approveRequest(email.value, fullName);

    if(res.data.success === false){
      // console.log(res);
      return;
    }
    }

    await handleRedirect(response.user.uid)
    
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
    userLogin();
    return;
  }

  userLogin();
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
