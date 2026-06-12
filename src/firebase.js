// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from 'firebase/storage';



const firebaseConfig = {
  apiKey: "AIzaSyAPCFPzF_j4JlF0abgobwv_YPaZGoMC9rU",
  authDomain: "ditzy-1c314.firebaseapp.com",
  projectId: "ditzy-1c314",
  storageBucket: "ditzy-1c314.firebasestorage.app",
  messagingSenderId: "686701193414",
  appId: "1:686701193414:web:39308431f801e976124fc7",
  measurementId: "G-PT675G1VK1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const db = getFirestore(app);
export const storage = getStorage(app);

// ✅ Export the db
export { db };