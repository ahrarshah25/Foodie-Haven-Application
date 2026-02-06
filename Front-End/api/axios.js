import axios from "https://cdn.jsdelivr.net/npm/axios@1.6.7/+esm";

const instance = axios.create({
  baseURL: "https://foodie-haven-application-backend.vercel.app/api",
  headers: {
    "Content-Type": "application/json",
  },
});

export default instance;
