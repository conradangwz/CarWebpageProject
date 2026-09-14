const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SLOT_MINUTES = 30;
const MINUTES_PER_DAY = 24 * 60;
const STORAGE_KEY = "myAvailability";

const gridContainer = document.getElementById("gridContainer");
const timeLabels = document.getElementById("timeLabels");
const scheduleMessage = document.getElementById("schedule-message");
const selectionCount = document.getElementById("selection-count");
const saveBtn = document.getElementById("saveBtn");
const clearBtn = document.getElementById("clearBtn");

let isDragging = false;
let selectionMode = true;

function formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return String(hours).padStart(2, "0") + ":" + String(remainder).padStart(2, "0");
}

const timeHeading = document.createElement("div");
timeHeading.className = "time-heading";
timeHeading.textContent = "Time";
timeLabels.appendChild(timeHeading);

for (let minutes = 0; minutes < MINUTES_PER_DAY; minutes += SLOT_MINUTES) {
    const label = document.createElement("div");
    label.className = "time-label";
    label.textContent = formatTime(minutes);
    timeLabels.appendChild(label);
}

const endLabel = document.createElement("div");
endLabel.className = "time-label day-end";
endLabel.textContent = "23:59";
timeLabels.appendChild(endLabel);

DAYS.forEach((day, dayIndex) => {
    const column = document.createElement("div");
    column.className = "day-column";
    column.setAttribute("role", "group");
    column.setAttribute("aria-label", DAY_NAMES[dayIndex]);

    const header = document.createElement("div");
    header.className = "day-header";
    header.textContent = day;
    column.appendChild(header);

    for (let minutes = 0; minutes < MINUTES_PER_DAY; minutes += SLOT_MINUTES) {
        const slot = document.createElement("button");
        slot.type = "button";
        slot.className = "time-slot";
        slot.classList.toggle("half-hour", minutes % 60 === SLOT_MINUTES);

        slot.dataset.timeId = day + "-" + formatTime(minutes);
        slot.dataset.day = day;
        slot.dataset.startMinutes = minutes;
        // Use an exclusive midnight endpoint so the final slot is a full 30 minutes.
        slot.dataset.endMinutes = minutes + SLOT_MINUTES;

        const lastIncludedMinute = minutes + SLOT_MINUTES - 1;
        const description = DAY_NAMES[dayIndex] + " " + formatTime(minutes) +
            "–" + formatTime(lastIncludedMinute) + ", 30-minute charging slot";
        slot.setAttribute("aria-label", description);
        slot.setAttribute("aria-pressed", "false");
        slot.title = description;
        column.appendChild(slot);
    }

    const dayEnd = document.createElement("div");
    dayEnd.className = "day-end";
    dayEnd.setAttribute("aria-hidden", "true");
    column.appendChild(dayEnd);
    gridContainer.appendChild(column);
});

const slots = Array.from(gridContainer.querySelectorAll(".time-slot"));

function setSlotSelected(slot, selected) {
    slot.classList.toggle("selected", selected);
    slot.setAttribute("aria-pressed", String(selected));
}

function updateSelectionCount() {
    const count = slots.filter(slot => slot.classList.contains("selected")).length;
    selectionCount.textContent = count === 0
        ? "No times selected"
        : count + (count === 1 ? " half-hour slot selected" : " half-hour slots selected");
}

function paintSlot(slot) {
    setSlotSelected(slot, selectionMode);
    updateSelectionCount();
    scheduleMessage.textContent = "Unsaved changes. Choose Save schedule to keep these times in this browser.";
}

gridContainer.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.pointerType === "touch") {
        return;
    }

    const slot = event.target.closest(".time-slot");
    if (!slot) {
        return;
    }

    isDragging = true;
    selectionMode = !slot.classList.contains("selected");
    paintSlot(slot);
});

gridContainer.addEventListener("pointerover", event => {
    if (!isDragging || event.pointerType === "touch") {
        return;
    }

    if (event.buttons !== 1) {
        isDragging = false;
        return;
    }

    const slot = event.target.closest(".time-slot");
    if (slot) {
        paintSlot(slot);
    }
});

// Keyboard activation and touch taps toggle once; mouse clicks are handled above.
gridContainer.addEventListener("click", event => {
    if (event.detail !== 0 && event.pointerType !== "touch") {
        return;
    }

    const slot = event.target.closest(".time-slot");
    if (slot) {
        selectionMode = !slot.classList.contains("selected");
        paintSlot(slot);
    }
});

function stopDragging() {
    isDragging = false;
}

document.addEventListener("pointerup", stopDragging);
document.addEventListener("pointercancel", stopDragging);
window.addEventListener("blur", stopDragging);

saveBtn.addEventListener("click", () => {
    const selectedTimes = slots
        .filter(slot => slot.classList.contains("selected"))
        .map(slot => slot.dataset.timeId);

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedTimes));
        scheduleMessage.textContent =
            "Schedule saved in this browser. These times are not yet sent to your car.";
    } catch {
        scheduleMessage.textContent =
            "The schedule could not be saved. Check that your browser allows local storage.";
    }
});

clearBtn.addEventListener("click", () => {
    slots.forEach(slot => setSlotSelected(slot, false));
    updateSelectionCount();

    try {
        localStorage.removeItem(STORAGE_KEY);
        scheduleMessage.textContent = "All selected times and the saved schedule have been cleared.";
    } catch {
        scheduleMessage.textContent =
            "The selection is cleared, but the saved schedule could not be removed from browser storage.";
    }
});

function loadSavedData() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return;
        }

        const savedTimes = JSON.parse(stored);
        if (!Array.isArray(savedTimes) || savedTimes.some(time => typeof time !== "string")) {
            throw new Error("Invalid saved schedule.");
        }

        const savedIDs = new Set(savedTimes);
        slots.forEach(slot => {
            // Preserve selections from the original hourly grid as two half-hour slots.
            const legacyID = slot.dataset.day + "-" +
                Math.floor(Number(slot.dataset.startMinutes) / 60);
            setSlotSelected(slot,
                savedIDs.has(slot.dataset.timeId) || savedIDs.has(legacyID));
        });
    } catch {
        scheduleMessage.textContent =
            "The saved schedule could not be loaded. You can select times and try saving again.";
    }
}

loadSavedData();
updateSelectionCount();
