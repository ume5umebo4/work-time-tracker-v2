const TimerAPI = {
    intervalId: null,
    onTick: null,
    onStateChange: null,

    init: function (onTickCallback, onStateChangeCallback) {
        this.onTick = onTickCallback;
        this.onStateChange = onStateChangeCallback;

        // Resume if there is an active session
        const activeItem = StorageAPI.getActiveSession();
        if (activeItem) {
            this.startInterval();
            if (this.onStateChange) this.onStateChange(activeItem);
        }
    },

    start: function (itemId) {
        const activeItem = StorageAPI.getActiveSession();

        if (activeItem) {
            if (activeItem.itemId === itemId) {
                // Already running this item
                return;
            } else {
                // Stop current running task if there is a warning handling logic, let's just stop it auto for now
                // "警告を出して選ばせる" is UI logic, handled before calling start()
                throw new Error("ALREADY_RUNNING");
            }
        }

        const now = new Date();
        const activeSession = StorageAPI.setActiveSession(itemId, now.toISOString());

        this.startInterval();
        if (this.onStateChange) this.onStateChange(activeSession);
    },

    stop: function () {
        const activeItem = StorageAPI.getActiveSession();
        if (!activeItem) return null;

        const startTime = new Date(activeItem.startTime);
        const endTime = new Date();

        // Calculate duration and formats
        const diffMs = endTime - startTime;
        if (diffMs < 0) return null; // Time machine?

        const dateStr = startTime.getFullYear() + '-' + String(startTime.getMonth() + 1).padStart(2, '0') + '-' + String(startTime.getDate()).padStart(2, '0');
        const startTimeStr = String(startTime.getHours()).padStart(2, '0') + ':' + String(startTime.getMinutes()).padStart(2, '0');
        const endTimeStr = String(endTime.getHours()).padStart(2, '0') + ':' + String(endTime.getMinutes()).padStart(2, '0');

        const session = {
            itemId: activeItem.itemId,
            date: dateStr,
            startTime: startTimeStr,
            endTime: endTimeStr,
            durationMs: diffMs
        };

        StorageAPI.saveSession(session);
        StorageAPI.clearActiveSession();

        this.stopInterval();
        if (this.onStateChange) this.onStateChange(null);

        return session;
    },

    startInterval: function () {
        if (this.intervalId) return;

        this.tick(); // Initial tick
        this.intervalId = setInterval(() => {
            this.tick();
        }, 1000);
    },

    stopInterval: function () {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    },

    tick: function () {
        const activeItem = StorageAPI.getActiveSession();
        if (!activeItem || !this.onTick) return;

        const start = new Date(activeItem.startTime);
        const now = new Date();
        const diffMs = now - start;

        const seconds = Math.floor((diffMs / 1000) % 60);
        const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
        const hours = Math.floor(diffMs / (1000 * 60 * 60));

        const formatted = String(hours).padStart(2, '0') + ':' +
            String(minutes).padStart(2, '0') + ':' +
            String(seconds).padStart(2, '0');

        this.onTick(formatted, diffMs, start);
    },

    formatDuration: function (durationMs) {
        const seconds = Math.floor((durationMs / 1000) % 60);
        const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
        const hours = Math.floor(durationMs / (1000 * 60 * 60));

        // For short text like "1h 30m" or just full format
        return String(hours).padStart(2, '0') + ':' +
            String(minutes).padStart(2, '0') + ':' +
            String(seconds).padStart(2, '0');
    },

    formatDurationJp: function (durationMs) {
        const seconds = Math.floor((durationMs / 1000) % 60);
        const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
        const hours = Math.floor(durationMs / (1000 * 60 * 60));

        return String(hours).padStart(2, '0') + '時間' +
            String(minutes).padStart(2, '0') + '分' +
            String(seconds).padStart(2, '0') + '秒';
    }
};
