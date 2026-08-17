{
  "log": {
    "level": "warn",
    "timestamp": true
  },
  "dns": {
    "servers": [],
    "rules": [],
    "final": "local_dns",
    "strategy": "prefer_ipv4"
  },
  "inbounds": [],
  "outbounds": [
    {
      "type": "direct",
      "tag": "direct"
    },
    {
      "type": "block",
      "tag": "block"
    }
  ],
  "route": {
    "default_domain_resolver": "local_dns",
    "rules": [],
    "final": "block"
  }
}
