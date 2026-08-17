# General Proxy Manager (通用代理网关管理器)

[English](/README.md) | 简体中文 | [فارسی](/README-FA.md)

基于 **sing-box 1.13.18** 的现代化多端口本地代理网关配置生成与管理面板。

一个纯前端、离线可用、隐私优先的 Web 工具，允许用户导入 $N$ 个独立的远程代理节点（支持 VLESS Reality/WS/gRPC、Base64 订阅与原始链接），并自动生成 $N$ 个互相严格隔离的本地代理端点（每个端口绑定唯一的代理出口与专属 DNS 隔离路径）。

---

## 🎯 核心概念与解决的痛点

在多账号运营、API 调用隔离（如 **NVIDIA NIM API**、多账号 **OpenCode** 实例）、网络爬虫开发、自动化测试等场景中，应用程序往往需要同时使用不同的代理 IP 发起请求。

传统代理客户端通常仅提供单一的全局监听端口，难以满足多端口分流的需求。**General Proxy Manager** 提供了确定性的 1:1 端口映射关系：

```
LOCAL PROXY PORT (本地端口)
        ↓
SING-BOX INBOUND (Mixed: SOCKS5 / HTTP)
        ↓
EXACTLY ONE OUTBOUND (严格单出站)
        ↓
REMOTE PROXY (远程代理)
        ↓
INTERNET
```

### 映射示例：
- `127.0.0.1:20808` → `proxy-in-01` → `proxy-out-01` (代理节点 1)
- `127.0.0.1:20809` → `proxy-in-02` → `proxy-out-02` (代理节点 2)
- `127.0.0.1:20810` → `proxy-in-03` → `proxy-out-03` (代理节点 3)
- ...
- `127.0.0.1:(20808 + N - 1)` → `proxy-in-N` → `proxy-out-N` (代理节点 N)

每个端口均独立运作，绝不发生跨端口串流，也绝不在代理断开时静默回退直连（`route.final = "block"`）。

---

## ✨ 核心特性 (v2.0)

- **严格 1:1 端口与出站隔离**：每个启用的代理节点独占一个本地监听端口，路由规则严格一一对应。
- **目标内核版本**：针对 **sing-box 1.13.18** 语法标准设计与验证（`SUPPORTED_SING_BOX_VERSION = "1.13.18"`）。
- **双协议兼容 (Mixed Inbound)**：每个端口同时支持 **SOCKS5** 与 **HTTP** 代理协议。
- **可视化流量流向图 (Visual Traffic Flow Diagram)**：动态直观展示所选节点的入站、路由引擎、出站与专属 DNS 隔离路径。
- **真实延迟测试 (Real-Delay Tester)**：支持批量生成 Windows (.bat) 与 Linux/macOS (.sh) 的 cURL 真实往返延迟测试脚本，以及面板内单端口实时探测。
- **暗黑/明亮主题切换 (Light & Dark Theme)**：专为夜间与白天使用优化的现代化 Glassmorphism 界面。
- **节点乱序、搜索与多列排序**：支持一键随机乱序 (Shuffle)、实时搜索过滤以及按名称、端口、延迟和出口 IP 快速排序。
- **完整保留节点原始配置**：深度克隆用户导入的 VLESS（包含 Reality、WebSocket、gRPC、Vision、uTLS、transport 等关键参数）。
- **隐私优先，100% 离线运行**：零外部 CDN 依赖，无需任何后端服务器，数据仅在用户浏览器本地处理。

---

## 💻 使用与调用示例

### 1. cURL 命令行

使用 SOCKS5h (远端解析 DNS):
```bash
# 通过代理节点 1
curl --proxy socks5h://127.0.0.1:20808 https://api.ipify.org

# 通过代理节点 2
curl --proxy socks5h://127.0.0.1:20809 https://api.ipify.org
```

使用 HTTP 代理:
```bash
curl --proxy http://127.0.0.1:20808 https://api.ipify.org
```

---

### 2. Python (Requests / HTTPX)

```python
import requests

# 客户端 A 经由端口 20808
proxies_node1 = {
    "http": "http://127.0.0.1:20808",
    "https": "http://127.0.0.1:20808"
}
resp1 = requests.get("https://api.ipify.org?format=json", proxies=proxies_node1)
print("Node 1 IP:", resp1.json()["ip"])

# 客户端 B 经由端口 20809
proxies_node2 = {
    "http": "http://127.0.0.1:20809",
    "https": "http://127.0.0.1:20809"
}
resp2 = requests.get("https://api.ipify.org?format=json", proxies=proxies_node2)
print("Node 2 IP:", resp2.json()["ip"])
```

---

## 📄 开源许可证与致谢 (License & Credits)

- 遵循 **MIT License** 开源许可证。
- 最初基于 `donald-laird/SingMP-Gen` 概念，由 **[MahDN](https://github.com/MahDN)** 进行全面重构、升级与深度开发 (v2.0)。
