const STORAGE_KEYS = {
    ITEMS: 'work_time_items',
    SESSIONS: 'work_time_sessions',
    ACTIVE: 'work_time_active_session',
    USER_NAME: 'work_time_user_name',
    TUTORIAL_SHOWN: 'work_time_tutorial_shown'
};

const StorageAPI = {
    // ---- Items ----
    getItems: function () {
        const data = localStorage.getItem(STORAGE_KEYS.ITEMS);
        return data ? JSON.parse(data) : [];
    },
    getItem: function (id) {
        return this.getItems().find(item => item.id === id);
    },
    saveItem: function (item) {
        const items = this.getItems();
        if (!item.id) {
            item.id = 'item_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            item.createdAt = new Date().toISOString();
            items.push(item);
        } else {
            const index = items.findIndex(i => i.id === item.id);
            if (index !== -1) {
                items[index] = { ...items[index], ...item };
            } else {
                items.push(item);
            }
        }
        localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
        return item;
    },
    deleteItem: function (id) {
        let items = this.getItems();
        items = items.filter(item => item.id !== id);
        localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));

        // Items tied to sessions might be kept or we might just leave them as orphans
        // For simple offline tool, keeping them as orphans is okay as long as we handle missing items.
    },

    // ---- Sessions ----
    getSessions: function () {
        const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
        return data ? JSON.parse(data) : [];
    },
    saveSession: function (session) {
        const sessions = this.getSessions();
        if (!session.id) {
            session.id = 'sess_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            sessions.push(session);
        } else {
            const index = sessions.findIndex(s => s.id === session.id);
            if (index !== -1) {
                sessions[index] = { ...sessions[index], ...session };
            } else {
                sessions.push(session);
            }
        }
        // sort by date desc
        sessions.sort((a, b) => new Date(b.date + 'T' + b.startTime) - new Date(a.date + 'T' + a.startTime));
        localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
        return session;
    },
    deleteSession: function (id) {
        let sessions = this.getSessions();
        sessions = sessions.filter(s => s.id !== id);
        localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    },

    // ---- Active Session ----
    getActiveSession: function () {
        const data = localStorage.getItem(STORAGE_KEYS.ACTIVE);
        return data ? JSON.parse(data) : null;
    },
    setActiveSession: function (itemId, startTimeIso) {
        const data = {
            itemId: itemId,
            startTime: startTimeIso
        };
        localStorage.setItem(STORAGE_KEYS.ACTIVE, JSON.stringify(data));
        return data;
    },
    clearActiveSession: function () {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE);
    },

    // ---- User Info ----
    getUserName: function () {
        return localStorage.getItem(STORAGE_KEYS.USER_NAME) || '';
    },
    setUserName: function (name) {
        if (name) {
            localStorage.setItem(STORAGE_KEYS.USER_NAME, name);
        } else {
            localStorage.removeItem(STORAGE_KEYS.USER_NAME);
        }
    },
    getTutorialShown: function () {
        return localStorage.getItem(STORAGE_KEYS.TUTORIAL_SHOWN) === 'true';
    },
    setTutorialShown: function (shown) {
        if (shown) {
            localStorage.setItem(STORAGE_KEYS.TUTORIAL_SHOWN, 'true');
        } else {
            localStorage.removeItem(STORAGE_KEYS.TUTORIAL_SHOWN);
        }
    },

    // ---- Data Management ----
    exportData: function () {
        const data = {
            items: this.getItems(),
            sessions: this.getSessions(),
            active: this.getActiveSession(),
            userName: this.getUserName(),
            tutorialShown: this.getTutorialShown(),
            exportDate: new Date().toISOString()
        };
        return JSON.stringify(data, null, 2);
    },
    importData: function (jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (data.items) localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(data.items));
            if (data.sessions) localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(data.sessions));
            if (data.active !== undefined) {
                if (data.active) localStorage.setItem(STORAGE_KEYS.ACTIVE, JSON.stringify(data.active));
                else localStorage.removeItem(STORAGE_KEYS.ACTIVE);
            }
            if (data.userName !== undefined) {
                this.setUserName(data.userName);
            }
            if (data.tutorialShown !== undefined) {
                this.setTutorialShown(data.tutorialShown);
            }
            return true;
        } catch (e) {
            console.error("Failed to import data:", e);
            return false;
        }
    },
    clearAllData: function () {
        localStorage.removeItem(STORAGE_KEYS.ITEMS);
        localStorage.removeItem(STORAGE_KEYS.SESSIONS);
        localStorage.removeItem(STORAGE_KEYS.ACTIVE);
        localStorage.removeItem(STORAGE_KEYS.USER_NAME);
        localStorage.removeItem(STORAGE_KEYS.TUTORIAL_SHOWN);
    }
};
