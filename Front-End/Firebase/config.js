// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  updateProfile,
  GithubAuthProvider,
  confirmPasswordReset,
  verifyPasswordResetCode
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { getFirestore,
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  collection,
  getDocs,
  updateDoc,
  limit,
  deleteDoc,
  onSnapshot,
  query, 
    where, 
    orderBy,
    addDoc,
 } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

 import { getStorage } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-storage.js";


// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA9B_0gdlihlQlyYcIFmiEISoCEaDv4y0g",
  authDomain: "foodie-haven-630d7.firebaseapp.com",
  projectId: "foodie-haven-630d7",
  storageBucket: "foodie-haven-630d7.firebasestorage.app",
  messagingSenderId: "221109201714",
  appId: "1:221109201714:web:b70b466363bd9a75f1052b",
  measurementId: "G-BQ8Z5KS6GX",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const githubProvider = new GithubAuthProvider();
const storage = getStorage(app);

export {
  auth,
  db,
  googleProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  updateProfile,
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
  githubProvider,
  collection,
  getDocs,
  updateDoc,
  confirmPasswordReset,
  verifyPasswordResetCode,
  limit,
  deleteDoc,
  onSnapshot,
  query, 
    where, 
    orderBy,
    addDoc,
    storage
};
