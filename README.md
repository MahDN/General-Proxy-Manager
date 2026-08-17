# General Proxy Manager (SingMP-Gen)

[English](/README-EN.md) | 简体中文 | [فارسی](/README-FA.md)

基于 **sing-box 1.13.18** 的通用多端口本地代理网关生成器。

一个纯前端、隐私优先的 Web 工具，允许用户导入 $N$ 个独立的远程代理节点，并自动生成 $N$ 个互相隔离的本地代理端点（每个端口绑定唯一的代理出口与专属 DNS 隔离路径）。

---

## 🎯 核心概念与解决的痛点

在多账号运营、API 调用隔离（如 **NVIDIA NIM API**、多账号 **OpenCode** 实例）、网络爬虫开发、自动化测试等场景中，应用程序往往需要同时使用不同的代理 IP 发起请求。

传统代理客户端通常仅提供单一的全局监听端口，难以满足多端口分流的需求。**General Proxy Manager** 提供了确定性的端口映射关系：

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
- `127.0.0.1:10808` → `proxy-in-01` → `proxy-out-01` (代理节点 1)
- `127.0.0.1:10809` → `proxy-in-02` → `proxy-out-02` (代理节点 2)
- `127.0.0.1:10810` → `proxy-in-03` → `proxy-out-03` (代理节点 3)
- ...
- `127.0.0.1:(10808 + N - 1)` → `proxy-in-N` → `proxy-out-N` (代理节点 N)

每个端口均独立运作，绝不发生跨端口串流，也绝不在代理断开时静默回退直连（`route.final = "block"`）。

---

## ✨ 核心特性

- **严格 1:1 端口与出站隔离**：每个启用的代理节点独占一个本地监听端口，路由规则严格一一对应。
- **目标内核版本**：针对 **sing-box 1.13.18** 语法标准设计与验证（`SUPPORTED_SING_BOX_VERSION = "1.13.18"`）。
- **双协议兼容 (Mixed Inbound)**：每个端口同时支持 **SOCKS5** 与 **HTTP** 代理协议，客户端按需连接即可。
- **安全健壮的 DNS 架构**：
  - **引导 DNS (`local_dns`)**：直连解析代理服务器本身的域名，防止因循环依赖导致启动失败。
  - **专属代理 DNS (`dns-proxy-XX`)**：每个入站流量的 DNS 请求均通过其对应的代理出站隧道发出 (`detour`)。
  - **IPv4 优先策略 (`prefer_ipv4`)**：有效避免在 IPv6 不稳定的网络环境下发生连接超时与故障。
- **完整保留节点原始配置**：深度克隆用户导入的 VLESS（包含 Reality、WebSocket、gRPC、Vision、uTLS 等关键参数），不篡改敏感字段。
- **隐私优先，零第三方依赖**：
  - 纯前端本地解析与生成，绝不上传节点数据。
  - 订阅直接由浏览器发起请求，杜绝使用可能泄露凭据的第三方 CORS 中转服务。
- **内置配置结构校验**：前端生成时自动执行完整结构验证，确保端口、标签、路由与 DNS 引用合法一致。

---

## 🔒 DNS 泄漏与协议说明（重要）

本项目工作在 **代理模式 (Proxy Mode)**，而非 TUN 虚拟网卡模式。

sing-box 仅能接管发送至其本地监听端口的流量与 DNS 请求。为确保远端域名解析通过代理通道完成，建议使用支持远端 DNS 解析的客户端协议：

- **SOCKS5 (推荐 `socks5h://`)**：使用 `socks5h://` 协议可指示客户端将域名交由代理端解析。
- **HTTP 代理**：标准 HTTP CONNECT 隧道会由代理端解析目标主机名。

> [!WARNING]
> 若客户端程序自行使用操作系统本地 DNS 解析目标 IP 后再通过 SOCKS5 连接，该部分 DNS 解析将发生在本地。如需全局网络拦截，请等待未来 TUN 模式支持。

---

## 💻 典型应用场景与代码示例

### 1. cURL 命令行

通过 SOCKS5h（远端 DNS 解析）：
```bash
# 使用 1 号代理
curl --proxy socks5h://127.0.0.1:10808 https://api.ipify.org

# 使用 2 号代理
curl --proxy socks5h://127.0.0.1:10809 https://api.ipify.org
```

通过 HTTP 代理：
```bash
curl --proxy http://127.0.0.1:10808 https://api.ipify.org
```

---

### 2. Python (Requests / HTTPX / NVIDIA NIM API)

```python
import requests

# 客户端 A 使用 1 号代理
proxies_node1 = {
    "http": "http://127.0.0.1:10808",
    "https": "http://127.0.0.1:10808"
}
resp1 = requests.get("https://api.ipify.org?format=json", proxies=proxies_node1)
print("Node 1 IP:", resp1.json()["ip"])

# 客户端 B 使用 2 号代理
proxies_node2 = {
    "http": "http://127.0.0.1:10809",
    "https": "http://127.0.0.1:10809"
}
resp2 = requests.get("https://api.ipify.org?format=json", proxies=proxies_node2)
print("Node 2 IP:", resp2.json()["ip"])
```

使用 SOCKS5h：
```python
proxies = {
    "http": "socks5h://127.0.0.1:10808",
    "https": "socks5h://127.0.0.1:10808"
}
```

---

### 3. Node.js

```javascript
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

const agent1 = new HttpsProxyAgent('http://127.0.0.1:10808');
const res = await fetch('https://api.ipify.org?format=json', { agent: agent1 });
const data = await res.json();
console.log('IP via Proxy 01:', data.ip);
```

---

## 🚀 本地运行指南

由于浏览器的安全策略（ES Module 与 fetch 限制），请通过本地 Web 服务器运行：

### 推荐：使用 Python
```bash
# Python 3
python -m http.server 8000
```

### 使用 Node.js
```bash
npx serve .
```

打开浏览器访问：`http://localhost:8000`

---

## 🧪 自动化测试

项目内置了针对核心生成逻辑与 sing-box 1.13.18 语法规范的完整测试套件（涵盖全部 24+ 测试用例）：

```bash
npm test
```

测试覆盖：
- 单节点 / 10 节点多端口生成
- 端口范围与重复校验
- 原始标签重名与特殊字符隔离
- 域名服务器引导解析与 IP 字面量优化
- VLESS Reality / WebSocket / gRPC 参数无损保留
- 严格 1:1 路由隔离与 DNS 路径映射
- 禁用节点不生成监听与出站
- sing-box 1.13.18 二进制运行时语法检查 (`sing-box check`)

---

## 📄 许可证

本项目基于 [MIT License](https://opensource.org/licenses/MIT) 开源。