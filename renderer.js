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
    // Set static text
    // Fix: Regex was too aggressive (matching 'R' inside 'Ultra'). 
    // We want to remove "Intel", "AMD", "Core", "Processor" and garbage like (R), (TM).
    let cpuName = staticData.cpuModel
      .replace(/Intel|AMD/gi, '')
      .replace(/\(R\)/gi, '')
      .replace(/\(TM\)/gi, '')
      .replace(/Core/gi, '')
      .replace(/Processor/gi, '')
      .replace(/CPU/gi, '')
      .trim();

    // Remove extra spaces
    cpuName = cpuName.replace(/\s+/g, ' ');
    document.getElementById('cpu-model').innerText = cpuName.substring(0, 20); // Longer limit

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

      // Clean GPU Model Name
      // Example: "NVIDIA GeForce RTX 5080" -> "GeForce RTX 5080" or just "RTX 5080"
      // Example: "ASUS TUF Gaming GeForce RTX 4090" -> "RTX 4090"
      let modelName = gpu.model
        .replace(/NVIDIA|AMD|Intel/gi, '')
        .replace(/\(R\)/gi, '')
        .replace(/\(TM\)/gi, '')
        .replace(/Corporation|Inc\.|Co\.|Ltd\./gi, '')
        .replace(/ASUS|Gigabyte|MSI|Micro-Star|EVGA|Zotac|Palit|Galax|PNY|Colorful|Inno3D/gi, '') // Remove AIB Brands
        .replace(/GeForce|Radeon|Arc|Graphics/gi, '') // Optional: Remove generic prefixes if you want JUST model
        .trim();

      // Re-insert prefix if the result is too bare but we know the family
      const original = gpu.model.toLowerCase();
      if (original.includes('rtx')) modelName = 'RTX ' + modelName.replace(/RTX/i, '').trim();
      else if (original.includes('gtx')) modelName = 'GTX ' + modelName.replace(/GTX/i, '').trim();
      else if (original.includes('rx')) modelName = 'RX ' + modelName.replace(/RX/i, '').trim();

      // Clean up multiple spaces
      modelName = modelName.replace(/\s+/g, ' ').trim();

      // If result is empty or weird (like just "Graphics"), keep original or fallback
      if (modelName.length < 3) modelName = gpu.model.replace(/\(R\)|\(TM\)/gi, '').trim();

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
          <span title="${gpu.model}">${modelName}</span>
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

  }).catch(err => {
    console.error(err);
  });
}

init();
