# Windows Resource Monitor Widget / Windows 資源監控小工具

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Platform](https://img.shields.io/badge/platform-Windows-0078D6.svg) ![Electron](https://img.shields.io/badge/built%20with-Electron-47848F.svg)

![Widget Screenshot](assets/screenshot.png)

**[English]**
A beautiful, transparent desktop widget for monitoring system resources on Windows. Built with Electron, it provides real-time statistics for your CPU, RAM, and GPUs in a sleek, non-intrusive interface with glassmorphism effects.

**[繁體中文]**
一個美觀、透明的 Windows 桌面資源監控小工具。使用 Electron 構建，以時尚且不干擾的介面提供 CPU、RAM 和顯示卡 (GPU) 的即時狀態監控，並採用了現代化的毛玻璃特效設計。

---
## 📅 Changelog (v1.0.28) / 更新日誌

### 🇬🇧 English
*   **New Feature**: **Disk Monitoring** added! Now tracks Hard Drive usage.
*   **New Feature**: **Seamless "Run on Startup"**. Uses Windows Task Scheduler to bypass UAC prompts on boot.
*   **Enhancement**: App now forces **Administrator Privileges** to ensure accurate hardware readings.
*   **Enhancement**: **Portable Mode Support**. "Run on Startup" now works perfectly even with the portable `.exe` version.
*   **UI Update**: Increased default window height to accommodate new stats. New purple theme for Disk cards.

### 🇹🇼 繁體中文
*   **新功能**：新增 **硬碟監控 (Disk Monitoring)**！現在可以查看硬碟使用量與剩餘空間。
*   **新功能**：**無感開機自動啟動**。改用 Windows 工作排程器技術，開機時自動以管理員身分執行，且**不會跳出 UAC 詢問視窗**。
*   **改進**：強制程式以 **系統管理員身分** 執行，確保能讀取到最完整的硬體資訊。
*   **改進**：**支援免安裝版 (Portable)** 開機啟動。現在即使是單一執行檔版本，也能正常設定開機自動執行。
*   **介面更新**：增加預設視窗高度以容納新資訊，並為硬碟區塊採用了全新的紫色系設計。

---

## ✨ Features / 功能特色

### 🇬🇧 English
*   **Real-time Monitoring**: Track CPU usage, Temperature, RAM usage, Hard Drive, and GPU stats (Load, Temp, Memory).
*   **Modern Design**: Glassmorphism effect with adjustable opacity to blend perfectly with your desktop.
*   **Fully Customizable**: 
    *   **Resize**: Drag the bottom-right corner to resize (Min: 300x450).
    *   **Opacity**: Slider to adjust transparency.
    *   **Draggable**: Move it anywhere on your screen.
*   **System Tray Integration**: Minimizes to the system tray to keep your taskbar clean.
*   **Auto-Start**: Built-in toggle to launch automatically with Windows.
*   **Debug Mode**: Integrated debug panel for troubleshooting.

### 🇹🇼 繁體中文
*   **即時監控**：追蹤 CPU 使用率、溫度、記憶體 (RAM)、硬碟 (Disk) 使用量以及顯示卡 (GPU) 狀態（負載、溫度、顯存）。
*   **現代化設計**：毛玻璃特效 (Glassmorphism)，並可調整透明度，完美融入您的桌面背景。
*   **高度客製化**：
    *   **調整大小**：拖曳右下角即可調整視窗大小 (最小限制: 300x450)。
    *   **透明度**：透過滑桿自由調整視窗透明度。
    *   **可拖曳**：按住標題列即可將小工具移動到螢幕任何位置。
*   **系統列整合**：程式可縮小至右下角系統列 (System Tray)，保持工作列整潔。
*   **開機啟動**：內建開機自動執行選項。
*   **除錯模式**：內建 Debug 面板方便排查問題。

---

## 🚀 Installation / 安裝教學

1.  Download the latest `.exe` from the **[Releases](https://github.com/SimonSun1988/windows-resource-monitor/releases)** page.
2.  Run `ResourceMonitor Setup 1.0.28.exe`.
3.  The widget will appear on your desktop.
4.  **Right-click** on the system tray icon to quit completely.

1.  從 **[Releases](https://github.com/SimonSun1988/windows-resource-monitor/releases)** 頁面下載最新的 `.exe` 檔。
2.  執行 `ResourceMonitor Setup 1.0.28.exe`。
3.  小工具將會出現在您的桌面上。
4.  在右下角系統列圖示上**點擊右鍵**可完全關閉程式。

---

## 🛠️ Development / 開發指南

### Prerequisites / 前置需求
*   Node.js (v16+)
*   npm or yarn

### Build Locally / 本地構建

```bash
# Clone the repository / 複製專案
git clone https://github.com/SimonSun1988/windows-resource-monitor.git

# Enter directory / 進入目錄
cd windows-resource-monitor

# Install dependencies / 安裝依賴
npm install

# Run in development mode / 執行開發模式
npm run start

# Build portable executable / 打包成執行檔
npm run dist
```

---

## 💬 Feedback & Issues / 問題與建議

**[English]**
If you encounter any bugs, have feature requests, or want to give suggestions, please open an issue on GitHub. Your feedback is highly appreciated!
*   **Create an Issue**: [https://github.com/SimonSun1988/windows-resource-monitor/issues](https://github.com/SimonSun1988/windows-resource-monitor/issues)

**[繁體中文]**
如果您在使用過程中遇到任何問題 (Bug)、想要建議新功能，或是對專案有任何想法，歡迎在 GitHub 上建立 Issue 告訴我。非常感謝您的回饋！
*   **建立 Issue**: [https://github.com/SimonSun1988/windows-resource-monitor/issues](https://github.com/SimonSun1988/windows-resource-monitor/issues)

---

## ☕ Support / 贊助與支持

**[English]**
If you find this tool useful, consider buying me a coffee! Your support keeps the updates coming.

**[繁體中文]**
如果您覺得這個工具對您有幫助，歡迎贊助我喝杯咖啡！您的支持是我更新的最大動力。

**USDT (TRC20)**:
```text
TXgTPBAZHReyotf8tjUm31aJwqxjktnRFL
```

---

## 📝 License

This project is licensed under the MIT License.
專案代碼採用 MIT 授權條款開源。
