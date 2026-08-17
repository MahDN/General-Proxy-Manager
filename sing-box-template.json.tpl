{
  "log": {
    "level": "warn",
    "timestamp": true
  },
  "dns": {
    "servers": [
      // 1. 为每个需要指定出口的代理创建一个专属的DNS服务器
      // 注意 "detour" 参数直接指向了具体的出站节点 tag
      {
        "tag": "dns_inbound-0",
        "address": "tcp://8.8.8.8",
        "strategy": "prefer_ipv4",
        "detour": "out-10808"
      },
      // 本地直连DNS服务器保持不变
      {
        "tag": "local_dns",
        "type": "udp",
        "server": "223.5.5.5"
      }
    ],
    "rules": [
      // 2. 根据 inbound 标签来决定使用哪个DNS服务器
      // 这确保了从哪个端口进来的流量，其DNS查询也从对应的代理出口发出
      // 在 inbound 路由之前，也就是 rules 的最顶端，自动生成一条最高优先级的规则，规定所有这些代理服务器
      // 的域名都必须通过 local_dns（即直连）来解析，这样能防止为了连接代理服务器，需要解析代理服务器的域名，
      // 而解析这个域名的请求又被强制通过这个尚未连接的代理服务器发出，导致进入死循环
      { "inbound": "in-10808", "server": "dns_inbound-0" },
      
      // 其他规则可以保持，例如国内域名走本地DNS
      {
        "server": "local_dns",
        "rule_set": ["geosite-cn"]
      }
      
    ],
    // 3. 设置一个最终的兜底DNS服务器，防止有未匹配的查询
    "final": "dns_inbound-0"
  },
  "inbounds": [
    { "type": "mixed", "tag": "in-10808", "listen": "127.0.0.1", "listen_port": 10808 }
  ],
  "outbounds": [
    {
      "type": "hysteria2",
      "tag": "out-10808",
      "server": "",
      "server_port": 11111,
      "up_mbps": 100,
      "down_mbps": 100,
      "password": "",
      "tls": { "enabled": true, "server_name": "", "insecure": false, "alpn": ["h3"] }
    },
    { "type": "direct", "tag": "direct" },
    { "type": "block", "tag": "block" }
  ],
  "route": {
    "rules": [
      { "inbound": "in-10808", "outbound": "out-10808" },
      // clash_mode 规则现在可以指向默认的节点
      { "clash_mode": "Global", "outbound": "out-10808" },
      { "clash_mode": "Direct", "outbound": "direct" },
      { "rule_set": ["geoip-cn", "geosite-cn"], "outbound": "direct" },
      { "ip_is_private": true, "outbound": "direct" }
    ],
    "rule_set": [
      {
        "tag": "geoip-cn",
        "type": "remote",
        "format": "binary",
        "url": "https://ghfast.top/https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/refs/heads/sing/geo/geoip/cn.srs",
        "download_detour": "direct"
      },
      {
        "tag": "geosite-cn",
        "type": "remote",
        "format": "binary",
        "url": "https://ghfast.top/https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/refs/heads/sing/geo-lite/geosite/cn.srs",
        "download_detour": "direct"
      }
    ],
    // 5. final 兜底规则
    "final": "out-10808"
  },
  "experimental": {
    "clash_api": {
      "external_controller": "127.0.0.1:9090",
      "external_ui": "ui",
      "external_ui_download_url": "https://ghfast.top/https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip",
      "external_ui_download_detour": "direct"
    },
    "cache_file": {
      "enabled": true,
      "store_fakeip": true
    }
  }
}
