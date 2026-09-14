const apiUrl = "http://localhost:7037/api/GetCarStatus";

const battery = document.getElementById("battery");
const batteryBar = document.getElementById("battery-bar");
const charging = document.getElementById("charging");
const lastUpdated = document.getElementById("last-updated");
const message = document.getElementById("message");

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
        setTimeout(refreshStatus, 5000);
    }
}

refreshStatus();