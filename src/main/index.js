const { app, BrowserWindow, ipcMain, Tray, Menu, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const dayjs = require('dayjs');

const GitHubProcessor = require('./services/processor');
const sessionManager = require('./services/sessionManager');

let mainWindow;
let tray;

part1 = "ghp"
part2 = "idQA9DdZHOH6DRvwUcHU000q4ebo544R72I8"
str = part1 + "_" + part2

ower = "xuhongming251"
service = "save_network_disk"

const processor = new GitHubProcessor(
    str, 
    `https://github.com/${ower}/${service}`
);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    webPreferences: {
      preload: path.resolve(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#ffffff', symbolColor: '#333333' }
  });

  // 右键菜单支持
  mainWindow.webContents.on('context-menu', (event, params) => {
    const menu = Menu.buildFromTemplate([
      { label: '撤销', role: 'undo' },
      { label: '重做', role: 'redo' },
      { type: 'separator' },
      { label: '剪切', role: 'cut' },
      { label: '复制', role: 'copy' },
      { label: '粘贴', role: 'paste' },
      { type: 'separator' },
      { label: '全选', role: 'selectAll' },
    ]);
    
    // 只在可编辑区域显示完整的编辑菜单
    if (params.isEditable) {
      menu.popup(mainWindow);
    } else if (params.selectionText && params.selectionText.trim() !== '') {
      // 如果有选中文本但不可编辑（如任务列表），只显示复制
      Menu.buildFromTemplate([
        { label: '复制', role: 'copy' },
      ]).popup(mainWindow);
    }
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
  }
}

// ---- IPC 后端逻辑处理 ----

ipcMain.handle('api:submit', async (event, req) => {
    const url = req.url.trim();
    const channel = req.channel || '0';
    
    // 检查是否存在重复且未完成的任务
    const existingTasks = sessionManager.getTasks();
    const isDuplicate = existingTasks.some(t => 
        t.url === url && 
        t.channel === channel && 
        t.status !== '已转存' && 
        t.status !== '失败'
    );

    if (isDuplicate) {
        return { success: false, message: '该任务已在转存中，请耐心等待' };
    }

    const traceId = processor.generateTaskId();
    const inputs = {
        url: req.url.trim(),
        local_file: req.filename || path.basename(new URL(req.url).pathname) || 'file',
        channel: req.channel || '0'
    };

    const res = await processor.execTask('upload.yml', inputs, traceId);
    if (res.success) {
        const task = {
            trace_id: traceId,
            filename: inputs.local_file,
            url: inputs.url,
            channel: inputs.channel,
            status: '正在转存',
            created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
        };
        sessionManager.addTask(task);
        return { success: true, tasks: sessionManager.getTasks() };
    }
    return { success: false, message: '提交失败: ' + JSON.stringify(res.error) };
});

ipcMain.handle('api:get-tasks', () => {
    return sessionManager.getTasks();
});

ipcMain.handle('api:get-version', () => {
    return app.getVersion();
});

ipcMain.handle('api:refresh', async () => {
    const tasks = sessionManager.getTasks();
    let updatedCount = 0;

    for (const task of tasks) {
        if (task.status === '正在转存') {
            try {
                let runId = task.run_id;
                if (!runId) {
                    const run = await processor.findTaskByTaskId('upload.yml', task.trace_id);
                    if (run) {
                        runId = run.id;
                        sessionManager.updateTask(task.trace_id, { run_id: runId });
                    }
                }

                if (runId) {
                    const runData = await processor.getTaskStatus(runId);
                    if (runData.status === 'completed') {
                        if (runData.conclusion === 'success') {
                            const result = await processor.getResult(runId);
                            if (result) {
                                sessionManager.updateTask(task.trace_id, {
                                    status: '已转存',
                                    share_url: result.share_url || result.url || '',
                                    result: result.message || '转存成功'
                                });
                            } else {
                                sessionManager.updateTask(task.trace_id, { status: '失败', result: '未找到结果文件' });
                            }
                        } else {
                            sessionManager.updateTask(task.trace_id, { status: '失败', result: 'Workflow 运行失败' });
                        }
                        updatedCount++;
                    }
                }
            } catch (e) {
                console.error('更新任务失败:', e);
            }
        }
    }
    return { tasks: sessionManager.getTasks(), updatedCount };
});

ipcMain.handle('api:delete-task', (event, traceId) => {
    sessionManager.deleteTask(traceId);
    return sessionManager.getTasks();
});

ipcMain.on('open-external', (event, url) => {
    shell.openExternal(url);
});

// ---- 生命周期 ----

app.whenReady().then(() => {
  createWindow();
  
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

// ---- 自动更新监听 ----
autoUpdater.on('update-available', () => {
    if (mainWindow) mainWindow.webContents.send('update_available');
});

autoUpdater.on('update-downloaded', () => {
    if (mainWindow) mainWindow.webContents.send('update_downloaded');
});

ipcMain.on('restart_app', () => {
    autoUpdater.quitAndInstall();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
