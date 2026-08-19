# 🚀 General Proxy Manager (SingMP-Gen v2.0)

English | [فارسی](/README-FA.md) | [简体中文](/README-ZH.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Sing-Box Version](https://img.shields.io/badge/sing--box-1.13.18-emerald.svg)](https://github.com/SagerNet/sing-box)
[![Offline First](https://img.shields.io/badge/Dependencies-Zero%20External%20CDN-purple.svg)](#)
[![Tests Passing](https://img.shields.io/badge/Tests-35%2F35%20Passed-brightgreen.svg)](#)
[![Desktop App](https://img.shields.io/badge/Desktop-Tauri%20v2.0-indigo.svg)](#)

A modern, high-performance, offline-first multi-port proxy gateway configuration generator, desktop client, and local proxy manager for **sing-box 1.13.18+**.

Import $N$ independent remote proxy nodes (supporting **VLESS Reality / WS / gRPC**, **Trojan**, **Shadowsocks**, **Hysteria 2**, and **WireGuard**) and generate $N$ strictly isolated local proxy endpoints (each port uniquely mapped to a dedicated proxy outbound and an isolated DNS detour path). Available both as a **Native Desktop Application (Windows, Linux, macOS)** and as a **Zero-Install Web UI**.

---

## 📸 Interface Preview

### 1. Config Generator & Multi-Protocol Studio
![Config Generator](img/Config%20Generator.png)

### 2. Connection Health & Geo-IP Inspector
![Connection and IP Test](img/Connection%20and%20IP%20Test.png)

### 3. Desktop Engine Controller, Live Speedometer & Traffic Monitor
![Runner and Console](img/Runner%20and%20Console.png)

---

## 🎯 Core Problem Solved & Architecture

In scenarios such as multi-account automation, AI API load-balancing/isolation (e.g. **NVIDIA NIM API**, multiple **OpenCode** workspaces), web scraping, and QA integration testing, client applications require simultaneous outgoing requests across multiple distinct IP addresses.

Traditional proxy clients expose only a single global listening port. **General Proxy Manager** enforces deterministic 1:1 port-to-outbound mapping alongside an aggregated **Auto-Fastest Master Port**:

```
[PORT 20800: Master Auto-Fastest (URLTest)] ───► urltest (Selects Lowest Latency Node)
[PORT 20801: Proxy Node 01] ───► proxy-in-01 ───► proxy-out-01 ───► dns-proxy-01 ───► REMOTE NODE 1
[PORT 20802: Proxy Node 02] ───► proxy-in-02 ───► proxy-out-02 ───► dns-proxy-02 ───► REMOTE NODE 2
[PORT 20803: Proxy Node 03] ───► proxy-in-03 ───► proxy-out-03 ───► dns-proxy-03 ───► REMOTE NODE 3
...
[PORT 20800 + N]            ───► proxy-in-N  ───► proxy-out-N  ───► dns-proxy-N  ───► REMOTE NODE N
```

> [!IMPORTANT]
> **Zero Cross-Proxy Routing & Zero Silent Leaks**: Each port functions independently. If a remote proxy is down, traffic on that specific port is rejected rather than silently leaking through the direct host network (`route.final = "block"`).

---

## ✨ Features (v2.0)

- 🔒 **Strict 1:1 Inbound-to-Outbound Isolation**: Every proxy node gets a dedicated local port with matching inbound, outbound, route rule, and isolated DNS detour.
- ⚡ **Master Auto-Fastest Port (20800)**: Optional single aggregated port that automatically routes traffic to the lowest-latency node via periodic `urltest` health probes.
- 🌐 **Direct Multi-Protocol Support**: Parse share links and Base64 subscription blobs for:
  - **VLESS** (Reality, WebSocket, gRPC, HTTP, Vision, uTLS)
  - **Trojan** (TLS, SNI, WebSocket)
  - **Shadowsocks** (SIP002 and legacy base64 URI)
  - **Hysteria 2** (`hy2://` and `hysteria2://`)
  - **WireGuard** (`wg://` and `wireguard://`, mapped to sing-box 1.13.18 `endpoints`)
- 🖥️ **Desktop Native Engine Controller**: Start, stop, and restart background `sing-box` instances directly from the UI with real-time log streaming.
- 🚀 **One-Click Windows System Proxy**: Toggle system-wide proxy (`127.0.0.1:20800`) with instant WinINet cache notification without needing browser restarts.
- 📈 **Live Traffic & Speedometer Dashboard**: Real-time download/upload speed gauges and 60-second interactive HTML5 Canvas traffic wave chart.
- 🌍 **Geo-IP & Flag Detection**: Batch and individual latency probing with egress IP lookup and emoji country flags (e.g. 🇩🇪 Germany, 🇺🇸 United States).
- ⏹️ **Stop Test Control**: Instantly abort active batch test loops with a single click.
- 🔄 **Auto-Updater System**: On-demand and background checking for new GitHub releases with direct changelog preview.
- 🎨 **Modern Dark / Light Theme**: Glassmorphism aesthetic tailored for high-contrast usability.
- 🌍 **100% Offline Multi-Language Support**: Fully localized in **English**, **Persian (فارسی - RTL)**, and **Chinese (简体中文)**.
- 🧪 **35 Automated Unit Tests**: Comprehensive test suite verified against official `sing-box 1.13.18` schemas.

---

## 🚀 How to Run

### Method 1: Native Desktop Application (Recommended)

1. Download the pre-built desktop installer from **[GitHub Releases](https://github.com/MahDN/General-Proxy-Manager/releases/latest)**:
   - **Windows**: `.exe` (Setup) or `.msi`
   - **Linux**: `.AppImage` or `.deb`
   - **macOS**: `.dmg`
2. Run the application, import your proxy links, and click **🟢 Start Sing-Box** in the Runner tab.

#### Build Desktop App from Source:
```bash
# Install dependencies
npm install

# Run in Desktop Development Mode
npm run dev

# Build standalone binaries
npm run build
```

---

### Method 2: Web UI (Browser / GitHub Pages)

No build tools or heavy installations required. You can serve the static frontend with any standard HTTP server or open `index.html` directly:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js
npx serve .
```
Open `http://localhost:8000` in your web browser. All parsing, configuration generation, script downloads, and simulation testing run 100% client-side.

---

## 🧪 Running Unit Tests

```bash
npm test
```

---

## 💻 Code Examples & Integrations

### 1. cURL CLI
```bash
# Query through Proxy 01 via SOCKS5h (remote DNS)
curl.exe --proxy socks5h://127.0.0.1:20801 https://api.ipify.org?format=json

# Query through Auto-Fastest Master Port (20800)
curl.exe --proxy http://127.0.0.1:20800 https://api.ipify.org?format=json
```

### 2. Python (`requests` / `httpx`)
```python
import requests

# Worker 1 routed through Port 20801 (Node 1)
session1 = requests.Session()
session1.proxies = {
    "http": "http://127.0.0.1:20801",
    "https": "http://127.0.0.1:20801"
}
print("Worker 1 IP:", session1.get("https://api.ipify.org?format=json").json()["ip"])

# Worker 2 routed through Master Auto-Fastest Port (20800)
session_master = requests.Session()
session_master.proxies = {
    "http": "http://127.0.0.1:20800",
    "https": "http://127.0.0.1:20800"
}
print("Auto-Fastest IP:", session_master.get("https://api.ipify.org?format=json").json()["ip"])
```

---

## 📄 License & Attribution

- Released under the **[MIT License](LICENSE)**.
- Developed, engineered, and maintained by **[MahDN](https://github.com/MahDN)**.