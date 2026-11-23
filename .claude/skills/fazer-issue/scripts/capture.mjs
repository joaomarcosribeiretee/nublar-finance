// Captures the same screens from the main build and the branch build so the
// PR can show before/after. TOOLS_DIR points at a folder outside the repo
// with playwright-core installed (kept out of the lockfile on purpose).
//
//   TOOLS_DIR=<dir> node capture.mjs <outDir> <shots.json>
//
// shots.json:
// {
//   "main": "http://localhost:4174",
//   "branch": "http://localhost:4173",
//   "viewport": { "width": 1240, "height": 820 },
//   "shots": [
//     { "name": "login", "path": "/", "targets": ["main", "branch"],
//       "css": "optional CSS injected before the capture",
//       "script": "optional JS run in the page before the capture" }
//   ]
// }
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const toolsDir = process.env.TOOLS_DIR;
if (!toolsDir) {
  console.error("defina TOOLS_DIR com a pasta onde playwright-core foi instalado");
  process.exit(1);
}
const { chromium } = createRequire(path.join(path.resolve(toolsDir), "index.js"))("playwright-core");

const [outDir, configPath] = process.argv.slice(2);
if (!outDir || !configPath) {
  console.error("uso: node capture.mjs <outDir> <shots.json>");
  process.exit(1);
}
const config = JSON.parse(readFileSync(configPath, "utf8"));
mkdirSync(outDir, { recursive: true });

// The text caret blinks between captures and would show up as a false diff.
const stable = "*{caret-color:transparent!important}";

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge" });
const context = await browser.newContext({
  viewport: config.viewport ?? { width: 1240, height: 820 },
  deviceScaleFactor: 1,
  reducedMotion: "reduce",
});

for (const shot of config.shots) {
  for (const target of shot.targets ?? ["main", "branch"]) {
    const page = await context.newPage();
    await page.goto(new URL(shot.path ?? "/", config[target]).href, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: stable + (shot.css ?? "") });
    if (shot.script) {
      await page.evaluate(shot.script);
    }
    await page.waitForTimeout(shot.waitMs ?? 600);
    const file = path.join(outDir, `${shot.name}-${target}.png`);
    await page.screenshot({ path: file, fullPage: Boolean(shot.fullPage) });
    console.log("captura:", file);
    await page.close();
  }
}

await browser.close();
