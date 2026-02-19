import { db, getDoc, doc, updateDoc } from "../Firebase/config.js";

import notyf from "../Notyf/notyf.js";
import loginAlert from "../api/Login-Alert/loginAlert.api.js";


const handleRedirect = async (userId, loading) => {
    const snap = await getDoc(doc(db, "users", userId));

    if(!snap.exists()) {
        return;
    }

    const data = snap.data();

    if(data.isVerified === false && data.userRole === "vendor") {        
        notyf.dismiss(loading)
        notyf.error("Not Verified Yet!");
        return;
    } else {
        updateDoc(doc(db, "users", userId), {
            isVerified: true,
        });
    }

    const res = await loginAlert(data.userEmail);

    if(res.data.success === false) {
        console.log("Error");
        return;
    }

    if(data.userRole === "admin") {
        notyf.dismiss(loading)
        notyf.success("Welcome Admin");
        setTimeout(() => {
      window.location.href = "/admin";
      },1500)
    };

    if(data.userRole === "vendor") {
        notyf.dismiss(loading)
        notyf.success("Welcome, " + data.userName + " To Your Store.");
        setTimeout(() => {
      window.location.href = "/vendor";
      },1500)
    };

    if(data.userRole === "user") {
        notyf.dismiss(loading)
        notyf.success("Welcome, " + data.userName);
        setTimeout(() => {
      window.location.href = "/shop";
      },1500)
    };
}

export default handleRedirect;