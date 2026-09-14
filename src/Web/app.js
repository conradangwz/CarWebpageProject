const apiUrl = "http://localhost:7037/api/GetCarStatus";
const setChargingUrl = "http://localhost:7037/api/SetCharging";

const battery = document.getElementById("battery");
const batteryBar = document.getElementById("battery-bar");
const charging = document.getElementById("charging");
const lastUpdated = document.getElementById("last-updated");
const message = document.getElementById("message");

const chargingButton = document.getElementById("charging-toggle");
const commandMessage = document.getElementById("command-message");

let currentIsCharging = null;
let requestInProgress = false;
let waitingForChargingState = null;
let confirmationTimer;

function updateChargingButton() {
    const waiting =
        requestInProgress || waitingForChargingState !== null;

    chargingButton.disabled =
        waiting || currentIsCharging === null;

    if (waiting) {
        chargingButton.textContent = waitingForChargingState
            ? "Starting…"
            : "Stopping…";
    } else if (currentIsCharging === null) {
        chargingButton.textContent = "Loading…";
    } else {
        chargingButton.textContent = currentIsCharging
            ? "Stop Charging"
            : "Start Charging";
    }
}

async function refreshStatus() {
    try {
        const response = await fetch(apiUrl, {
            cache: "no-store",
            signal: AbortSignal.timeout(5000)
        });

        if (response.status === 404) {
            throw new Error("No telemetry has been saved yet.");
        }

        if (!response.ok) {
            throw new Error(`API returned HTTP ${response.status}.`);
        }

        const car = await response.json();

        currentIsCharging = car.isCharging;

        // Check whether telemetry confirms the requested change.
        if (
            !requestInProgress &&
            waitingForChargingState !== null &&
            currentIsCharging === waitingForChargingState
        ) {
            waitingForChargingState = null;
            clearTimeout(confirmationTimer);

            commandMessage.textContent = currentIsCharging
                ? "Charging started."
                : "Charging stopped.";
        }

        updateChargingButton();

        battery.textContent = `${car.battery}%`;
        batteryBar.value = car.battery;

        charging.textContent = car.isCharging
            ? "Charging"
            : "Not charging";

        lastUpdated.textContent =
            new Date(car.date).toLocaleString();

        message.textContent =
            "Status loaded. This page refreshes automatically.";
    } catch (error) {
        message.textContent =
            `Could not load status: ${error.message}`;
    } finally {
        // Wait five seconds before requesting the next update.
        setTimeout(refreshStatus, 1000);
    }
}

async function toggleCharging() {
    if (
        currentIsCharging === null ||
        requestInProgress ||
        waitingForChargingState !== null
    ) {
        return;
    }

    // ! reverses the Boolean: true becomes false, and vice versa.
    const requestedState = !currentIsCharging;

    requestInProgress = true;
    waitingForChargingState = requestedState;
    commandMessage.textContent = "";
    updateChargingButton();

    try {
        const response = await fetch(setChargingUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                isCharging: requestedState
            }),
            signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) {
            throw new Error(
                `Request failed: HTTP ${response.status}.`);
        }

        const result = await response.json();

        // Your API includes the device's result in its JSON.
        if (result.deviceStatus !== 200) {
            throw new Error(
                result.deviceStatus === 409
                    ? "The battery is already full."
                    : `Car rejected the command: ${result.deviceStatus}.`
            );
        }

        commandMessage.textContent =
            "Command accepted. Waiting for updated telemetry…";

        // Avoid leaving the button disabled indefinitely.
        confirmationTimer = setTimeout(() => {
            waitingForChargingState = null;

            commandMessage.textContent =
                "The command was accepted, but updated telemetry " +
                "has not confirmed it yet.";

            updateChargingButton();
        }, 30000);
    } catch (error) {
        waitingForChargingState = null;

        commandMessage.textContent =
            error.name === "TimeoutError"
                ? "The request timed out. Check the latest car status."
                : error.message;
    } finally {
        requestInProgress = false;
        updateChargingButton();
    }
}

refreshStatus();