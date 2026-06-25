import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAZN_49Dr5kIh8cNYaC8_jItA4ypX89lbY",
  authDomain: "food-order-system-61f13.firebaseapp.com",
  projectId: "food-order-system-61f13",
  storageBucket: "food-order-system-61f13.firebasestorage.app",
  messagingSenderId: "933376622531",
  appId: "1:933376622531:web:6344947b9c623189c68776"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);