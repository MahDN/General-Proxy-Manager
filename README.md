# 🚀 General Proxy Manager (SingMP-Gen v2.0)

English | [فارسی](/README-FA.md) | [简体中文](/README-ZH.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Sing-Box Version](https://img.shields.io/badge/sing--box-1.13.18-emerald.svg)](https://github.com/SagerNet/sing-box)
[![Offline First](https://img.shields.io/badge/Dependencies-Zero%20External%20CDN-purple.svg)](#)
[![Tests Passing](https://img.shields.io/badge/Tests-27%2F27%20Passed-brightgreen.svg)](#)

A modern, offline-first, client-side multi-port proxy gateway configuration generator and local proxy manager for **sing-box 1.13.18+**.

Import $N$ independent remote proxy nodes (raw VLESS Reality/WS/gRPC/HTTP links, Base64 subscriptions, or full sing-box JSON configs) and automatically generate $N$ strictly isolated local proxy endpoints (each port uniquely mapped to a dedicated proxy outbound and an isolated DNS detour path).

---

## 🎯 Core Problem Solved & Architecture

In scenarios such as multi-account automation, API load-balancing/isolation (e.g. **NVIDIA NIM API**, multiple **OpenCode** AI workspaces), web scraping, and QA integration testing, client applications require simultaneous outgoing requests across multiple distinct IP addresses.

Traditional proxy clients expose only a single global listening port. **General Proxy Manager** enforces a deterministic 1:1 port-to-outbound mapping:

```
LOCAL PROXY PORT (e.g. 127.0.0.1:20808)
        ↓
SING-BOX INBOUND (Mixed: SOCKS5 + HTTP)
        ↓
STRICT ROUTING RULE (proxy-in-01 → proxy-out-01)
        ↓
ISOLATED DNS DETOUR (dns-proxy-01 dials proxy-out-01)
        ↓
REMOTE PROXY ENDPOINT
        ↓
TARGET DESTINATION / INTERNET
```

### Deterministic Port Mapping Example:
- `127.0.0.1:20808` → `proxy-in-01` → `proxy-out-01` (Node 1) &bull; DNS via `dns-proxy-01`
- `127.0.0.1:20809` → `proxy-in-02` → `proxy-out-02` (Node 2) &bull; DNS via `dns-proxy-02`
- `127.0.0.1:20810` → `proxy-in-03` → `proxy-out-03` (Node 3) &bull; DNS via `dns-proxy-03`
- ...
- `127.0.0.1:(20808 + N - 1)` → `proxy-in-N` → `proxy-out-N` (Node N)

> [!IMPORTANT]
> **Zero Cross-Proxy Routing & Zero Silent Leaks**: Each port functions independently. If a remote proxy is down, traffic on that specific port is rejected rather than silently leaking through the direct host network (`route.final = "block"`).

---

## ✨ Features (v2.0)

- 🔒 **Strict 1:1 Inbound-to-Outbound Isolation**: Every proxy node gets a dedicated local port with matching inbound, outbound, route rule, and isolated DNS detour.
- 🎯 **Target Engine Compliance**: Engineered and strictly validated for **sing-box 1.13.18** syntax.
- 🌐 **Mixed Inbound Protocol**: Each local port accepts both **SOCKS5** and **HTTP** connections simultaneously.
- 📊 **Visual Traffic Flow Diagram**: Interactive pipeline visualizing the exact path (Local Port → Routing Engine → Remote Node & DNS Detour) for any selected node.
- ⚡ **Real-Delay Latency Testing**:
  - Downloadable batch scripts for Windows (`.bat`) and Linux/macOS (`.sh`) utilizing `curl` to measure real TCP connect and round-trip times through local ports.
  - Manual single-port real-delay probe tool with one-click copyable cURL commands.
- 🎨 **Light & Dark Theme Switcher**: Modern Glassmorphism UI with curated palettes for day and night use.
- 🔀 **Shuffle, Search & Multi-Column Sorting**:
  - One-click random node shuffling (Fisher-Yates) with automatic port re-sequencing.
  - Live filtering by node name, host, port, or protocol.
  - Interactive table headers for sorting by index, name, local port, latency, or egress IP.
- 🏷️ **Custom Output Filenames**: User-defined base filenames for `[name].json`, `run-[name].bat`, and `test-real-delay-[name].bat`.
- 🛡️ **Robust Windows Runner Script**: Self-locating batch runner (`cd /d "%~dp0"`) with pre-flight port conflict checks (`netstat`) and error pause handlers.
- 🌍 **100% Offline Multi-Language Support**: Fully localized in **English**, **Persian (فارسی - RTL)**, and **Chinese (简体中文)** with zero external CDN dependencies.
- 🧪 **27 Automated Unit Tests**: Comprehensive Node.js test suite covering parser edge cases, Reality/WS/gRPC preservation, duplicate port validation, and sing-box binary syntax checks.

---

## 🔒 DNS Leak & Proxy Protocol Guidelines

This application configures **Proxy Mode** (SOCKS5/HTTP), not system-wide TUN mode.

To ensure DNS queries are resolved remotely through the proxy rather than by your local ISP resolver:
- **SOCKS5**: Use `socks5h://` (the trailing `h` instructs the client to delegate hostname resolution to the proxy).
- **HTTP Proxy**: Standard HTTP/HTTPS proxying (`http://127.0.0.1:port`) automatically delegates hostname resolution.

---

## 💻 Code Examples & Integrations

### 1. cURL CLI
```bash
# Query through Proxy 01 via SOCKS5h (remote DNS)
curl.exe --proxy socks5h://127.0.0.1:20808 https://api.ipify.org?format=json

# Query through Proxy 02 via HTTP Proxy
curl.exe --proxy http://127.0.0.1:20809 https://api.ipify.org?format=json
```

---

### 2. Python (`requests` / `httpx`)
```python
import requests

# Session 1 routed through Port 20808 (Node 1)
session1 = requests.Session()
session1.proxies = {
    "http": "http://127.0.0.1:20808",
    "https": "http://127.0.0.1:20808"
}
ip1 = session1.get("https://api.ipify.org?format=json").json()["ip"]
print(f"Worker 1 Egress IP: {ip1}")

# Session 2 routed through Port 20809 (Node 2)
session2 = requests.Session()
session2.proxies = {
    "http": "http://127.0.0.1:20809",
    "https": "http://127.0.0.1:20809"
}
ip2 = session2.get("https://api.ipify.org?format=json").json()["ip"]
print(f"Worker 2 Egress IP: {ip2}")
```

---

### 3. Node.js (`undici` / `axios` / `socks-proxy-agent`)
```javascript
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

// Worker A using SOCKS5 on port 20808
const agent1 = new SocksProxyAgent('socks5h://127.0.0.1:20808');
const res1 = await axios.get('https://api.ipify.org?format=json', { httpAgent: agent1, httpsAgent: agent1 });
console.log('Worker A IP:', res1.data.ip);
```

---

## 🚀 Running the Project Locally

No build tools or heavy dependencies required. You can serve the static files with any standard HTTP server:

```bash
# Python
python -m http.server 8000

# Node.js npx
npx serve .
```
Open `http://localhost:8000` in your web browser.

### Running Unit Tests
```bash
npm test
```

---

## 📄 License & Attribution

- Released under the **[MIT License](LICENSE)**.
- Originally inspired by `donald-laird/SingMP-Gen`, redesigned, refactored, and significantly expanded into **General Proxy Manager v2.0** by **[MahDN](https://github.com/MahDN)**.