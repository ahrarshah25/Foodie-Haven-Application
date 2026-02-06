import instance from "../axios.js";

const loginAlert = async (email) => {
  return instance.post("/Login-Alert/loginAlert", {
    email,
  });
};

export default loginAlert;
