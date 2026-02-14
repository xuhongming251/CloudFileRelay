const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DB_PATH = path.join(app.getPath('userData'), 'sessions_db.json');

class SessionManager {
    constructor() {
        this.tasks = [];
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(DB_PATH)) {
                const data = fs.readFileSync(DB_PATH, 'utf8');
                this.tasks = JSON.parse(data);
            }
        } catch (e) {
            this.tasks = [];
        }
    }

    save() {
        try {
            fs.writeFileSync(DB_PATH, JSON.stringify(this.tasks, null, 2));
        } catch (e) {
            console.error('保存数据库失败:', e);
        }
    }

    addTask(task) {
        this.tasks.unshift(task); // 新任务在前面
        this.save();
    }

    getTasks() {
        return this.tasks;
    }

    updateTask(traceId, updates) {
        const index = this.tasks.findIndex(t => t.trace_id === traceId);
        if (index !== -1) {
            this.tasks[index] = { ...this.tasks[index], ...updates };
            this.save();
            return true;
        }
        return false;
    }

    deleteTask(traceId) {
        this.tasks = this.tasks.filter(t => t.trace_id !== traceId);
        this.save();
    }
}

module.exports = new SessionManager();
