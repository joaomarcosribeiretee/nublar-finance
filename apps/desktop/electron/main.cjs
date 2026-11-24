const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");

const logoPath = path.resolve(__dirname, "../../../assets/logo.png");

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    // Keep in sync with --background in src/styles/tokens.css (the main
    // process cannot read CSS). Theme switching will set these at runtime.
    backgroundColor: "#0a0f0d",
    // Frameless look: the app draws its own top bar (see .drag in index.css)
    // and Windows/Linux keep native window controls through the overlay.
    titleBarStyle: "hidden",
    ...(process.platform === "darwin"
      ? { trafficLightPosition: { x: 16, y: 14 } }
      : {
          titleBarOverlay: {
            color: "#0a0f0d",
            symbolColor: "#8a9a90",
            height: 40,
          },
        }),
    title: "Nublar",
    icon: logoPath,
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Links such as "Ver no GitHub" open in the user's browser, never inside
  // the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
    return;
  }

  mainWindow.loadURL("http://localhost:5173");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
