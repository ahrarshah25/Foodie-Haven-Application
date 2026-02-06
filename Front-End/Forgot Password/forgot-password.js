import {
  auth,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "../Firebase/config.js";

import passwordHandler from "../helpers/passwordHanler.js";
import notyf from "../Notyf/notyf.js";

document.addEventListener("DOMContentLoaded", function () {
  const newPasswordInput = document.getElementById("newPassword");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const toggleButtons = document.querySelectorAll(".toggle-password");
  const strengthProgress = document.querySelector(".strength-progress");
  const strengthText = document.querySelector(".strength-text strong");
  const requirementItems = document.querySelectorAll(".requirement");
  const resetForm = document.querySelector(".reset-form");

  const params = new URLSearchParams(window.location.search);
  const oobCode = params.get("oobCode");

  if (!oobCode) {
    notyf.error("Invalid or expired link.");
    setTimeout(() => {window.location.href = "/login"}, 1500);
    return;
  }

  let passwordStrength = {
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  };

  toggleButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const input = this.parentElement.querySelector("input");
      const icon = this.querySelector("i");

      if (input.type === "password") {
        input.type = "text";
        icon.classList.remove("fa-eye");
        icon.classList.add("fa-eye-slash");
      } else {
        input.type = "password";
        icon.classList.remove("fa-eye-slash");
        icon.classList.add("fa-eye");
      }
    });
  });

  function updatePasswordStrength(password) {
    const result = passwordHandler(password);

    passwordStrength = result.requirements;

    let strengthValue = 0;
    if (result.strength === "weak") strengthValue = 20;
    if (result.strength === "medium") strengthValue = 60;
    if (result.strength === "strong") strengthValue = 100;

    strengthProgress.style.width = `${strengthValue}%`;

    let color, text;
    switch (result.strength) {
      case "weak":
        color = "#FF4757";
        text = "Weak";
        break;
      case "medium":
        color = "#FF9F43";
        text = "Medium";
        break;
      case "strong":
        color = "#00D26A";
        text = "Strong";
        break;
      default:
        color = "#FF4757";
        text = "Weak";
    }

    strengthProgress.style.backgroundColor = color;
    strengthText.textContent = text;
    strengthText.style.color = color;

    requirementItems.forEach((item) => {
      const text = item.textContent.trim();
      let requirementKey = "";

      if (text.includes("8 characters")) requirementKey = "length";
      else if (text.includes("uppercase")) requirementKey = "uppercase";
      else if (text.includes("lowercase")) requirementKey = "lowercase";
      else if (text.includes("number")) requirementKey = "number";
      else if (text.includes("special")) requirementKey = "special";

      if (requirementKey && passwordStrength[requirementKey]) {
        item.classList.add("met");
        item.querySelector("i").className = "fas fa-check-circle";
      } else {
        item.classList.remove("met");
        if (!item.querySelector("i").classList.contains("fa-check-circle")) {
          item.querySelector("i").className = "fas fa-circle";
        }
      }
    });

    return result;
  }

  newPasswordInput.addEventListener("input", function () {
    updatePasswordStrength(this.value);

    if (confirmPasswordInput.value) {
      validatePasswordMatch();
    }
  });

  confirmPasswordInput.addEventListener("input", function () {
    if (newPasswordInput.value) {
      validatePasswordMatch();
    }
  });

  function validatePasswordMatch() {
    const newPass = newPasswordInput.value;
    const confirmPass = confirmPasswordInput.value;

    if (confirmPass && newPass !== confirmPass) {
      confirmPasswordInput.style.borderColor = "#FF4757";
      confirmPasswordInput.style.boxShadow = "0 0 0 3px rgba(255, 71, 87, 0.1)";
    } else if (confirmPass && newPass === confirmPass) {
      confirmPasswordInput.style.borderColor = "#00D26A";
      confirmPasswordInput.style.boxShadow = "0 0 0 3px rgba(0, 210, 106, 0.1)";
    } else {
      confirmPasswordInput.style.borderColor = "";
      confirmPasswordInput.style.boxShadow = "";
    }
  }

  resetForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!newPassword || !confirmPassword) {
      notyf.error("Please fill in all fields.");
      return;
    }

    const strengthCheck = updatePasswordStrength(newPassword);

    if (!strengthCheck.isValid) {
      notyf.error("Password does not meet the required criteria.");
      return;
    }

    if (newPassword !== confirmPassword) {
      notyf.error("Passwords do not match.");
      return;
    }

    const submitBtn = this.querySelector(".btn-reset-submit");
    const originalText = submitBtn.querySelector("span").textContent;
    const originalIcon = submitBtn.querySelector("i").className;

    submitBtn.disabled = true;
    submitBtn.querySelector("span").textContent = "Processing...";
    submitBtn.querySelector("i").className = "fas fa-spinner fa-spin";

    try {
      await verifyPasswordResetCode(auth, oobCode);

      await confirmPasswordReset(auth, oobCode, newPassword);

      notyf.success("Your password has been reset successfully.");
      setTimeout(()=>{window.location.href = "/login"}, 1500);
    } catch (error) {
      notyf.error(
        "An error occurred while resetting the password. Please try again.",
      );

      submitBtn.disabled = false;
      submitBtn.querySelector("span").textContent = originalText;
      submitBtn.querySelector("i").className = originalIcon;
    }
  });

  const style = document.createElement("style");
  style.textContent = `
        .message {
            padding: 16px;
            border-radius: var(--border-radius);
            margin-bottom: var(--spacing-md);
            display: flex;
            align-items: center;
            gap: 12px;
            opacity: 0;
            transform: translateY(-10px);
            transition: all 0.3s ease;
        }
        
        .message.show {
            opacity: 1;
            transform: translateY(0);
        }
        
        .message.success {
            background-color: rgba(0, 210, 106, 0.1);
            border-left: 4px solid #00D26A;
            color: #00D26A;
        }
        
        .message.error {
            background-color: rgba(255, 71, 87, 0.1);
            border-left: 4px solid #FF4757;
            color: #FF4757;
        }
        
        .message i {
            font-size: 1.2rem;
        }
        
        .fa-spinner {
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
  document.head.appendChild(style);

  updatePasswordStrength("");
});
