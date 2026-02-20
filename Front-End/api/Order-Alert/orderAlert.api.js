import instance from "../axios.js";

const orderAlert = async (payload) => {
  return instance.post("/Order-Alert/orderAlert", payload);
};

export default orderAlert;
