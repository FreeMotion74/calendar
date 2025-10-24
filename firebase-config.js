// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  update
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// 🔹 сюда вставь свои данные из Firebase Console (важно, чтобы был databaseURL)
const firebaseConfig = {
  apiKey: "AIzaSyC6Bx7TqwJKDVikvsS-6cvZOUWHC_KQsNs",
  authDomain: "calendar-5039c.firebaseapp.com",
  databaseURL: "https://calendar-5039c-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "calendar-5039c",
  storageBucket: "calendar-5039c.firebasestorage.app",
  messagingSenderId: "497955603175",
  appId: "1:497955603175:web:54c6ce88d62b3072a6d842"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);

// Получаем экземпляр базы данных
const db = getDatabase(app);

// Экспортируем всё, чтобы можно было использовать в script.js
export { db, ref, set, get, onValue, update };
