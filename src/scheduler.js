class Scheduler {
    constructor() {
        this.lastLaunchTime = null;
    }

    launch() {
        const currentTime = new Date();
        const currentTimeUTC = currentTime.getTime() + currentTime.getTimezoneOffset() * 60000;
        
        if (this.lastLaunchTime) {
            const timeDifference = currentTimeUTC - this.lastLaunchTime;
            if (timeDifference < 24 * 60 * 60 * 1000) {
                console.log("Skipping launch. Launched less than 24 hours ago.");
                return;
            }
        }

        this.lastLaunchTime = currentTimeUTC;
        console.log("Launching task...");
        // Place the task logic here

        this.scheduleNextLaunch();
    }

    scheduleNextLaunch() {
        const nextLaunchTime = new Date(this.lastLaunchTime + 24 * 60 * 60 * 1000);
        console.log(`Next launch scheduled for: ${nextLaunchTime.toISOString()}`);
    }
}

const scheduler = new Scheduler();
scheduler.launch(); // Call to start the scheduling