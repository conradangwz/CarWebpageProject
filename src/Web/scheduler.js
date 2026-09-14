const form = document.getElementById("schedule-form");
const startInput = document.getElementById("scheduled-start");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");
const scheduleMessage = document.getElementById("schedule-message");
const summary = document.getElementById("scheduled-summary");
let saving = false;

const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
document.getElementById("time-zone").textContent = "Your local time zone: " + timeZone + ".";

function localInputValue(date) {
    const pad = value => String(value).padStart(2, "0");
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
        "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
}

function updateMinimumTime() {
    startInput.min = localInputValue(new Date(Math.ceil((Date.now() + 1) / 60000) * 60000));
}

function showSchedule() {
    startInput.disabled = saving;
    saveBtn.disabled = saving;
    try {
        const state = window.ChargingSchedule.read();
        const pending = state?.status === "pending";
        summary.textContent = pending
            ? new Date(state.startUtc).toLocaleString([], { dateStyle: "full", timeStyle: "short" })
            : "No start scheduled.";
        cancelBtn.textContent = pending ? "Cancel scheduled start" : "Clear result";
        cancelBtn.disabled = saving || state === null;
    } catch {
        summary.textContent = "The saved schedule could not be read. Clear it or choose a new time.";
        cancelBtn.textContent = "Clear saved schedule";
        cancelBtn.disabled = saving;
    }
}

form.addEventListener("submit", async event => {
    event.preventDefault();
    const start = new Date(startInput.value);
    if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now()) {
        scheduleMessage.textContent = "Choose a future date and time.";
        return;
    }
    if (localInputValue(start) !== startInput.value) {
        scheduleMessage.textContent = "That local time does not exist because the clocks change. Choose another time.";
        return;
    }

    saving = true;
    showSchedule();
    try {
        await window.ChargingSchedule.save(start.toISOString());
        scheduleMessage.textContent = "Scheduled start saved. Keep this page or the dashboard open until then.";
    } catch (error) {
        scheduleMessage.textContent = "Could not save the schedule: " + error.message;
    } finally {
        saving = false;
        showSchedule();
    }
});

cancelBtn.addEventListener("click", async () => {
    saving = true;
    showSchedule();
    try {
        await window.ChargingSchedule.clear();
        startInput.value = "";
        scheduleMessage.textContent = "Schedule cleared. Current charging is unchanged.";
    } catch (error) {
        scheduleMessage.textContent = "Could not clear the schedule: " + error.message;
    } finally {
        saving = false;
        showSchedule();
    }
});

window.addEventListener("chargingschedulechange", () => {
    scheduleMessage.textContent = "";
    showSchedule();
});
startInput.addEventListener("focus", updateMinimumTime);
updateMinimumTime();
showSchedule();

try {
    const state = window.ChargingSchedule.read();
    if (state?.status === "pending") {
        startInput.value = localInputValue(new Date(state.startUtc));
    }
} catch {
    // showSchedule already explains how to recover an unreadable schedule.
}
