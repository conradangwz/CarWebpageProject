// Shared by both pages. The car and Functions keep their existing Start/Stop logic.
window.ChargingSchedule = (() => {
    const storageKey = "carChargingSchedule";
    const lockName = "car-charging-schedule";
    // const startUrl = "http://localhost:7037/api/SetCharging";
    const startUrl = `${carApi.baseUrl}/api/SetCharging`;
    const maxLateMs = 60000;
    const statusElement = document.getElementById("scheduled-charging-status");
    let checking = false;

    function read() {
        const state = JSON.parse(localStorage.getItem(storageKey));
        if (state !== null && (
            typeof state.startUtc !== "string" || !Number.isFinite(Date.parse(state.startUtc)) ||
            !["pending", "attempted", "sent", "failed", "missed"].includes(state.status) ||
            typeof state.message !== "string"
        )) {
            throw new Error("The saved schedule could not be read. Clear it and choose a new time.");
        }
        return state;
    }

    function render() {
        try {
            const state = read();
            statusElement.textContent = state?.status === "pending"
                ? "Scheduled start: " + new Date(state.startUtc).toLocaleString() + ". Keep this app open."
                : state?.message || "No start scheduled.";
        } catch {
            statusElement.textContent = "The schedule could not be loaded. Check browser storage or clear it on the schedule page.";
        }
        window.dispatchEvent(new Event("chargingschedulechange"));
    }

    function write(state) {
        if (state === null) {
            localStorage.removeItem(storageKey);
        } else {
            localStorage.setItem(storageKey, JSON.stringify(state));
        }
        render();
    }

    function withLock(action) {
        if (!navigator.locks) {
            throw new Error("Scheduling needs a current browser. Open this app through localhost or HTTPS.");
        }
        // Only one tab may claim, replace, or cancel a schedule at a time.
        return navigator.locks.request(lockName, action);
    }

    async function checkTime() {
        if (checking) return;
        checking = true;
        try {
            const pending = read();
            if (pending?.status !== "pending" || Date.now() < Date.parse(pending.startUtc)) return;

            const claimed = await withLock(() => {
                const state = read();
                if (state?.status !== "pending" || Date.now() < Date.parse(state.startUtc)) return null;
                if (Date.now() - Date.parse(state.startUtc) > maxLateMs) {
                    write({
                        ...state, status: "missed",
                        message: "The scheduled time was missed. Choose a new time to try again."
                    });
                    return null;
                }

                // Consume the schedule BEFORE sending: refreshes and other tabs cannot retry it.
                write({
                    ...state, status: "attempted",
                    message: "Scheduled Start requested. Check the dashboard for confirmation; this schedule will not run again."
                });
                return state;
            });
            if (!claimed) return;

            let outcome;
            try {
                const response = await fetch(startUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...carApi.headers()
                    },
                    body: JSON.stringify({ isCharging: true }),
                    keepalive: true,
                    signal: AbortSignal.timeout(15000)
                });
                if (!response.ok) {
                    throw new Error("Start could not be confirmed (HTTP " + response.status + "). Check the dashboard before trying again.");
                }
                const result = await response.json();
                if (result.deviceStatus !== 200) {
                    throw new Error(result.deviceStatus === 409
                        ? "The battery is already full. Scheduled charging did not start."
                        : "The car did not accept the scheduled Start. Check the dashboard.");
                }
                outcome = {
                    status: "sent",
                    message: "The car accepted the scheduled Start. This schedule is complete."
                };
            } catch (error) {
                outcome = {
                    status: "failed", message:
                        error.name === "TimeoutError" || error instanceof TypeError || error instanceof SyntaxError
                            ? "Scheduled Start could not be confirmed. Check the connection and dashboard before trying again. It will not retry automatically."
                            : error.message
                };
            }

            await withLock(() => {
                const current = read();
                // Do not overwrite a replacement schedule or a cleared result.
                if (current?.startUtc === claimed.startUtc && current.status === "attempted") {
                    write({ ...current, ...outcome });
                }
            });
        } catch (error) {
            statusElement.textContent = error.message;
        } finally {
            checking = false;
        }
    }

    window.addEventListener("storage", event => {
        if (event.key === storageKey || event.key === null) render();
    });
    window.addEventListener("pageshow", () => { render(); checkTime(); });
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) { render(); checkTime(); }
    });
    setInterval(checkTime, 1000);
    render();
    checkTime();

    return {
        read,
        save: startUtc => withLock(() => {
            if (!Number.isFinite(Date.parse(startUtc)) || Date.parse(startUtc) <= Date.now()) {
                throw new Error("Choose a future date and time.");
            }
            write({ startUtc, status: "pending", message: "" });
        }),
        clear: () => withLock(() => write(null))
    };
})();
