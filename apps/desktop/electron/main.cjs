const { app, BrowserWindow, ipcMain, nativeTheme, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const logoPath = path.resolve(__dirname, "../../../assets/logo.png");

// Keep in sync with --background and --muted in src/styles/tokens.css (the
// main process cannot read CSS).
const windowColors = {
  dark: { background: "#0a0f0d", symbol: "#8a9a90" },
  light: { background: "#f3f1ea", symbol: "#56635b" },
};
const themeSources = new Set(["dark", "light", "system"]);

let mainWindow = null;

// The last theme the app asked for, so the next launch opens the window in
// the right colors before the page loads.
function themeFile() {
  return path.join(app.getPath("userData"), "theme.json");
}

function readThemeSource() {
  try {
    const source = JSON.parse(fs.readFileSync(themeFile(), "utf8")).source;
    return themeSources.has(source) ? source : "dark";
  } catch {
    return "dark";
  }
}

function currentColors() {
  return windowColors[nativeTheme.shouldUseDarkColors ? "dark" : "light"];
}

function paintWindow() {
  if (!mainWindow) {
    return;
  }
  const colors = currentColors();
  mainWindow.setBackgroundColor(colors.background);
  if (process.platform !== "darwin") {
    try {
      mainWindow.setTitleBarOverlay({ color: colors.background, symbolColor: colors.symbol });
    } catch {
      // Not every Linux window manager supports the overlay.
    }
  }
}

// The renderer says which theme the user picked; title bar, menus and native
// controls follow. With "system", nativeTheme tracks the OS on its own.
ipcMain.on("theme:set", (_event, source) => {
  if (!themeSources.has(source) || nativeTheme.themeSource === source) {
    return;
  }
  nativeTheme.themeSource = source;
  try {
    fs.writeFileSync(themeFile(), JSON.stringify({ source }));
  } catch {
    // Only a head start for the next launch.
  }
});

nativeTheme.on("updated", paintWindow);

function createWindow() {
  nativeTheme.themeSource = readThemeSource();
  const colors = currentColors();

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: colors.background,
    // Frameless look: the app draws its own top bar (see .drag in index.css)
    // and Windows/Linux keep native window controls through the overlay.
    titleBarStyle: "hidden",
    ...(process.platform === "darwin"
      ? { trafficLightPosition: { x: 16, y: 14 } }
      : {
          titleBarOverlay: {
            color: colors.background,
            symbolColor: colors.symbol,
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
      // The system language, for the app's first launch (preload.cjs).
      additionalArguments: [`--nublar-locale=${app.getLocale()}`],
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
