window.carApi = {
    baseUrl: "https://carcharging-b7g8caccbjfsdpdu.australiaeast-01.azurewebsites.net",

    headers() {
        const key = sessionStorage.getItem("car-demo-access-key");

        if (!key) {
            throw new Error(
                "Select Enter access key to connect to the car."
            );
        }

        return {
            "x-functions-key": key
        };
    },

    enterKey() {
        const key = window.prompt("Enter your demo access key:");

        if (!key?.trim()) {
            return;
        }

        sessionStorage.setItem("car-demo-access-key", key.trim());
        window.location.reload();
    }
};