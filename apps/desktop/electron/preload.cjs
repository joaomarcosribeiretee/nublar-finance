const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("nublar", {
  platform: process.platform,
});
