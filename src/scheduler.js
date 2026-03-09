const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'scheduler_state.json');

let lastLaunchTime = null;

// Load the scheduler state
function loadSchedulerState() {
    if (fs.existsSync(STATE_FILE)) {
        const data = JSON.parse(fs.readFileSync(STATE_FILE));
        lastLaunchTime = new Date(data.lastLaunchTime);
    }
}

// Save the scheduler state
function saveSchedulerState() {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ lastLaunchTime: lastLaunchTime }));
}

// Calculate next launch time
function calculateNextLaunch() {
    if (!lastLaunchTime) return new Date(Date.now() + (24 * 60 * 60 * 1000) + 60000); // 24 hours + 1 minute
    return new Date(lastLaunchTime.getTime() + (24 * 60 * 60 * 1000) + 60000);
}

// Check if launch is due
function isLaunchDue() {
    return new Date() >= calculateNextLaunch();
}

// Reschedule after each launch
function reschedule() {
    lastLaunchTime = new Date();
    saveSchedulerState();
}

// Call this function before starting a launch
loadSchedulerState();
if (isLaunchDue()) {
    // Perform launch operation here
    // ...

    // After launch
    reschedule();
}