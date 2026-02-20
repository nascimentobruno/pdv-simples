const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("PDV", {
  ping: () => "ok",

  // Pasta atual usada para salvar os dados
  getDataDir: () => ipcRenderer.invoke("pdv:getDataDir"),

  // Escolher uma pasta
  pickDataDir: () => ipcRenderer.invoke("pdv:pickDataDir"),

  // Ler/escrever JSON
  readJson: (name) => ipcRenderer.invoke("pdv:readJson", name),
  writeJson: (name, data) => ipcRenderer.invoke("pdv:writeJson", name, data),

  // Backup (Import/Export) - base pronta
  exportBackup: () => ipcRenderer.invoke("pdv:exportBackup"),
  importBackup: () => ipcRenderer.invoke("pdv:importBackup"),
});