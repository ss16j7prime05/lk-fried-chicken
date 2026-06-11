import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAZN_49Dr5kIh8cNYaC8_JTtA4ypX89lbY",
  authDomain: "food-order-system-61f13.firebaseapp.com",
  projectId: "food-order-system-61f13",
  storageBucket: "food-order-system-61f13.firebasestorage.app",
  messagingSenderId: "933376622531",
  appId: "1:933376622531:web:6344947b9c623189c68776"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);