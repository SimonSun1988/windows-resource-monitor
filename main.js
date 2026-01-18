const { app, BrowserWindow, ipcMain, screen, Tray, Menu } = require('electron');
const path = require('path');
const si = require('systeminformation');

let mainWindow;
let tray = null;
let isQuitting = false;

function createWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: 300,
    height: 450,
    x: width - 320,
    y: 50,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    resizable: true,
    minWidth: 300,
    minHeight: 450,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });

  mainWindow.loadFile('index.html');

  // Handle Close event - Minimize to tray instead of quit
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets/icon.png');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Resource Monitor',
      click: () => {
        mainWindow.show();
      }
    },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Windows Resource Monitor');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  // But for this widget, we want similar behavior on Windows via Tray
  if (process.platform !== 'darwin') {
    // We don't quit here anymore, we quit via Tray or explicit command
  }
});

// ... IPC Handlers for System Info (Keep get-static-data and get-dynamic-data as is) ...

// IPC: Startup Settings
ipcMain.handle('get-startup-setting', () => {
  const settings = app.getLoginItemSettings();
  return settings.openAtLogin;
});

ipcMain.handle('toggle-startup', (event, enable) => {
  app.setLoginItemSettings({
    openAtLogin: enable,
    path: app.getPath('exe') // Optional but good for reliability
  });
  return enable;
});

// IPC: Close App (Now just hides to tray unless fully quitting)
ipcMain.on('close-app', () => {
  if (mainWindow) mainWindow.hide();
});

// IPC: Get Window Bounds (for debug)
ipcMain.handle('get-window-bounds', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow.getBounds();
  }
  return null;
});

// Helper function to send debug logs to renderer
function sendDebugLog(msg) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('debug-log', msg);
  }
}

// IPC: Robust Resize (Main Process Polling)
let resizeInterval = null;
let isResizing = false;

ipcMain.on('start-resizing', (event) => {
  sendDebugLog(`[START] start-resizing received`);

  if (isResizing) {
    sendDebugLog(`[WARN] Already resizing, ignoring`);
    return;
  }

  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) {
    sendDebugLog(`[ERROR] Could not get window from event.sender`);
    return;
  }

  isResizing = true;
  const initialBounds = win.getBounds();
  sendDebugLog(`[INFO] Initial bounds: ${JSON.stringify(initialBounds)}`);

  if (resizeInterval) clearInterval(resizeInterval);

  resizeInterval = setInterval(() => {
    if (!win || win.isDestroyed() || !isResizing) {
      sendDebugLog(`[STOP] Interval stopped`);
      clearInterval(resizeInterval);
      resizeInterval = null;
      return;
    }

    const cursor = screen.getCursorScreenPoint();
    const bounds = win.getBounds();
    // const minSize = win.getMinimumSize(); // BUG: Returns current size on some transparent windows
    const minSize = [300, 450]; // Hardcoded safety limits

    // Explicitly ignore what the window thinks its minimum is
    const newWidth = Math.max(minSize[0], Math.round(cursor.x - bounds.x));
    const newHeight = Math.max(minSize[1], Math.round(cursor.y - bounds.y));

    sendDebugLog(`cursor:(${cursor.x},${cursor.y}) bounds:(${bounds.x},${bounds.y}) current:${bounds.width}x${bounds.height} -> target:${newWidth}x${newHeight} (hard-min:${minSize[0]}x${minSize[1]})`);

    // Force bounds update
    win.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: newWidth,
      height: newHeight
    });
  }, 100); // Slower for debugging
});

ipcMain.on('stop-resizing', () => {
  sendDebugLog(`[STOP] stop-resizing received`);
  isResizing = false;
  if (resizeInterval) {
    clearInterval(resizeInterval);
    resizeInterval = null;
  }
});

// Keep existing get-static-data and get-dynamic-data handlers below...

// IPC Handlers for System Info

// 1. Get Static Data (Run once on startup)
ipcMain.handle('get-static-data', async () => {
  try {
    const [cpu, mem, graphics] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.graphics()
    ]);

    // Filter GPUs: Remove 'Microsoft Basic Display Adapter' if others exist.
    // We want to support both NVIDIA and AMD.
    // Usually we want typical discrete cards or integrated if that's all there is.
    let controllers = graphics.controllers.filter(c =>
      !c.model.toLowerCase().includes('microsoft basic')
    );

    // If empty (fallback), use original
    if (controllers.length === 0) controllers = graphics.controllers;

    const gpus = controllers.map((g, index) => ({
      id: index,
      model: g.model,
      vendor: g.vendor,
      vram: g.memoryTotal
    }));

    return {
      cpuModel: `${cpu.manufacturer} ${cpu.brand}`,
      cpuCores: cpu.physicalCores,
      memTotal: mem.total,
      gpus: gpus
    };
  } catch (error) {
    console.error("Error fetching static stats:", error);
    return null;
  }
});

// 2. Get Dynamic Data (Run on interval)
// 2. Get Dynamic Data (Run on interval)
ipcMain.handle('get-dynamic-data', async () => {
  try {
    // Optimization: Run si calls and nvidia-smi in parallel
    // Also, use promisified exec to avoid blocking the event loop
    const util = require('util');
    const exec = util.promisify(require('child_process').exec);

    // Commands to run in parallel
    const siPromises = [
      si.currentLoad(),
      si.cpuTemperature(),
      si.mem(),
      si.graphics() // We still need this for AMD/Intel or if nvidia-smi fails
    ];

    // Function to fetch NVIDIA stats asynchronously
    const fetchNvidiaStats = async () => {
      try {
        const cmd = 'nvidia-smi --query-gpu=index,utilization.gpu,temperature.gpu,memory.used --format=csv,noheader,nounits';
        const { stdout } = await exec(cmd, { timeout: 1000 }); // 1s timeout
        return stdout;
      } catch (e) {
        return null;
      }
    };

    const [
      cpuLoad,
      temp,
      mem,
      graphics,
      nvidiaOutput
    ] = await Promise.all([
      ...siPromises,
      fetchNvidiaStats()
    ]);

    // GPU Handling logic
    let gpus = [];

    // Strategy A: systeminformation (si) Baseline
    let controllers = graphics.controllers.filter(c =>
      !c.model.toLowerCase().includes('microsoft basic')
    );
    if (controllers.length === 0) controllers = graphics.controllers;

    gpus = controllers.map(g => ({
      model: g.model,
      utilization: g.utilizationGpu || 0,
      temperature: g.temperatureGpu || 0,
      memoryUsed: g.memoryUsed || 0
    }));

    // Strategy B: Overlay NVIDIA-SMI Data (if available)
    if (nvidiaOutput) {
      const lines = nvidiaOutput.trim().split('\n');
      lines.forEach(line => {
        const parts = line.split(',').map(s => s.trim());
        if (parts.length >= 4) {
          const idx = parseInt(parts[0], 10);
          const load = parseFloat(parts[1]);
          const gpuTemp = parseFloat(parts[2]);
          const memVal = parseFloat(parts[3]) * 1024 * 1024; // MB to Bytes

          let nvidiaCounter = 0;
          for (let i = 0; i < gpus.length; i++) {
            const modelLower = gpus[i].model.toLowerCase();
            const isNvidia = modelLower.includes('nvidia') || modelLower.includes('geforce') || modelLower.includes('rtx') || modelLower.includes('gtx');

            if (isNvidia) {
              if (nvidiaCounter === idx) {
                gpus[i].utilization = load;
                gpus[i].temperature = gpuTemp;
                gpus[i].memoryUsed = memVal;
                break;
              }
              nvidiaCounter++;
            }
          }
        }
      });
    }

    return {
      cpuLoad: cpuLoad.currentLoad,
      cpuTemp: temp.main || temp.cores[0] || 0,
      memUsed: mem.used,
      gpus: gpus
    };
  } catch (error) {
    console.error("Error fetching dynamic stats:", error);
    return null;
  }
});

ipcMain.on('close-app', () => {
  app.quit();
});
