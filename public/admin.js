// Placeholder. Person 2 owns this file.
import { subscribeToQueues, changeQueue } from "/firebase.js";

const statusEl = document.getElementById("admin-status");
const buttons = [...document.querySelectorAll("button[data-location][data-delta]")];

function setStatus(message) {
  statusEl.textContent = message;
}

function renderCounts(queues) {
  const ids = ["library", "cafeteria", "admin"];

  for (const id of ids) {
    const target = document.getElementById(`admin-${id}-count`);
    const value = queues?.[id]?.count;
    target.textContent = value === undefined || value === null ? "—" : String(value);
  }

  setStatus("Live Firebase connection ready.");
}

async function handleQueueChange(button) {
  const locationId = button.dataset.location;
  const delta = Number(button.dataset.delta);

  try {
    button.disabled = true;
    setStatus(`Updating ${locationId}…`);
    await changeQueue(locationId, delta);
    setStatus("Update saved. Realtime listeners will refresh automatically.");
  } catch (error) {
    console.error(error);
    setStatus(`Update failed: ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

for (const button of buttons) {
  button.addEventListener("click", () => handleQueueChange(button));
}

subscribeToQueues(renderCounts);