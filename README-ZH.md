# General Proxy Manager (通用代理网关管理器 v2.0)

[English](/README.md) | 简体中文 | [فارسی](/README-FA.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Sing-Box Version](https://img.shields.io/badge/sing--box-1.13.18-emerald.svg)](https://github.com/SagerNet/sing-box)
[![Offline First](https://img.shields.io/badge/Dependencies-Zero%20External%20CDN-purple.svg)](#)
[![Tests Passing](https://img.shields.io/badge/Tests-35%2F35%20Passed-brightgreen.svg)](#)
[![Desktop App](https://img.shields.io/badge/Desktop-Tauri%20v2.0-indigo.svg)](#)

基于 **sing-box 1.13.18** 的现代化、高性能、离线多端口本地代理网关配置生成与管理桌面客户端。

支持直接导入 $N$ 个独立的远程代理节点（原生支持 **VLESS Reality / WS / gRPC**、**Trojan**、**Shadowsocks**、**Hysteria 2** 与 **WireGuard**），并自动生成 $N$ 个互相严格隔离的本地代理端点（每个端口绑定唯一的代理出口与专属 DNS 隔离路径）。同时提供 **跨平台桌面客户端 (Windows, Linux, macOS)** 与 **零安装 Web UI**。

---

## 📸 界面预览 (UI Showcase)

### 1. 配置生成器与多协议管理
![Config Generator](img/Config%20Generator.png)

### 2. 节点健康检测、真实延迟测试与 Geo-IP 国家识别
![Connection and IP Test](img/Connection%20and%20IP%20Test.png)

### 3. 桌面内核控制器、实时测速仪表盘与流量监控
![Runner and Console](img/Runner%20and%20Console.png)

---

## 🎯 核心概念与解决的痛点

在多账号运营、API 调用隔离（如 **NVIDIA NIM API**、多账号 **OpenCode** 实例）、网络爬虫开发、自动化测试等场景中，应用程序往往需要同时使用不同的代理 IP 发起请求。

传统代理客户端通常仅提供单一的全局监听端口。**General Proxy Manager** 提供了确定性的 1:1 端口映射关系与 **主智能优选聚合端口 (Auto-Fastest)**：

```
[端口 20800: 主智能优选端口 (URLTest)] ───► urltest (定期自动选择延迟最低节点)
[端口 20801: 代理节点 01] ───► proxy-in-01 ───► proxy-out-01 ───► dns-proxy-01 ───► 节点 1
[端口 20802: 代理节点 02] ───► proxy-in-02 ───► proxy-out-02 ───► dns-proxy-02 ───► 节点 2
[端口 20803: 代理节点 03] ───► proxy-in-03 ───► proxy-out-03 ───► dns-proxy-03 ───► 节点 3
...
[端口 20800 + N]          ───► proxy-in-N  ───► proxy-out-N  ───► dns-proxy-N  ───► 节点 N
```

> [!IMPORTANT]
> 每个端口均独立运作，绝不发生跨端口串流，也绝不在代理断开时静默回退直连（`route.final = "block"`）。

---

## ✨ 核心特性 (v2.0)

- 🔒 **严格 1:1 端口与出站隔离**：每个启用的代理节点独占一个本地监听端口，路由规则严格一一对应。
- ⚡ **主智能优选端口 (20800)**：聚合单端口，通过周期性 `urltest` 自动路由至延迟最低的节点。
- 🌐 **原生五大协议支持**：直接解析分享链接与 Base64 订阅：
  - **VLESS** (Reality, WebSocket, gRPC, HTTP, Vision, uTLS)
  - **Trojan** (TLS, SNI, WebSocket)
  - **Shadowsocks** (SIP002 与经典 Base64)
  - **Hysteria 2** (`hy2://` 与 `hysteria2://`)
  - **WireGuard** (`wg://` 与 `wireguard://`，完全适配 sing-box 1.13.18 `endpoints`)
- 🖥️ **桌面原生内核控制器**：面板内一键启动、停止、重启 sing-box，并查看实时日志流。
- 🚀 **一键设置 Windows 系统代理**：面板快捷开关，通过 WinINet 实时刷新网络配置，无需重启浏览器。
- 📈 **实时流量与测速仪表盘**：实时下载/上传速率、累计流量统计及 60 秒动态 HTML5 Canvas 波动波形图。
- 🌍 **Geo-IP 与国家国旗显示**：批量探测延迟、获取出口真实 IP 并显示国旗与国家名称（如 🇩🇪 Germany、🇺🇸 United States）。
- ⏹️ **停止测试控制 (Stop Test)**：一键即时中断正在执行的批量测速。
- 🔄 **自动更新检测系统**：基于 GitHub Releases API 自动或手动检查最新版本与更新日志。
- 🎨 **暗黑/明亮主题切换 (Light & Dark Theme)**：专为夜间与白天使用优化的现代化 Glassmorphism 界面。
- 🌍 **隐私优先，100% 离线运行**：零外部 CDN 依赖，支持英语、波斯语与简体中文。
- 🧪 **35 项自动化单元测试**：严格遵循官方 `sing-box 1.13.18` 规范验证。

---

## 🚀 运行与启动方式

### 方法 1：桌面客户端 (推荐)

1. 从 **[GitHub Releases](https://github.com/MahDN/General-Proxy-Manager/releases/latest)** 下载适用于您操作系统的安装包：
   - **Windows**: `.exe` (安装包) 或 `.msi`
   - **Linux**: `.AppImage` 或 `.deb`
   - **macOS**: `.dmg`
2. 打开程序，导入节点链接，在第三个标签页点击 **🟢 启动 Sing-Box** 即可。

#### 源码构建桌面端：
```bash
# 安装依赖
npm install

# 运行桌面开发模式
npm run dev

# 构建独立安装程序
npm run build
```

---

### 方法 2：Web 网页端 (浏览器 / GitHub Pages)

无需安装任何构建工具，使用任意静态 Web 服务器托管或直接打开 `index.html`：

```bash
# 使用 Python 3
python -m http.server 8000

# 使用 Node.js
npx serve .
```
在浏览器中访问 `http://localhost:8000`。

---

## 🧪 运行单元测试

```bash
npm test
```

---

## 💻 使用与调用示例

### 1. cURL 命令行
```bash
# 通过代理节点 1 (SOCKS5h)
curl.exe --proxy socks5h://127.0.0.1:20801 https://api.ipify.org?format=json

# 通过主智能优选端口 (20800)
curl.exe --proxy http://127.0.0.1:20800 https://api.ipify.org?format=json
```

### 2. Python (Requests / HTTPX)
```python
import requests

# 客户端 1 经由端口 20801
session1 = requests.Session()
session1.proxies = {"http": "http://127.0.0.1:20801", "https": "http://127.0.0.1:20801"}
print("Node 1 IP:", session1.get("https://api.ipify.org?format=json").json()["ip"])

# 客户端 2 经由主优选端口 20800
session_master = requests.Session()
session_master.proxies = {"http": "http://127.0.0.1:20800", "https": "http://127.0.0.1:20800"}
print("Auto-Fastest IP:", session_master.get("https://api.ipify.org?format=json").json()["ip"])
```

---

## 📄 开源许可证与致谢 (License & Credits)

- 遵循 **[MIT License](LICENSE)** 开源许可证。
- 由 **[MahDN](https://github.com/MahDN)** 进行架构设计、开发与维护。

