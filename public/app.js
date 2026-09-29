import { subscribeToQueues } from "/firebase.js";

const LOCATION_IDS = ["library", "cafeteria", "admin"];

// Demo-only campus-center fallback. Real browser GPS is preferred.
const DEMO_ORIGIN = {
  latitude: 16.4632,
  longitude: 80.5064,
};

let userLocation = { ...DEMO_ORIGIN };
let latestQueues = {};
let recommendationRun = 0;

const byId = (id) => document.getElementById(id);

function setLocationStatus(text) {
  byId("location-status").textContent = text;
}

function setLiveStatus(text) {
  byId("live-status").textContent = text;
}

function formatMinutes(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }

  const number = Number(value);
  return `~${Number.isInteger(number) ? number : number.toFixed(1)} min`;
}

function renderImmediateQueue(locationId, queue) {
  const count = Number(queue?.count ?? 0);
  const avgServiceSeconds = Number(queue?.avgServiceSeconds ?? 0);

  const queueWaitMinutes =
    avgServiceSeconds > 0
      ? (count * avgServiceSeconds) / 60
      : 0;

  byId(`${locationId}-count`).textContent = String(count);
  byId(`${locationId}-queue`).textContent =
    formatMinutes(queueWaitMinutes);
}

function renderRecommendation(locationId, data) {
  byId(`${locationId}-walk`).textContent =
    formatMinutes(data.walkMinutes);

  byId(`${locationId}-queue`).textContent =
    formatMinutes(data.queueWaitMinutes);

  byId(`${locationId}-headline`).textContent =
    data.headline || "TRY AGAIN";

  const sourceText =
    data.source === "google_routes"
      ? "Walking time: Google Routes"
      : "Walking time: demo fallback";

  byId(`${locationId}-source`).textContent = sourceText;
}

function renderRecommendationError(locationId) {
  byId(`${locationId}-walk`).textContent = "—";

  byId(`${locationId}-headline`).textContent =
    "QUEUE LIVE — ROUTE UNAVAILABLE";

  byId(`${locationId}-source`).textContent =
    "Recommendation service temporarily unavailable";
}

async function resolveUserLocation() {
  if (!("geolocation" in navigator)) {
    setLocationStatus("Demo location active");
    return;
  }

  await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        setLocationStatus("Your location: Ready");
        resolve();
      },

      () => {
        userLocation = { ...DEMO_ORIGIN };
        setLocationStatus("Demo location active");
        resolve();
      },

      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 30000,
      }
    );
  });
}

async function fetchRecommendation(locationId, queue, runId) {
  try {
    const response = await fetch("/api/recommend", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        locationId,
        count: Number(queue.count ?? 0),
        avgServiceSeconds: Number(queue.avgServiceSeconds ?? 0),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Recommendation request failed: ${response.status}`
      );
    }

    const data = await response.json();

    // Ignore stale responses if Firebase changed again
    // while requests were running.
    if (runId !== recommendationRun) return;

    renderRecommendation(locationId, data);

  } catch (error) {
    console.error(locationId, error);

    if (runId === recommendationRun) {
      renderRecommendationError(locationId);
    }
  }
}

async function refreshRecommendations() {
  const runId = ++recommendationRun;

  await Promise.all(
    LOCATION_IDS.map((locationId) => {
      const queue = latestQueues[locationId];

      if (!queue) {
        return Promise.resolve();
      }

      return fetchRecommendation(
        locationId,
        queue,
        runId
      );
    })
  );
}

async function start() {
  await resolveUserLocation();

  subscribeToQueues((queues) => {
    latestQueues = queues || {};

    setLiveStatus("Live campus queues");

    for (const locationId of LOCATION_IDS) {
      const queue = latestQueues[locationId];

      if (queue) {
        renderImmediateQueue(
          locationId,
          queue
        );
      }
    }

    refreshRecommendations();
  });
}

start().catch((error) => {
  console.error(error);

  setLiveStatus("Unable to start live queues");
  setLocationStatus("Demo mode");
});