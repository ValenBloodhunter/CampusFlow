import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCXOiiJnxS7SOiqUjyxKagGRUzvW1Evct4",
  authDomain: "campusflow-mvp-ce76e.firebaseapp.com",
  databaseURL: "https://campusflow-mvp-ce76e-default-rtdb.firebaseio.com",
  projectId: "campusflow-mvp-ce76e",
  storageBucket: "campusflow-mvp-ce76e.firebasestorage.app",
  messagingSenderId: "62049305133",
  appId: "1:62049305133:web:6ba9fce17f36e88480aea4",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const VALID_LOCATION_IDS = new Set(["library", "cafeteria", "admin"]);

export function subscribeToQueues(callback) {
  if (typeof callback !== "function") {
    throw new TypeError("subscribeToQueues requires a callback function");
  }

  const queuesRef = ref(database, "queues");

  return onValue(
    queuesRef,
    (snapshot) => {
      callback(snapshot.val() || {});
    },
    (error) => {
      console.error("Firebase queue listener failed:", error);
    }
  );
}

export async function changeQueue(locationId, delta) {
  if (!VALID_LOCATION_IDS.has(locationId)) {
    throw new Error(`Invalid locationId: ${locationId}`);
  }

  if (!Number.isFinite(delta) || !Number.isInteger(delta)) {
    throw new Error("Queue delta must be an integer");
  }

  const countRef = ref(database, `queues/${locationId}/count`);

  return runTransaction(countRef, (currentValue) => {
    const currentCount = Number(currentValue ?? 0);
    return Math.max(0, currentCount + delta);
  });
}