const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 原有的
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(...args)),
  
  // 新增的调用后端服务的方法
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  openExternal: (url) => ipcRenderer.send('open-external', url)
});
