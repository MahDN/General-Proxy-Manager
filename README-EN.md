# General Proxy Manager (SingMP-Gen)

English | [简体中文](/README.md) | [فارسی](/README-FA.md)

A universal multi-port local gateway configuration generator built for **sing-box 1.13.18**.

A lightweight, privacy-first web application that allows users to import $N$ independent remote proxy nodes and generate $N$ isolated local proxy endpoints (each port strictly mapped to a dedicated proxy outbound and an isolated DNS path).

---

## 🎯 Core Purpose & Problem Solved

In scenarios such as multi-account operations, API endpoint routing (e.g. **NVIDIA NIM API** instances, multiple **OpenCode** workspaces), web scraping, and automated integration testing, applications often require simultaneous outgoing requests through distinct proxy IP addresses.

Traditional proxy clients typically only expose a single global proxy port. **General Proxy Manager** establishes a deterministic 1:1 port-to-proxy architecture:

```
LOCAL PROXY PORT
        ↓
SING-BOX INBOUND (Mixed: SOCKS5 / HTTP)
        ↓
EXACTLY ONE OUTBOUND (Strict 1:1)
        ↓
REMOTE PROXY
        ↓
INTERNET
```

### Mapping Example:
- `127.0.0.1:10808` → `proxy-in-01` → `proxy-out-01` (Proxy Node 1)
- `127.0.0.1:10809` → `proxy-in-02` → `proxy-out-02` (Proxy Node 2)
- `127.0.0.1:10810` → `proxy-in-03` → `proxy-out-03` (Proxy Node 3)
- ...
- `127.0.0.1:(10808 + N - 1)` → `proxy-in-N` → `proxy-out-N` (Proxy Node N)

Each local port functions as an independent proxy gateway. There is no accidental cross-routing and no silent direct fallback (`route.final = "block"`).

---

## ✨ Key Features

- **Strict 1:1 Inbound-to-Outbound Isolation**: Every enabled proxy node receives a dedicated local port, with routing rules strictly mapping each inbound to its corresponding outbound.
- **Target Engine Standard**: Built for and verified against **sing-box 1.13.18** (`SUPPORTED_SING_BOX_VERSION = "1.13.18"`).
- **Dual Protocol Support (Mixed Inbound)**: Each port simultaneously supports **SOCKS5** and **HTTP** proxy protocols.
- **Robust DNS Architecture**:
  - **Bootstrap DNS (`local_dns`)**: Directly resolves proxy server hostnames using bootstrap DNS to avoid cyclic dependencies.
  - **Per-Proxy DNS Detour (`dns-proxy-XX`)**: DNS queries for each proxy's traffic are encapsulated through that specific proxy's outbound tunnel (`detour`).
  - **IPv4-First Strategy (`prefer_ipv4`)**: Avoids connection timeouts in environments without reliable IPv6 connectivity.
- **Full Node Field Preservation**: Deep clones imported VLESS nodes, fully preserving Reality, WebSocket, gRPC, Vision, uTLS, multiplex, and other parameters.
- **Privacy-First (No Third-Party Leakage)**:
  - 100% client-side parsing and generation. No telemetry, no remote servers.
  - Direct browser fetch for subscriptions without using public third-party CORS proxy scrapers.
- **Client-Side Structural Validation**: Automatically validates port ranges, uniqueness, and structural compliance before generating or downloading `config.json`.

---

## 🔒 DNS Leak & Protocol Notice (Important)

This tool configures **Proxy Mode**, not TUN (Virtual Network Adapter) Mode.

sing-box can only manage network and DNS traffic directed to its configured listening ports. To ensure remote DNS resolution occurs through the remote proxy:

- **SOCKS5 (Recommended `socks5h://`)**: Use `socks5h://` in URLs or clients to delegate domain resolution to the remote proxy.
- **HTTP Proxy**: Standard HTTP CONNECT proxying naturally delegates hostname resolution to the proxy endpoint.

> [!WARNING]
> If a client application resolves domain names using the host OS's local DNS resolver before initiating a connection, DNS queries may bypass the proxy. For system-wide DNS interception, use a full TUN mode solution.

---

## 💻 Usage & Code Examples

### 1. cURL Command Line

Using SOCKS5h (Remote DNS):
```bash
# Via Proxy 01
curl --proxy socks5h://127.0.0.1:10808 https://api.ipify.org

# Via Proxy 02
curl --proxy socks5h://127.0.0.1:10809 https://api.ipify.org
```

Using HTTP Proxy:
```bash
curl --proxy http://127.0.0.1:10808 https://api.ipify.org
```

---

### 2. Python (Requests / HTTPX / NVIDIA NIM API)

```python
import requests

# Client A routes through Proxy 01
proxies_node1 = {
    "http": "http://127.0.0.1:10808",
    "https": "http://127.0.0.1:10808"
}
resp1 = requests.get("https://api.ipify.org?format=json", proxies=proxies_node1)
print("Proxy 01 Public IP:", resp1.json()["ip"])

# Client B routes through Proxy 02
proxies_node2 = {
    "http": "http://127.0.0.1:10809",
    "https": "http://127.0.0.1:10809"
}
resp2 = requests.get("https://api.ipify.org?format=json", proxies=proxies_node2)
print("Proxy 02 Public IP:", resp2.json()["ip"])
```

Using SOCKS5h in Python:
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

const agent = new HttpsProxyAgent('http://127.0.0.1:10808');
const res = await fetch('https://api.ipify.org?format=json', { agent });
const data = await res.json();
console.log('IP via Proxy 01:', data.ip);
```

---

## 🚀 Running Locally

Because modern browsers restrict ES Module loading and `fetch()` on `file://` URLs, serve the folder with a simple local server:

### Using Python:
```bash
# Python 3
python -m http.server 8000
```

### Using Node.js:
```bash
npx serve .
```

Open your browser at `http://localhost:8000`.

---

## 🧪 Automated Testing

The project includes an automated test suite covering all 24+ test cases and validating generated configurations against the `sing-box 1.13.18` binary:

```bash
npm test
```

Test coverage includes:
- Single-node and 10-node multi-port generation
- Duplicate and out-of-range port validation
- Collision resistance for duplicate or non-standard node tags
- Bootstrap DNS rules for hostnames vs. IP literals
- Full preservation of VLESS Reality, WebSocket, and gRPC parameters
- Strict 1:1 inbound-to-outbound routing and DNS detour isolation
- Disabled node handling (no active listener generated)
- `sing-box check` schema verification using the official 1.13.18 binary

---

## 📄 License

Distributed under the [MIT License](https://opensource.org/licenses/MIT).