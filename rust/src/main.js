const invoke = window.__TAURI__.core.invoke;

const closeBtn = document.getElementById('closeBtn');
const opacitySlider = document.getElementById('opacitySlider');
const body = document.body;
const container = document.querySelector('.container');
const gpuWrapper = document.getElementById('gpu-wrapper');
const startupToggle = document.getElementById('startupToggle');
const diskWrapper = document.getElementById('disk-wrapper'); // Added missing reference

let staticData = null;

// Close App
closeBtn.addEventListener('click', () => {
  invoke('close_app');
});

// Opacity Logic
opacitySlider.addEventListener('input', (e) => {
  const val = e.target.value;
  const opacity = val / 100;
  container.style.setProperty('--bg-color', `rgba(20, 20, 25, ${opacity})`);

  if (opacity < 0.6) {
    if (!body.classList.contains('high-contrast')) body.classList.add('high-contrast');
  } else {
    if (body.classList.contains('high-contrast')) body.classList.remove('high-contrast');
  }
});

// Debug Toggle Logic
const debugToggle = document.getElementById('debugToggle');
const debugPanel = document.getElementById('debug-panel');
let isDebugVisible = false;

debugToggle.addEventListener('click', () => {
  isDebugVisible = !isDebugVisible;
  debugPanel.style.display = isDebugVisible ? 'block' : 'none';
  if (isDebugVisible) {
    document.body.classList.add('debug-visible');
    const debugContent = document.getElementById('debug-content');
    debugContent.scrollTop = debugContent.scrollHeight;
  } else {
    document.body.classList.remove('debug-visible');
  }
});

// Startup Toggle Logic
startupToggle.addEventListener('change', async (e) => {
  try {
    const newVal = await invoke('toggle_startup', { enable: e.target.checked });
    // Update UI to match actual result (in case of failure)
    e.target.checked = newVal;
  } catch (err) {
    console.error('Failed to toggle startup', err);
    addDebugLog(`Startup Error: ${err}`);
    e.target.checked = !e.target.checked; // Revert
  }
});

// Debug Panel Helper
const debugContent = document.getElementById('debug-content');
let debugLogs = [];
const MAX_DEBUG_LOGS = 50;

function addDebugLog(msg) {
  const timestamp = new Date().toLocaleTimeString();
  debugLogs.push(`[${timestamp}] ${msg}`);
  if (debugLogs.length > MAX_DEBUG_LOGS) {
    debugLogs.shift();
  }
  if (debugContent) {
    debugContent.textContent = debugLogs.join('\n');
    debugContent.scrollTop = debugContent.scrollHeight;
  }
}

// Initialization
async function init() {
  // 0. Get Startup Setting
  try {
    const isStartup = await invoke('get_startup_setting');
    startupToggle.checked = isStartup;
  } catch (e) {
    console.warn("Could not check startup setting", e);
  }

  // 1. Fetch Static Info (Run once)
  try {
    staticData = await invoke('get_static_data');
    addDebugLog("Static Data Loaded");
  } catch (e) {
    addDebugLog(`Static Data Error: ${e}`);
  }

  if (staticData) {
    // Set static text (Data is already cleaned by Main process)
    const cpuModelEl = document.getElementById('cpu-model');
    if (cpuModelEl) cpuModelEl.innerText = staticData.cpuModel.substring(0, 20);

    // Create GPU Cards
    if (gpuWrapper) {
      gpuWrapper.innerHTML = ''; // Clear
      staticData.gpus.forEach((gpu, index) => {
        const card = document.createElement('div');
        card.className = 'card gpu-card';
        card.id = `gpu-card-${index}`;

        // Determine Vendor for styling
        const vendorLower = gpu.vendor.toLowerCase();
        const modelLower = gpu.model.toLowerCase();
        let vendorClass = '';

        if (modelLower.includes('geforce') || modelLower.includes('nvidia') || modelLower.includes('rtx') || modelLower.includes('gtx') || modelLower.includes('quadro')) {
          vendorClass = 'nvidia';
        }
        else if (modelLower.includes('radeon') || modelLower.includes('amd') || modelLower.includes('ryzen') || modelLower.includes('firepro')) {
          vendorClass = 'amd';
        }
        else if (modelLower.includes('intel') || modelLower.includes('arc') || modelLower.includes('uhd') || modelLower.includes('iris')) {
          vendorClass = 'intel';
        }
        else {
          if (vendorLower.includes('nvidia')) vendorClass = 'nvidia';
          else if (vendorLower.includes('amd') || vendorLower.includes('advanced micro')) vendorClass = 'amd';
          else if (vendorLower.includes('intel')) vendorClass = 'intel';
        }

        if (vendorClass) card.setAttribute('data-vendor', vendorClass);

        card.innerHTML = `
          <div class="card-header">
             <div class="card-header-left">
               <svg class="icon" viewBox="0 0 24 24"><path d="M4,4H20A2,2 0 0,1 22,6V18A2,2 0 0,1 20,20H4A2,2 0 0,1 2,18V6A2,2 0 0,1 4,4M4,6V18H20V6H4M6,9H18V15H6V9Z" /></svg>
               <span class="label">GPU ${index + 1}</span>
             </div>
            <span class="value" id="gpu-load-${index}">0%</span>
          </div>
          <div class="bar-container">
            <div class="bar-fill" id="gpu-bar-${index}"></div>
          </div>
          <div class="sub-stat">
            <span title="${gpu.model}">${gpu.name}</span>
            <span class="sub-value" id="gpu-temp-${index}">--°C</span>
          </div>
        `;
        gpuWrapper.appendChild(card);
      });
    }
  }

  // Start polling
  scheduleUpdate();
}

function scheduleUpdate() {
  updateStats().finally(() => {
    setTimeout(scheduleUpdate, 2000);
  });
}

function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function updateStats() {
  return invoke('get_dynamic_data').then(stats => {
    if (!stats) return;

    // CPU
    const cpuLoad = Math.round(stats.cpuLoad);
    const cpuTemp = Math.round(stats.cpuTemp);

    const cpuLoadEl = document.getElementById('cpu-load');
    const cpuBar = document.getElementById('cpu-bar');
    const cpuTempEl = document.getElementById('cpu-temp');

    if (cpuLoadEl) cpuLoadEl.innerText = `${cpuLoad}%`;
    if (cpuBar) {
      cpuBar.style.width = `${cpuLoad}%`;
      // Critical Pulse
      if (cpuLoad > 85) cpuBar.parentElement.parentElement.classList.add('critical');
      else cpuBar.parentElement.parentElement.classList.remove('critical');
    }
    if (cpuTempEl) cpuTempEl.innerText = cpuTemp > 0 ? `${cpuTemp}°C` : '--';

    // RAM
    const memUsedGB = (stats.memUsed / (1024 ** 3)).toFixed(1);
    const memTotalGB = (staticData ? (staticData.memTotal / (1024 ** 3)).toFixed(1) : 0);
    const memPercent = (stats.memUsed / (staticData ? staticData.memTotal : stats.memUsed)) * 100; // approximation if static missing

    const memUsedEl = document.getElementById('mem-used');
    const memBar = document.getElementById('mem-bar');
    const memTotalEl = document.getElementById('mem-total');

    if (memUsedEl) memUsedEl.innerText = `${memUsedGB} GB`;
    if (memBar) memBar.style.width = `${memPercent}%`;
    if (staticData && memTotalEl) memTotalEl.innerText = `${memTotalGB} GB`;

    // GPUs
    if (stats.gpus && stats.gpus.length > 0) {
      stats.gpus.forEach((gpu, index) => {
        // If dynamic gpu list is different (e.g. nvidia-smi vs static), index might drift?
        // We assume consistency for now.
        const loadEl = document.getElementById(`gpu-load-${index}`);
        const barEl = document.getElementById(`gpu-bar-${index}`);
        const tempEl = document.getElementById(`gpu-temp-${index}`);

        if (loadEl && barEl) {
          const load = Math.round(gpu.utilization);
          const temp = Math.round(gpu.temperature);

          loadEl.innerText = `${load}%`;
          barEl.style.width = `${load}%`;

          if (tempEl) tempEl.innerText = temp > 0 ? `${temp}°C` : '--';
        }
      });
    }

    // Disks
    if (diskWrapper && stats.disks && stats.disks.length > 0) {
      const validDisks = stats.disks; // Backend already filtered > 1GB

      validDisks.forEach((disk, index) => {
        let card = document.getElementById(`disk-card-${index}`);
        if (!card) {
          card = document.createElement('div');
          card.className = 'card disk-card';
          card.id = `disk-card-${index}`;
          card.innerHTML = `
             <div class="card-header">
               <div class="card-header-left">
                 <svg class="icon" viewBox="0 0 24 24"><path d="M6,2H18A2,2 0 0,1 20,4V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V4A2,2 0 0,1 6,2M6,4V11H18V4H6M6,13V20H18V13H6M8,6H10V8H8V6M8,15H10V17H8V15Z" /></svg>
                 <span class="label">DISK (${disk.fs})</span>
               </div>
               <span class="value" id="disk-use-${index}">0%</span>
             </div>
             <div class="bar-container">
               <div class="bar-fill" id="disk-bar-${index}"></div>
             </div>
             <div class="sub-stat">
               <span id="disk-name-${index}">Used: ${formatBytes(disk.used)}</span>
               <span class="sub-value" id="disk-total-${index}">Total: ${formatBytes(disk.size)}</span>
             </div>
          `;
          diskWrapper.appendChild(card);
        }

        // Update
        const useEl = document.getElementById(`disk-use-${index}`);
        const barEl = document.getElementById(`disk-bar-${index}`);
        const usedEl = document.getElementById(`disk-name-${index}`);

        if (useEl && barEl) {
          const use = Math.round(disk.use_percent);
          useEl.innerText = `${use}%`;
          barEl.style.width = `${use}%`;
          if (usedEl) usedEl.innerText = `Used: ${formatBytes(disk.used)}`;
        }
      });
    }

  }).catch(err => {
    console.error(err);
    addDebugLog(`Update Error: ${err}`);
  });
}

init();
