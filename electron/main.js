const { app, BrowserWindow, shell, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { spawn } = require("child_process");

let mainWindow;
let nextProcess;

const isDev = !app.isPackaged;
const NEXT_PORT = 3456;

/** =========================
 *  Persistência (JSON em arquivo) - robusta
 *  - Default: ./data ao lado do .exe (portable real)
 *  - Opcional: usuário escolhe pasta
 *  - Escrita ATÔMICA + fila por arquivo
 *  ========================= */

const ALLOWED_FILES = new Set([
  "products",
  "sales",
  "stock",
  "users",
  "audit",
  "settings",
]);

function settingsPath() {
  return path.join(app.getPath("userData"), "pdv-settings.json");
}

function readSettings() {
  try {
    const p = settingsPath();
    if (!fs.existsSync(p)) return {};
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return {};
  }
}

function writeSettings(obj) {
  try {
    fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
    fs.writeFileSync(settingsPath(), JSON.stringify(obj, null, 2), "utf-8");
  } catch (e) {
    console.log("[settings-write-err]", e);
  }
}

function defaultPortableDataDir() {
  const exeDir = path.dirname(app.getPath("exe"));
  return path.join(exeDir, "data");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function getDataDir() {
  const s = readSettings();
  const chosen = s && typeof s.dataDir === "string" ? s.dataDir : null;
  const dir = chosen || defaultPortableDataDir();
  ensureDir(dir);
  return dir;
}

function filePath(name) {
  if (!ALLOWED_FILES.has(name)) throw new Error("Arquivo inválido.");
  return path.join(getDataDir(), `${name}.json`);
}

function sha1(text) {
  return crypto.createHash("sha1").update(text, "utf8").digest("hex");
}

function defaultFallback(name) {
  // defaults por arquivo
  switch (name) {
    case "products":
      return [];
    case "sales":
      return [];
    case "stock":
      // estrutura sugerida: saldo + movimentos
      return { balances: {}, movements: [], schemaVersion: 1 };
    case "users":
      // users: [{id, username, passwordHash, role, enabled}]
      return { users: [], schemaVersion: 1 };
    case "audit":
      return { events: [], schemaVersion: 1 };
    case "settings":
      return { schemaVersion: 1 };
    default:
      return null;
  }
}

function safeReadJson(name, fallback) {
  try {
    const p = filePath(name);
    if (!fs.existsSync(p)) return fallback;
    const raw = fs.readFileSync(p, "utf-8").trim();
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.log("[readJson-err]", name, e);
    return fallback;
  }
}

/**
 * Escrita atômica:
 * - escreve em .tmp
 * - fsync
 * - rename para destino
 */
function atomicWriteFileSync(targetPath, content) {
  ensureDir(path.dirname(targetPath));
  const tmp = `${targetPath}.tmp`;

  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeFileSync(fd, content, "utf-8");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  // Em Windows, rename sobrescrevendo pode falhar dependendo do estado.
  // Estratégia: se existe, remove antes.
  if (fs.existsSync(targetPath)) {
    try {
      fs.unlinkSync(targetPath);
    } catch (e) {
      // se falhar, tenta rename mesmo
    }
  }
  fs.renameSync(tmp, targetPath);
}

// fila simples por arquivo
const writeQueues = new Map(); // name -> Promise

function enqueueWrite(name, fn) {
  const prev = writeQueues.get(name) || Promise.resolve();
  const next = prev
    .catch(() => {}) // não trava fila por erro anterior
    .then(() => fn());
  writeQueues.set(name, next);
  return next;
}

function safeWriteJson(name, data) {
  const p = filePath(name);
  const json = JSON.stringify(data, null, 2);
  atomicWriteFileSync(p, json);
  return true;
}

// Util: audit
function appendAudit(event) {
  try {
    const audit = safeReadJson("audit", defaultFallback("audit"));
    audit.events = Array.isArray(audit.events) ? audit.events : [];
    audit.events.push({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      ...event,
    });
    enqueueWrite("audit", () => safeWriteJson("audit", audit));
  } catch (e) {
    console.log("[audit-err]", e);
  }
}

/** =========================
 *  IPC (expostos pro preload)
 *  ========================= */

ipcMain.handle("pdv:getDataDir", async () => getDataDir());

ipcMain.handle("pdv:pickDataDir", async () => {
  const res = await dialog.showOpenDialog({
    title: "Selecione a pasta para salvar os dados (ex: Google Drive - Meu Drive)",
    properties: ["openDirectory", "createDirectory"],
  });

  if (res.canceled || !res.filePaths?.[0]) return { ok: false };

  const selected = res.filePaths[0];
  try {
    ensureDir(selected);
    const s = readSettings();
    writeSettings({ ...s, dataDir: selected });
    appendAudit({ type: "SET_DATA_DIR", dataDir: selected });
    return { ok: true, dataDir: selected };
  } catch (e) {
    console.log("[pickDataDir-err]", e);
    return { ok: false };
  }
});

ipcMain.handle("pdv:readJson", async (_event, name) => {
  if (!ALLOWED_FILES.has(name)) throw new Error("Arquivo inválido.");
  return safeReadJson(name, defaultFallback(name));
});

ipcMain.handle("pdv:writeJson", async (_event, name, data) => {
  if (!ALLOWED_FILES.has(name)) throw new Error("Arquivo inválido.");

  // escreve em fila para esse arquivo
  return enqueueWrite(name, async () => {
    const ok = safeWriteJson(name, data);
    appendAudit({ type: "WRITE_JSON", name, hash: sha1(JSON.stringify(data)) });
    return ok;
  });
});

/** =========================
 *  Export / Import (base pronta)
 *  - Exporta um "backup.json" (por enquanto)
 *  - Depois a gente troca pra ZIP (com adm-zip ou jszip)
 *  ========================= */

ipcMain.handle("pdv:exportBackup", async () => {
  const res = await dialog.showSaveDialog({
    title: "Exportar Backup do PDV",
    defaultPath: path.join(getDataDir(), `pdv-backup-${Date.now()}.json`),
    filters: [{ name: "Backup JSON", extensions: ["json"] }],
  });

  if (res.canceled || !res.filePath) return { ok: false };

  const payload = {
    meta: {
      appName: "pdv-simples",
      exportedAt: new Date().toISOString(),
      dataDir: getDataDir(),
      files: Array.from(ALLOWED_FILES),
    },
    data: {
      products: safeReadJson("products", defaultFallback("products")),
      sales: safeReadJson("sales", defaultFallback("sales")),
      stock: safeReadJson("stock", defaultFallback("stock")),
      users: safeReadJson("users", defaultFallback("users")),
      audit: safeReadJson("audit", defaultFallback("audit")),
      settings: safeReadJson("settings", defaultFallback("settings")),
    },
  };

  try {
    atomicWriteFileSync(res.filePath, JSON.stringify(payload, null, 2));
    appendAudit({ type: "EXPORT_BACKUP", file: res.filePath });
    return { ok: true, filePath: res.filePath };
  } catch (e) {
    console.log("[exportBackup-err]", e);
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle("pdv:importBackup", async () => {
  const res = await dialog.showOpenDialog({
    title: "Importar Backup do PDV",
    properties: ["openFile"],
    filters: [{ name: "Backup JSON", extensions: ["json"] }],
  });

  if (res.canceled || !res.filePaths?.[0]) return { ok: false };

  const file = res.filePaths[0];
  try {
    const raw = fs.readFileSync(file, "utf-8");
    const payload = JSON.parse(raw);

    // validação mínima (depois a gente endurece)
    if (!payload?.data) throw new Error("Backup inválido: sem campo data.");

    // backup automático antes de importar (no dataDir atual)
    const autoBackup = path.join(getDataDir(), `auto-backup-${Date.now()}.json`);
    atomicWriteFileSync(
      autoBackup,
      JSON.stringify(
        {
          meta: { autoBackupAt: new Date().toISOString() },
          data: {
            products: safeReadJson("products", defaultFallback("products")),
            sales: safeReadJson("sales", defaultFallback("sales")),
            stock: safeReadJson("stock", defaultFallback("stock")),
            users: safeReadJson("users", defaultFallback("users")),
            audit: safeReadJson("audit", defaultFallback("audit")),
            settings: safeReadJson("settings", defaultFallback("settings")),
          },
        },
        null,
        2
      )
    );

    // escreve em fila (sequencial)
    await enqueueWrite("products", async () =>
      safeWriteJson("products", payload.data.products ?? defaultFallback("products"))
    );
    await enqueueWrite("sales", async () =>
      safeWriteJson("sales", payload.data.sales ?? defaultFallback("sales"))
    );
    await enqueueWrite("stock", async () =>
      safeWriteJson("stock", payload.data.stock ?? defaultFallback("stock"))
    );
    await enqueueWrite("users", async () =>
      safeWriteJson("users", payload.data.users ?? defaultFallback("users"))
    );
    await enqueueWrite("settings", async () =>
      safeWriteJson("settings", payload.data.settings ?? defaultFallback("settings"))
    );

    appendAudit({ type: "IMPORT_BACKUP", file, autoBackup });
    return { ok: true, filePath: file, autoBackup };
  } catch (e) {
    console.log("[importBackup-err]", e);
    return { ok: false, error: String(e?.message || e) };
  }
});

/** =========================
 *  Janela + Next
 *  ========================= */

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#0a0a0a",
    autoHideMenuBar: true,
    icon: path.join(
      app.isPackaged ? process.resourcesPath : process.cwd(),
      "public",
      "logo.png"
    ),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 👇 depois a gente troca para /login e redireciona por role
  const url = `http://127.0.0.1:${NEXT_PORT}/dashboard/pdv`;
  mainWindow.loadURL(url);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

async function startNext() {
  const appPath = app.isPackaged ? process.resourcesPath : process.cwd();

  nextProcess = spawn(
    process.platform === "win32" ? "node.exe" : "node",
    [path.join(appPath, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(NEXT_PORT)],
    {
      cwd: appPath,
      env: { ...process.env, NODE_ENV: "production" },
      stdio: "pipe",
      windowsHide: true,
    }
  );

  nextProcess.stdout.on("data", (d) => console.log("[next]", d.toString()));
  nextProcess.stderr.on("data", (d) => console.log("[next-err]", d.toString()));
}

app.whenReady().then(async () => {
  await startNext();
  setTimeout(() => createWindow(), isDev ? 1200 : 1800);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (nextProcess) nextProcess.kill();
  if (process.platform !== "darwin") app.quit();
});