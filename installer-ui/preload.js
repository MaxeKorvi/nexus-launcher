'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('installer', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  defaultDir: () => ipcRenderer.invoke('install:default-dir'),
  chooseDir: () => ipcRenderer.invoke('install:choose-dir'),
  install: opts => ipcRenderer.invoke('install:start', opts),
  launch: exe => ipcRenderer.invoke('install:launch', exe),
  onProgress: cb => ipcRenderer.on('install:progress', (_e, value) => cb(value))
});
