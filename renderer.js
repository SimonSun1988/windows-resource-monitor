const closeBtn = document.getElementById('closeBtn');
const opacitySlider = document.getElementById('opacitySlider');
const body = document.body;
const container = document.querySelector('.container');
const gpuWrapper = document.getElementById('gpu-wrapper');
const startupToggle = document.getElementById('startupToggle');

let staticData = null;

closeBtn.addEventListener('click', () => {
  window.api.closeApp(); // Now minimizes to tray
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
    // Scroll to bottom when opening
    const debugContent = document.getElementById('debug-content');
    debugContent.scrollTop = debugContent.scrollHeight;
  } else {
    document.body.classList.remove('debug-visible');
  }
});

// Startup Toggle Logic
startupToggle.addEventListener('change', (e) => {
  window.api.toggleStartup(e.target.checked);
});

// Debug Panel
const debugContent = document.getElementById('debug-content');
let debugLogs = [];
const MAX_DEBUG_LOGS = 50;

function addDebugLog(msg) {
  const timestamp = new Date().toLocaleTimeString();
  debugLogs.push(`[${timestamp}] ${msg}`);
  if (debugLogs.length > MAX_DEBUG_LOGS) {
    debugLogs.shift();
  }
  debugContent.textContent = debugLogs.join('\n');
  debugContent.scrollTop = debugContent.scrollHeight;
}

// Listen for debug logs from main process
window.api.onDebugLog((msg) => {
  addDebugLog(`[MAIN] ${msg}`);
});

// Resizing Logic: Delegated to Main Process for Robustness
const resizeHandle = document.querySelector('.resize-handle');

resizeHandle.addEventListener('pointerdown', (e) => {
  addDebugLog(`[RENDERER] pointerdown on resize handle`);
  e.preventDefault();
  resizeHandle.setPointerCapture(e.pointerId);
  window.api.startResize();
});

resizeHandle.addEventListener('pointerup', (e) => {
  addDebugLog(`[RENDERER] pointerup on resize handle`);
  resizeHandle.releasePointerCapture(e.pointerId);
  window.api.stopResize();
});

// Safety fallback
resizeHandle.addEventListener('pointercancel', (e) => {
  addDebugLog(`[RENDERER] pointercancel on resize handle`);
  resizeHandle.releasePointerCapture(e.pointerId);
  window.api.stopResize();
});

async function init() {
  // 0. Get Startup Setting
  const isStartup = await window.api.getStartupSetting();
  startupToggle.checked = isStartup;

  // 1. Fetch Static Info (Run once)
  staticData = await window.api.getStaticData();

  if (staticData) {
    // Set static text (Data is already cleaned by Main process)
    document.getElementById('cpu-model').innerText = staticData.cpuModel.substring(0, 20);

    // Create GPU Cards
    gpuWrapper.innerHTML = ''; // Clear
    staticData.gpus.forEach((gpu, index) => {
      const card = document.createElement('div');
      card.className = 'card gpu-card';
      card.id = `gpu-card-${index}`;

      // Determine Vendor for styling
      const vendorLower = gpu.vendor.toLowerCase();
      const modelLower = gpu.model.toLowerCase();
      let vendorClass = '';

      // Check Model Name first (more reliable for custom cards like MSI RTX 5080)
      if (modelLower.includes('geforce') || modelLower.includes('nvidia') || modelLower.includes('rtx') || modelLower.includes('gtx') || modelLower.includes('quadro')) {
        vendorClass = 'nvidia';
      }
      else if (modelLower.includes('radeon') || modelLower.includes('amd') || modelLower.includes('ryzen') || modelLower.includes('firepro')) {
        vendorClass = 'amd';
      }
      else if (modelLower.includes('intel') || modelLower.includes('arc') || modelLower.includes('uhd') || modelLower.includes('iris')) {
        vendorClass = 'intel';
      }
      // Fallback to Vendor Field if model was generic
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

  // Start polling
  scheduleUpdate();
}

function scheduleUpdate() {
  updateStats().finally(() => {
    setTimeout(scheduleUpdate, 2000);
  });
}

function updateStats() {
  return window.api.getDynamicData().then(stats => {
    if (!stats) return;

    // CPU
    const cpuLoad = Math.round(stats.cpuLoad);
    const cpuTemp = Math.round(stats.cpuTemp);

    document.getElementById('cpu-load').innerText = `${cpuLoad}%`;
    const cpuBar = document.getElementById('cpu-bar');
    cpuBar.style.width = `${cpuLoad}%`;

    // Critical Pulse
    if (cpuLoad > 85) cpuBar.parentElement.parentElement.classList.add('critical');
    else cpuBar.parentElement.parentElement.classList.remove('critical');

    document.getElementById('cpu-temp').innerText = cpuTemp > 0 ? `${cpuTemp}°C` : '--';

    // RAM
    const memUsedGB = (stats.memUsed / (1024 ** 3)).toFixed(1);
    const memTotalGB = (staticData ? (staticData.memTotal / (1024 ** 3)).toFixed(1) : 0);
    const memPercent = (stats.memUsed / (staticData ? staticData.memTotal : stats.memUsed)) * 100; // approximation if static missing

    document.getElementById('mem-used').innerText = `${memUsedGB} GB`;
    document.getElementById('mem-bar').style.width = `${memPercent}%`;
    if (staticData) document.getElementById('mem-total').innerText = `${memTotalGB} GB`;

    // GPUs
    if (stats.gpus && stats.gpus.length > 0) {
      stats.gpus.forEach((gpu, index) => {
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
    const diskWrapper = document.getElementById('disk-wrapper');
    if (stats.disks && stats.disks.length > 0) {
      // Filter out small partitions/system reserved (e.g. < 1GB) or network drives if unwanted
      // Typically show main fixed drives.
      // si.fsSize returns array.
      const validDisks = stats.disks.filter(d => d.size > 1024 * 1024 * 1024); // > 1GB

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
        const totalEl = document.getElementById(`disk-total-${index}`);

        if (useEl && barEl) {
          const use = Math.round(disk.use);
          useEl.innerText = `${use}%`;
          barEl.style.width = `${use}%`;
          if (usedEl) usedEl.innerText = `Used: ${formatBytes(disk.used)}`;
          // Total usually doesn't change
        }
      });
    }

  }).catch(err => {
    console.error(err);
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

init();
