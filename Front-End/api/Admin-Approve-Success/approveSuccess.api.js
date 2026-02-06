import instance from "../axios.js";

const approveSuccess = async (email, userName) => {
  return instance.post("/Admin-Approve-Success/approveSuccess", {
    email,
    userName,
  });
};

export default approveSuccess;