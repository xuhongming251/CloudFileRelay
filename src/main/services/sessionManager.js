const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { app } = require('electron');

const DB_PATH = path.join(app.getPath('userData'), 'sessions_db.json');

class SessionManager {
    constructor() {
        this.tasks = [];
        this.initialized = false;
        this.saveTimer = null;
        // 初始加载由 init() 异步处理
    }

    async init() {
        if (this.initialized) return;
        await this.load();
        this.initialized = true;
    }

    async load() {
        try {
            if (fsSync.existsSync(DB_PATH)) {
                const data = await fs.readFile(DB_PATH, 'utf8');
                this.tasks = JSON.parse(data);
            }
        } catch (e) {
            console.error('加载数据库失败:', e);
            this.tasks = [];
        }
    }

    // 使用防抖减少写入频率
    scheduleSave() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        this.saveTimer = setTimeout(() => {
            this.save();
            this.saveTimer = null;
        }, 1000); // 1秒内多次修改只存一次
    }

    async save() {
        try {
            const data = JSON.stringify(this.tasks, null, 2);
            await fs.writeFile(DB_PATH, data);
        } catch (e) {
            console.error('保存数据库失败:', e);
        }
    }

    addTask(task) {
        this.tasks.unshift(task); // 新任务在前面
        if (this.tasks.length > 200) {
            this.tasks = this.tasks.slice(0, 200); // 只保留最近200个
        }
        this.scheduleSave();
    }

    getTasks() {
        return this.tasks;
    }

    updateTask(traceId, updates) {
        const index = this.tasks.findIndex(t => t.trace_id === traceId);
        if (index !== -1) {
            this.tasks[index] = { ...this.tasks[index], ...updates };
            this.scheduleSave();
            return true;
        }
        return false;
    }

    deleteTask(traceId) {
        this.tasks = this.tasks.filter(t => t.trace_id !== traceId);
        this.scheduleSave();
    }
}

module.exports = new SessionManager();

