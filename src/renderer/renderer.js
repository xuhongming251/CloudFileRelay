const urlInput = document.getElementById('urlInput');
const filenameInput = document.getElementById('filenameInput');
const channelSelect = document.getElementById('channelSelect');
const selectTrigger = document.getElementById('selectTrigger');
const selectMenu = document.getElementById('selectMenu');
const selectedOptionText = document.getElementById('selectedOptionText');
const options = document.querySelectorAll('.option');

// ---- 自定义下拉列表逻辑 ----
function toggleSelect() {
    const isHidden = selectMenu.classList.contains('hidden');
    const arrow = selectTrigger.querySelector('svg');
    if (isHidden) {
        selectMenu.classList.remove('hidden');
        selectTrigger.classList.add('border-indigo-500', 'bg-white', 'dark:bg-slate-800');
        if (arrow) arrow.classList.add('rotate-180');
    } else {
        selectMenu.classList.add('hidden');
        selectTrigger.classList.remove('border-indigo-500', 'bg-white', 'dark:bg-slate-800');
        if (arrow) arrow.classList.remove('rotate-180');
    }
}

selectTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSelect();
});

options.forEach(option => {
    option.addEventListener('click', (e) => {
        const value = option.getAttribute('data-value');
        const text = option.querySelector('span').innerText;
        
        channelSelect.value = value;
        selectedOptionText.innerText = text;
        
        // 更新选中状态的圆点
        options.forEach(opt => {
            const dot = opt.querySelector('.check-mark');
            if (opt === option) {
                dot.classList.remove('opacity-0');
            } else {
                dot.classList.add('opacity-0');
            }
        });
        
        toggleSelect();
        e.stopPropagation();
    });
});

// 初始化选中状态
const initialOption = Array.from(options).find(opt => opt.getAttribute('data-value') === channelSelect.value);
if (initialOption) {
    initialOption.querySelector('.check-mark').classList.remove('opacity-0');
}

document.addEventListener('click', (e) => {
    if (!selectMenu.classList.contains('hidden') && !e.target.closest('#customSelect')) {
        toggleSelect();
    }
});

const submitBtn = document.getElementById('submitBtn');
const taskList = document.getElementById('taskList');
const taskCount = document.getElementById('taskCount');
const refreshBtn = document.getElementById('refreshBtn');
const updateNotice = document.getElementById('updateNotice');
const toastContainer = document.getElementById('toastContainer');
const themeToggle = document.getElementById('themeToggle');
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');

// ---- 分页状态 ----
let allTasks = [];
let currentPage = 1;
const pageSize = 5;

const pagination = document.getElementById('pagination');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');
const appVersion = document.getElementById('appVersion');

if (!window.electronAPI) {
    alert('请在 Electron 环境中运行此应用。');
}

// ---- 主题管理 ----
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    }
}

themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    sunIcon.classList.toggle('hidden');
    moonIcon.classList.toggle('hidden');
});

initTheme();

// ---- Toast 通知系统 ----
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    const colors = type === 'success' 
        ? 'bg-emerald-500 shadow-emerald-200 dark:shadow-none' 
        : 'bg-rose-500 shadow-rose-200 dark:shadow-none';
    
    toast.className = `${colors} text-white px-6 py-4 rounded-2xl shadow-xl flex items-center space-x-3 animate-in slide-in-from-right-10 fade-in duration-300 pointer-events-auto`;
    toast.innerHTML = `
        <div class="flex-shrink-0">
            ${type === 'success' 
                ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>'
                : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>'
            }
        </div>
        <span class="text-sm font-bold tracking-tight">${message}</span>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('animate-out', 'fade-out', 'slide-out-to-right-10');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ---- 业务逻辑 ----
async function submitTask() {
    const url = urlInput.value.trim();
    if (!url) {
        showToast('请输入有效的下载链接', 'error');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `
        <svg class="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="font-bold">任务提交中...</span>
    `;

    try {
        const res = await window.electronAPI.invoke('api:submit', {
            url,
            filename: filenameInput.value.trim(),
            channel: channelSelect.value
        });

        if (res.success) {
            showToast('转存任务已提交成功');
            urlInput.value = '';
            filenameInput.value = '';
            currentPage = 1; // 提交成功后回到第一页
            renderTasks(res.tasks);
        } else {
            showToast(res.message || '提交请求被拒绝', 'error');
        }
    } catch (err) {
        showToast('无法连接至中转服务', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
            <span class="text-base">开始转存</span>
            <svg class="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
        `;
    }
}

// ---- 复制功能 ----
async function copyText(text, label) {
    try {
        await navigator.clipboard.writeText(text);
        showToast(`${label}已复制到剪贴板`);
    } catch (err) {
        showToast('复制失败', 'error');
    }
}

window.copyText = copyText;

function renderTasks(tasks) {
    allTasks = tasks || [];
    taskCount.innerText = allTasks.length;
    
    if (allTasks.length === 0) {
        taskList.innerHTML = document.getElementById('emptyState').outerHTML;
        pagination.classList.add('hidden');
        return;
    }
    
    const totalPages = Math.ceil(allTasks.length / pageSize);
    if (currentPage > totalPages) currentPage = totalPages || 1;
    
    // 显示分页控制
    if (totalPages > 1) {
        pagination.classList.remove('hidden');
        pageInfo.innerText = `第 ${currentPage} / ${totalPages} 页`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;
    } else {
        pagination.classList.add('hidden');
    }

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const currentTasks = allTasks.slice(start, end);
    
    taskList.innerHTML = currentTasks.map(task => {
        const isDone = task.status === '已转存';
        const isError = task.status === '失败';
        
        return `
            <div class="task-card bg-white dark:bg-slate-900/60 p-4 md:p-5 rounded-2xl md:rounded-[2rem] border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between group hover:border-indigo-100 dark:hover:border-indigo-900/50 transition-all duration-500 space-y-4 sm:space-y-0">
                <div class="flex items-center space-x-4 md:space-x-5 flex-1 min-w-0 w-full">
                    <div class="w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl ${getStatusIconBg(task.status)} flex items-center justify-center flex-shrink-0 transition-transform duration-500 group-hover:scale-110">
                        ${getStatusIcon(task.status)}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center space-x-2">
                            <div class="text-[13px] md:text-[14px] font-bold text-slate-700 dark:text-slate-200 truncate">${task.filename}</div>
                            <button onclick="copyText('${task.url}', '原始链接')" class="p-1 text-slate-300 hover:text-indigo-500 transition-colors" title="复制原始链接">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
                            </button>
                        </div>
                        <div class="flex items-center space-x-3 mt-1 md:mt-1.5">
                            <span class="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.1em] rounded-md">
                                ${getChannelName(task.channel)}
                            </span>
                            <span class="text-slate-200 dark:text-slate-800">•</span>
                            <span class="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                ${task.created_at}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="flex items-center justify-between sm:justify-end space-x-4 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-slate-50 dark:border-slate-800/50">
                    <div class="flex-1 sm:flex-initial flex items-center justify-start sm:justify-end space-x-2">
                        ${task.share_url ? `
                            <button onclick="copyText('${task.share_url}', '网盘链接')" 
                                class="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-500 rounded-xl transition-all" title="复制网盘链接">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                            </button>
                            <button onclick="window.electronAPI.openExternal('${task.share_url}')" 
                                class="bg-indigo-500 hover:bg-indigo-600 text-white px-4 md:px-5 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[10px] md:text-[11px] font-bold shadow-lg shadow-indigo-500/20 dark:shadow-none transition-all active:scale-95">
                                获取资源
                            </button>
                        ` : `
                            <div class="flex flex-col items-start sm:items-end space-y-1 sm:pr-2">
                                <span class="text-[9px] md:text-[10px] font-black uppercase tracking-widest ${getStatusTextColor(task.status)}">
                                    ${task.status}${(task.progress !== undefined && task.status === '正在转存') ? ` ${task.progress}%` : ''}
                                </span>
                                <div class="w-10 md:w-12 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div class="h-full ${getStatusProgressBarColor(task.status)} ${task.status === '已转存' ? 'w-full' : (task.progress !== undefined ? '' : 'w-1/3 animate-pulse')}" style="${(task.status !== '已转存' && task.progress !== undefined) ? `width: ${task.progress}%` : ''}"></div>
                                </div>
                            </div>
                        `}
                    </div>
                    
                    <button onclick="deleteTask('${task.trace_id}')" 
                        class="p-2 text-slate-300 dark:text-slate-700 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all rounded-xl opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                        <svg class="w-4 h-4 md:w-4.5 md:h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function getChannelName(channel) {
    const mapping = { '0': 'Quark', '1': 'Baidu', '2': 'Mobile' };
    return mapping[channel] || 'Cloud';
}

function getStatusProgressBarColor(status) {
    if (status === '已转存') return 'bg-emerald-500';
    if (status === '失败') return 'bg-rose-500';
    return 'bg-indigo-500';
}

function getStatusIcon(status) {
    if (status === '已转存') return '<svg class="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>';
    if (status === '失败') return '<svg class="w-7 h-7 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>';
    return '<svg class="w-7 h-7 text-indigo-500 animate-[spin_2s_linear_infinite]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>';
}

function getStatusIconBg(status) {
    if (status === '已转存') return 'bg-emerald-50 dark:bg-emerald-500/10';
    if (status === '失败') return 'bg-rose-50 dark:bg-rose-500/10';
    return 'bg-indigo-50 dark:bg-indigo-500/10';
}

function getStatusTextColor(status) {
    if (status === '已转存') return 'text-emerald-500 dark:text-emerald-400';
    if (status === '失败') return 'text-rose-500 dark:text-rose-400';
    return 'text-indigo-500 dark:text-indigo-400';
}

window.deleteTask = async (traceId) => {
    try {
        const tasks = await window.electronAPI.invoke('api:delete-task', traceId);
        renderTasks(tasks);
        showToast('任务记录已清除');
    } catch (e) {
        showToast('删除失败', 'error');
    }
};

submitBtn.onclick = submitTask;
refreshBtn.onclick = async () => {
    const icon = refreshBtn.querySelector('svg');
    if (icon) icon.classList.add('animate-spin');
    try {
        const res = await window.electronAPI.invoke('api:refresh');
        if (res.tasks) renderTasks(res.tasks);
        showToast('列表已同步至最新状态');
    } finally {
        setTimeout(() => {
            if (icon) icon.classList.remove('animate-spin');
        }, 500);
    }
};

// 自动提取文件名
urlInput.addEventListener('input', () => {
    const url = urlInput.value.trim();
    if (!url) { filenameInput.value = ''; return; }
    try {
        // 尝试解析 URL 并提取最后一个路径段作为文件名
        const urlObj = new URL(url);
        const segments = urlObj.pathname.split('/').filter(s => s.length > 0);
        const filename = segments.pop();
        if (filename) {
            filenameInput.value = decodeURIComponent(filename);
        }
    } catch (e) {
        // 如果不是标准 URL，尝试简单的字符串分割
        const parts = url.split('/');
        const filename = parts.pop();
        if (filename && filename.includes('.')) {
            filenameInput.value = filename;
        }
    }
});

// 初始加载
window.electronAPI.invoke('api:get-version').then(v => {
    if (v) appVersion.innerText = `v${v}`;
});
window.electronAPI.invoke('api:get-tasks').then(renderTasks);

// 轮询
setInterval(async () => {
    try {
        const res = await window.electronAPI.invoke('api:refresh');
        if (res.tasks) renderTasks(res.tasks);
    } catch (e) {}
}, 5000);

prevPageBtn.onclick = () => {
    if (currentPage > 1) {
        currentPage--;
        renderTasks(allTasks);
        taskList.parentElement.parentElement.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

nextPageBtn.onclick = () => {
    const totalPages = Math.ceil(allTasks.length / pageSize);
    if (currentPage < totalPages) {
        currentPage++;
        renderTasks(allTasks);
        taskList.parentElement.parentElement.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

// 更新监听
window.electronAPI.on('update_available', () => updateNotice.classList.remove('hidden'));
window.electronAPI.on('update_downloaded', () => {
    updateNotice.innerHTML = `
        <div class="flex flex-col">
            <div class="text-sm font-bold text-slate-800 dark:text-slate-200">更新已就绪</div>
            <div class="text-[10px] text-slate-500">重启应用即可完成升级</div>
        </div>
        <button onclick="window.electronAPI.send('restart_app')" class="bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/20 dark:shadow-none">立即重启</button>
    `;
});

