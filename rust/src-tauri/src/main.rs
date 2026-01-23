// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::process::Command;
use sysinfo::{Components, Disks, System};
use tauri::Manager;

// Data Structures

#[derive(Serialize)]
struct GpuData {
    model: String,
    name: String,
    vendor: String,
    vram: u64,
}

#[derive(Serialize)]
struct StaticData {
    cpuModel: String,
    cpuCores: usize,
    memTotal: u64,
    gpus: Vec<GpuData>,
}

#[derive(Serialize)]
struct DynamicGpuData {
    model: String,
    utilization: f32,
    temperature: f32,
    memoryUsed: u64,
}

#[derive(Serialize)]
struct DiskData {
    fs: String,
    use_percent: f32,
    used: u64,
    size: u64,
}

#[derive(Serialize)]
struct DynamicData {
    cpuLoad: f32,
    cpuTemp: f32,
    memUsed: u64,
    gpus: Vec<DynamicGpuData>,
    disks: Vec<DiskData>,
}

// Helper Functions

fn clean_cpu_name(name: &str) -> String {
    let mut n = name
        .replace("Intel", "")
        .replace("AMD", "")
        .replace("(R)", "")
        .replace("(TM)", "")
        .replace("Core", "")
        .replace("Processor", "")
        .replace("CPU", "")
        .trim()
        .to_string();
    
    // Remove extra spaces
    while n.contains("  ") {
        n = n.replace("  ", " ");
    }
    n
}

fn clean_gpu_name(model: &str) -> String {
    let mut name = model
        .replace("NVIDIA", "")
        .replace("AMD", "")
        .replace("Intel", "")
        .replace("(R)", "")
        .replace("(TM)", "")
        .replace("Corporation", "")
        .replace("Inc.", "")
        .replace("Co.", "")
        .replace("Ltd.", "")
        .replace("ASUS", "")
        .replace("Gigabyte", "")
        .replace("MSI", "")
        .replace("Micro-Star", "")
        .replace("EVGA", "")
        .replace("Zotac", "")
        .replace("Palit", "")
        .replace("Galax", "")
        .replace("PNY", "")
        .replace("Colorful", "")
        .replace("Inno3D", "")
        .replace("GeForce", "")
        .replace("Radeon", "")
        .replace("Arc", "")
        .replace("Graphics", "")
        .trim()
        .to_string();

    let original_lower = model.to_lowercase();
    if original_lower.contains("rtx") {
        name = format!("RTX {}", name.replace("RTX", "").trim());
    } else if original_lower.contains("gtx") {
        name = format!("GTX {}", name.replace("GTX", "").trim());
    } else if original_lower.contains("rx") {
        name = format!("RX {}", name.replace("RX", "").trim());
    }

    while name.contains("  ") {
        name = name.replace("  ", " ");
    }
    
    if name.len() < 3 {
        name = model.replace("(R)", "").replace("(TM)", "").trim().to_string();
    }
    
    name
}

fn get_nvidia_stats() -> Option<Vec<(usize, f32, f32, u64)>> {
    // Run nvidia-smi
    // index, utilization.gpu, temperature.gpu, memory.used
    #[cfg(target_os = "windows")]
    let output = Command::new("nvidia-smi")
        .args(&[
            "--query-gpu=index,utilization.gpu,temperature.gpu,memory.used",
            "--format=csv,noheader,nounits",
        ])
        .output()
        .ok()?;

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("nvidia-smi")
        .args(&[
             "--query-gpu=index,utilization.gpu,temperature.gpu,memory.used",
            "--format=csv,noheader,nounits",
        ])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut results = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split(',').collect();
        if parts.len() >= 4 {
            let index = parts[0].trim().parse::<usize>().unwrap_or(0);
            let util = parts[1].trim().parse::<f32>().unwrap_or(0.0);
            let temp = parts[2].trim().parse::<f32>().unwrap_or(0.0);
            let mem_mb = parts[3].trim().parse::<u64>().unwrap_or(0);
            results.push((index, util, temp, mem_mb * 1024 * 1024));
        }
    }

    Some(results)
}

// Commands

#[tauri::command]
fn get_static_data() -> StaticData {
    // In sysinfo 0.30, refresh calls are specific
    // We create a system and refresh specific parts
    let mut sys = System::new_all();
    sys.refresh_cpu(); 
    sys.refresh_memory();

    let cpu_global = sys.global_cpu_info();
    let cpu_brand = cpu_global.brand();
    let cpu_name = clean_cpu_name(cpu_brand);
    
    // Attempt to detect NVIDIA GPUs via nvidia-smi for static list
    let mut gpus = Vec::new();
    
    // Try nvidia-smi -L
    if let Ok(output) = Command::new("nvidia-smi").arg("-L").output() {
        let s = String::from_utf8_lossy(&output.stdout);
        // GPU 0: NVIDIA GeForce RTX 3080 (UUID: GPU-...)
        for (_i, line) in s.lines().enumerate() {
            if let Some(idx) = line.find(": ") {
                 if let Some(end) = line.find(" (UUID") {
                     let name_raw = &line[idx+2..end];
                     let name_clean = clean_gpu_name(name_raw);
                     gpus.push(GpuData {
                         model: name_raw.to_string(),
                         name: name_clean,
                         vendor: "NVIDIA".to_string(),
                         vram: 0 
                     });
                 }
            }
        }
    }

    StaticData {
        cpuModel: cpu_name,
        cpuCores: sys.physical_core_count().unwrap_or(1),
        memTotal: sys.total_memory(),
        gpus,
    }
}

#[tauri::command]
fn get_dynamic_data() -> DynamicData {
    let mut sys = System::new_all();
    sys.refresh_cpu();
    sys.refresh_memory();
    
    // Components (Temp) handling in sysinfo 0.30
    let components = Components::new_with_refreshed_list();
    
    // Disks handling in sysinfo 0.30
    let disks_list = Disks::new_with_refreshed_list();
    
    let cpu_load = sys.global_cpu_info().cpu_usage();
    
    // CPU Temp
    let mut cpu_temp = 0.0;
    for component in &components {
        // Simple heuristic for CPU temp
        let label = component.label().to_lowercase();
        if label.contains("cpu") || label.contains("package") || label.contains("core") {
            let t = component.temperature();
            if t > cpu_temp {
                cpu_temp = t;
            }
        }
    }
    
    let mem_used = sys.used_memory();
    
    // Disk Stats
    let mut disks = Vec::new();
    for disk in &disks_list {
         // Filter small disks 
         if disk.total_space() > 1024 * 1024 * 1024 {
             let used = disk.total_space() - disk.available_space();
             let use_percent = if disk.total_space() > 0 {
                 (used as f64 / disk.total_space() as f64 * 100.0) as f32
             } else {
                 0.0
             };
             
             disks.push(DiskData {
                 fs: disk.mount_point().to_string_lossy().to_string(), // On windows this is usually C:\ etc
                 use_percent,
                 used,
                 size: disk.total_space(),
             });
         }
    }

    // NVIDIA Stats
    let nvidia_stats = get_nvidia_stats();
    let mut dynamic_gpus = Vec::new();
    
    if let Some(stats) = nvidia_stats {
        let output = Command::new("nvidia-smi")
        .args(&[
            "--query-gpu=name,utilization.gpu,temperature.gpu,memory.used",
            "--format=csv,noheader,nounits",
        ])
        .output();
        
        if let Ok(o) = output {
             let s = String::from_utf8_lossy(&o.stdout);
             for line in s.lines() {
                 let parts: Vec<&str> = line.split(',').collect();
                 if parts.len() >= 4 {
                     dynamic_gpus.push(DynamicGpuData {
                         model: parts[0].trim().to_string(),
                         utilization: parts[1].trim().parse().unwrap_or(0.0),
                         temperature: parts[2].trim().parse().unwrap_or(0.0),
                         memoryUsed: parts[3].trim().parse::<u64>().unwrap_or(0) * 1024 * 1024,
                     });
                 }
             }
        }
    }
    
    DynamicData {
        cpuLoad: cpu_load,
        cpuTemp: cpu_temp,
        memUsed: mem_used,
        gpus: dynamic_gpus,
        disks,
    }
}

#[tauri::command]
fn toggle_startup(enable: bool) -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::env;
        let task_name = "WindowsResourceMonitorAutoStart";
        
        // We need the current executable path
        if let Ok(exe_path) = env::current_exe() {
            let exe_str = exe_path.to_string_lossy();
            
            if enable {
                 // Create Task
                 // schtasks /Create /TN "WindowsResourceMonitorAutoStart" /TR "\"C:\path\to\exe\"" /SC ONLOGON /RL HIGHEST /F
                 let _ = Command::new("schtasks")
                    .args(&[
                        "/Create",
                        "/TN", task_name,
                        "/TR", &format!("\"{}\"", exe_str),
                        "/SC", "ONLOGON",
                        "/RL", "HIGHEST",
                        "/F"
                    ])
                    .output();
                 return true;
            } else {
                 // Delete Task
                 let _ = Command::new("schtasks")
                    .args(&["/Delete", "/TN", task_name, "/F"])
                    .output();
                 return false;
            }
        }
    }
    
    // Default return definition for non-windows or failure
    enable
}

#[tauri::command]
async fn get_startup_setting() -> bool {
    #[cfg(target_os = "windows")]
    {
        let task_name = "WindowsResourceMonitorAutoStart";
        if let Ok(output) = Command::new("schtasks")
            .args(&["/Query", "/TN", task_name])
            .output() 
        {
            return output.status.success();
        }
    }
    false
}

#[tauri::command]
fn close_app(app_handle: tauri::AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.hide();
    }
}

// Main

use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    WindowEvent,
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Tray Setup
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show Resource Monitor", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::with_id("tray")
                .menu(&menu)
                .icon(app.default_window_icon().unwrap().clone())
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                         let app = tray.app_handle();
                         if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                         }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Prevent actual closing, just hide
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_static_data,
            get_dynamic_data,
            toggle_startup,
            get_startup_setting,
            close_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
