const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nublar", {
  platform: process.platform,
  /** Title bar and native menus follow the app theme ("dark" | "light" | "system"). */
  setTheme: (source) => ipcRenderer.send("theme:set", source),
});
