import { auth, db, getDoc, doc, signOut, onAuthStateChanged } from "../Firebase/config.js";

import notyf from "../Notyf/notyf.js";
import showLoading from "../Notyf/loader.js";

const checkUser = async () => {
    document.body.style.pointerEvents = "none";
    const loading = showLoading(notyf, "Please Wait...");

    onAuthStateChanged(auth, async (user) => {
    if (!user) {
      document.body.style.pointerEvents = "auto";
      notyf.dismiss(loading);
      return;
    }

    const snap = await getDoc(doc(db, "users", user.uid))

    if(!snap.exists()) {
        document.body.style.pointerEvents = "auto";
        notyf.dismiss(loading);
        console.log("Snap Nai Ha");
        
        return;
    }

    const data = snap.data();

    if(data.isVerified === false && data.userRole === "vendor") {
        await signOut(auth);
        return;
    }

    if(data.userRole === "admin") {
        document.body.style.pointerEvents = "auto";
        notyf.dismiss(loading)
        notyf.success("Welcome Admin");
        setTimeout(() => {
      window.location.href = "/admin";
      },1500)
    };

    if(data.userRole === "vendor") {
        document.body.style.pointerEvents = "auto";
        notyf.dismiss(loading)
        notyf.success("Welcome, " + data.userName + " To Your Store.");
        setTimeout(() => {
      window.location.href = "/vendor";
      },1500)
    };

    if(data.userRole === "user") {
        document.body.style.pointerEvents = "auto";
        notyf.dismiss(loading)
        notyf.success("Welcome, " + data.userName);
        setTimeout(() => {
      window.location.href = "/dashboard";
      },1500)
    };

});
}

export default checkUser;