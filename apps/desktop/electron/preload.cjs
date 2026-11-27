const { contextBridge, ipcRenderer } = require("electron");

const localeArgument = process.argv.find((arg) => arg.startsWith("--nublar-locale="));

contextBridge.exposeInMainWorld("nublar", {
  platform: process.platform,
  /** The system language from app.getLocale(), e.g. "pt-BR" or "en-US". */
  locale: localeArgument ? localeArgument.slice("--nublar-locale=".length) : undefined,
  /** Title bar and native menus follow the app theme ("dark" | "light" | "system"). */
  setTheme: (source) => ipcRenderer.send("theme:set", source),
});
