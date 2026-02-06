import { auth, sendPasswordResetEmail } from "../Firebase/config.js";

import notyf from "../Notyf/notyf.js";
import emailHandler from "../helpers/emailHandler.js";
import showLoading from "../Notyf/loader.js";

const sendResetMail = async () => {
  let email = document.getElementById("email");

  if (!email.value.trim()) {
    notyf.error("Empty Input!");

    email.value = "";

    return;
  }

  if (!emailHandler(email.value)) {
    notyf.error(
      "Please Enter Correct Email With Correct Syntax\nFor Examle: name@domain.com.",
    );

    email.value = "";

    return;
  }

  try {
    var loading = showLoading(notyf, "Sending Reset Email...");

    await sendPasswordResetEmail(auth, email.value);

    notyf.dismiss(loading);

    notyf.success("Password Reset Email Have Been Sent Successfully.");

  } catch (error) {
    notyf.dismiss(loading);
    notyf.error(error.message);
  }
};


const submitBtn = document.getElementById("submitBtn");

submitBtn.addEventListener('click', (r) => {
    r.preventDefault();

    const key = r.keyCode || r.which;

    if(key === 13){
        sendResetMail();
        return;
    }

    sendResetMail();
})