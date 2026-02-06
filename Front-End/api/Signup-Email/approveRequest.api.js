import instance from "../axios.js";

const approveSignup = async (userEmail, userName) => {
  return instance.post("/Signup-Email/approveRequest", {
    userEmail,
    userName,
  });
};

export default approveSignup;
