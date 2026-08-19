/**
 * SingMP-Gen / General Proxy Manager - Core Configuration Generator
 * Target sing-box version: 1.13.18
 */

export const SUPPORTED_SING_BOX_VERSION = "1.13.18";

export const CONTROL_OUTBOUND_TYPES = new Set([
  'direct',
  'block',
  'dns',
  'selector',
  'urltest'
]);

export function padIndex(index) {
  return String(index).padStart(2, '0');
}

export function deepClone(obj) {
  if (obj === undefined || obj === null) return obj;
  return JSON.parse(JSON.stringify(obj));
}

export function isIpv4(addr) {
  if (typeof addr !== 'string') return false;
  const parts = addr.trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every(part => {
    if (!/^\d+$/.test(part)) return false;
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255 && String(num) === part;
  });
}

export function isIpv6(addr) {
  if (typeof addr !== 'string') return false;
  let clean = addr.trim();
  if (clean.startsWith('[') && clean.endsWith(']')) {
    clean = clean.slice(1, -1);
  }
  return clean.includes(':') && /^[0-9a-fA-F:]+$/.test(clean);
}

export function isHostname(addr) {
  if (!addr || typeof addr !== 'string') return false;
  const clean = addr.trim();
  if (!clean) return false;
  return !isIpv4(clean) && !isIpv6(clean);
}

export function isUsableProxyOutbound(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
  if (!node.type || typeof node.type !== 'string') return false;
  const type = node.type.toLowerCase().trim();
  if (CONTROL_OUTBOUND_TYPES.has(type)) return false;
  return true;
}

export function cleanJsonString(text) {
  if (typeof text !== 'string') return '';
  // Remove single line and multi-line comments
  let cleaned = text.replace(/(?<!:)\s*\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
  // Remove invalid ASCII control characters (excluding newline \n, tab \t, carriage return \r)
  cleaned = cleaned.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  return cleaned.trim();
}

export function safeBase64Decode(str) {
  if (!str || typeof str !== 'string') return null;
  try {
    let clean = str.trim().replace(/[\r\n\s]/g, '').replace(/-/g, '+').replace(/_/g, '/');
    while (clean.length % 4 !== 0) clean += '=';
    if (typeof atob === 'function') {
      return decodeURIComponent(escape(atob(clean)));
    } else if (typeof Buffer !== 'undefined') {
      return Buffer.from(clean, 'base64').toString('utf8');
    }
  } catch (_) {
    try {
      if (typeof atob === 'function') return atob(str);
      if (typeof Buffer !== 'undefined') return Buffer.from(str, 'base64').toString('utf8');
    } catch (_) {}
  }
  return null;
}

export function parseVlessLink(link) {
  try {
    const trimmed = link.trim();
    if (!trimmed.startsWith('vless://')) return null;
    const url = new URL(trimmed);
    const uuid = url.username;
    const server = url.hostname;
    const server_port = parseInt(url.port || '443', 10);
    const tag = url.hash ? decodeURIComponent(url.hash.slice(1)) : `${server}:${server_port}`;
    const params = url.searchParams;

    const security = (params.get('security') || '').toLowerCase();
    const type = (params.get('type') || params.get('headerType') || 'tcp').toLowerCase();
    const flow = params.get('flow');
    const sni = params.get('sni') || params.get('host');
    const pbk = params.get('pbk');
    const sid = params.get('sid');
    const fp = params.get('fp') || 'chrome';
    const path = params.get('path') || '/';
    const host = params.get('host');
    const packetEncoding = params.get('packetEncoding') || params.get('packet_encoding');

    const outbound = {
      type: 'vless',
      tag: tag,
      server: server,
      server_port: server_port,
      uuid: uuid
    };

    if (flow) outbound.flow = flow;
    if (packetEncoding) outbound.packet_encoding = packetEncoding;

    if (security === 'reality') {
      outbound.tls = {
        enabled: true,
        server_name: sni || server,
        utls: { enabled: true, fingerprint: fp },
        reality: {
          enabled: true,
          public_key: pbk || '',
          short_id: sid || ''
        }
      };
    } else if (security === 'tls') {
      outbound.tls = {
        enabled: true,
        server_name: sni || server,
        utls: { enabled: true, fingerprint: fp }
      };
    }

    if (type === 'ws') {
      outbound.transport = {
        type: 'ws',
        path: path,
        headers: host ? { Host: host } : undefined
      };
    } else if (type === 'grpc') {
      outbound.transport = {
        type: 'grpc',
        service_name: params.get('serviceName') || path
      };
    } else if (type === 'http' || params.get('headerType') === 'http' || type === 'xhttp' || type === 'splithttp') {
      outbound.transport = {
        type: 'http',
        path: path,
        host: host ? [host] : undefined
      };
    }

    return outbound;
  } catch (err) {
    return null;
  }
}

export function parseTrojanLink(link) {
  try {
    const trimmed = link.trim();
    if (!trimmed.startsWith('trojan://')) return null;
    const url = new URL(trimmed);
    const password = decodeURIComponent(url.username || url.password || '');
    const server = url.hostname;
    const server_port = parseInt(url.port || '443', 10);
    const tag = url.hash ? decodeURIComponent(url.hash.slice(1)) : `trojan-${server}:${server_port}`;
    const params = url.searchParams;

    const security = (params.get('security') || 'tls').toLowerCase();
    const type = (params.get('type') || params.get('headerType') || 'tcp').toLowerCase();
    const sni = params.get('sni') || params.get('peer') || params.get('host') || server;
    const alpn = params.get('alpn') ? params.get('alpn').split(',') : undefined;
    const fp = params.get('fp') || 'chrome';
    const path = params.get('path') || '/';
    const host = params.get('host');
    const allowInsecure = params.get('allowInsecure') === '1' || params.get('insecure') === '1';

    const outbound = {
      type: 'trojan',
      tag: tag,
      server: server,
      server_port: server_port,
      password: password,
      tls: {
        enabled: true,
        server_name: sni,
        insecure: allowInsecure,
        alpn: alpn,
        utls: { enabled: true, fingerprint: fp }
      }
    };

    if (type === 'ws') {
      outbound.transport = {
        type: 'ws',
        path: path,
        headers: host ? { Host: host } : undefined
      };
    } else if (type === 'grpc') {
      outbound.transport = {
        type: 'grpc',
        service_name: params.get('serviceName') || path
      };
    } else if (type === 'http' || type === 'xhttp' || type === 'splithttp') {
      outbound.transport = {
        type: 'http',
        path: path,
        host: host ? [host] : undefined
      };
    }

    return outbound;
  } catch (_) {
    return null;
  }
}

export function parseShadowsocksLink(link) {
  try {
    const trimmed = link.trim();
    if (!trimmed.startsWith('ss://')) return null;
    const withoutPrefix = trimmed.slice(5);
    const hashIdx = withoutPrefix.indexOf('#');
    let mainPart = hashIdx !== -1 ? withoutPrefix.slice(0, hashIdx) : withoutPrefix;
    const tag = hashIdx !== -1 ? decodeURIComponent(withoutPrefix.slice(hashIdx + 1)) : '';

    let method = '';
    let password = '';
    let server = '';
    let server_port = 8388;

    if (mainPart.includes('@')) {
      // SIP002 format: ss://[base64(method:password)]@server:port/?plugin=...
      const atIdx = mainPart.indexOf('@');
      const userinfoPart = mainPart.slice(0, atIdx);
      const hostPart = mainPart.slice(atIdx + 1).split('/')[0].split('?')[0];

      let decodedUserinfo = safeBase64Decode(userinfoPart) || userinfoPart;
      if (decodedUserinfo.includes(':')) {
        const colonIdx = decodedUserinfo.indexOf(':');
        method = decodedUserinfo.slice(0, colonIdx);
        password = decodedUserinfo.slice(colonIdx + 1);
      }

      const hostColon = hostPart.lastIndexOf(':');
      if (hostColon !== -1) {
        server = hostPart.slice(0, hostColon);
        server_port = parseInt(hostPart.slice(hostColon + 1), 10) || 8388;
      } else {
        server = hostPart;
      }
    } else {
      // Legacy format: ss://base64(method:password@server:port)
      const decoded = safeBase64Decode(mainPart);
      if (decoded && decoded.includes('@')) {
        const atIdx = decoded.indexOf('@');
        const userinfoPart = decoded.slice(0, atIdx);
        const hostPart = decoded.slice(atIdx + 1);

        const colonIdx = userinfoPart.indexOf(':');
        if (colonIdx !== -1) {
          method = userinfoPart.slice(0, colonIdx);
          password = userinfoPart.slice(colonIdx + 1);
        }

        const hostColon = hostPart.lastIndexOf(':');
        if (hostColon !== -1) {
          server = hostPart.slice(0, hostColon);
          server_port = parseInt(hostPart.slice(hostColon + 1), 10) || 8388;
        } else {
          server = hostPart;
        }
      }
    }

    if (!server || !method || !password) return null;

    return {
      type: 'shadowsocks',
      tag: tag || `ss-${server}:${server_port}`,
      server: server,
      server_port: server_port,
      method: method,
      password: password
    };
  } catch (_) {
    return null;
  }
}

export function parseHysteria2Link(link) {
  try {
    const trimmed = link.trim();
    if (!trimmed.startsWith('hysteria2://') && !trimmed.startsWith('hy2://')) return null;
    const normalized = trimmed.startsWith('hy2://') 
      ? 'hysteria2://' + trimmed.slice(6) 
      : trimmed;
    const url = new URL(normalized);
    const password = decodeURIComponent(url.username || url.password || '');
    const server = url.hostname;
    const server_port = parseInt(url.port || '443', 10);
    const tag = url.hash ? decodeURIComponent(url.hash.slice(1)) : `hy2-${server}:${server_port}`;
    const params = url.searchParams;

    const sni = params.get('sni') || params.get('peer') || params.get('host') || server;
    const insecure = params.get('insecure') === '1' || params.get('insecure') === 'true';
    const obfs = params.get('obfs');
    const obfsPassword = params.get('obfs-password') || params.get('obfs_password');
    const upMbps = params.get('up') ? parseInt(params.get('up'), 10) : undefined;
    const downMbps = params.get('down') ? parseInt(params.get('down'), 10) : undefined;

    const outbound = {
      type: 'hysteria2',
      tag: tag,
      server: server,
      server_port: server_port,
      password: password,
      tls: {
        enabled: true,
        server_name: sni,
        insecure: insecure
      }
    };

    if (obfs) {
      outbound.obfs = {
        type: obfs === '1' ? 'salamander' : obfs,
        password: obfsPassword || ''
      };
    }
    if (upMbps) outbound.up_mbps = upMbps;
    if (downMbps) outbound.down_mbps = downMbps;

    return outbound;
  } catch (_) {
    return null;
  }
}

export function parseWireGuardLink(link) {
  try {
    const trimmed = link.trim();
    if (!trimmed.startsWith('wireguard://') && !trimmed.startsWith('wg://')) return null;
    const normalized = trimmed.startsWith('wg://')
      ? 'wireguard://' + trimmed.slice(5)
      : trimmed;
    const url = new URL(normalized);
    const privateKey = decodeURIComponent(url.username || url.password || '');
    const server = url.hostname;
    const server_port = parseInt(url.port || '51820', 10);
    const tag = url.hash ? decodeURIComponent(url.hash.slice(1)) : `wg-${server}:${server_port}`;
    const params = url.searchParams;

    const peerPublicKey = params.get('public_key') || params.get('peer_public_key') || params.get('pubkey') || '';
    const ip = params.get('ip') || params.get('address') || '10.0.0.2/32';
    const psk = params.get('preshared_key') || params.get('psk');
    const reservedRaw = params.get('reserved');
    const mtu = params.get('mtu') ? parseInt(params.get('mtu'), 10) : undefined;

    let reserved = undefined;
    if (reservedRaw) {
      reserved = reservedRaw.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
      if (reserved.length === 0) reserved = undefined;
    }

    const localAddress = ip.includes(',') ? ip.split(',').map(s => s.trim()) : [ip];

    const outbound = {
      type: 'wireguard',
      tag: tag,
      server: server,
      server_port: server_port,
      system_interface: false,
      local_address: localAddress,
      private_key: privateKey,
      peer_public_key: peerPublicKey
    };

    if (psk) outbound.pre_shared_key = psk;
    if (reserved) outbound.reserved = reserved;
    if (mtu) outbound.mtu = mtu;

    return outbound;
  } catch (_) {
    return null;
  }
}

export function parseSingleShareLink(line) {
  if (!line || typeof line !== 'string') return null;
  const trimmed = line.trim();
  if (trimmed.startsWith('vless://')) return parseVlessLink(trimmed);
  if (trimmed.startsWith('trojan://')) return parseTrojanLink(trimmed);
  if (trimmed.startsWith('ss://')) return parseShadowsocksLink(trimmed);
  if (trimmed.startsWith('hysteria2://') || trimmed.startsWith('hy2://')) return parseHysteria2Link(trimmed);
  if (trimmed.startsWith('wireguard://') || trimmed.startsWith('wg://')) return parseWireGuardLink(trimmed);
  return null;
}

export function tryParseShareLinksOrBase64(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();

  // Try direct lines with share link protocol schemes
  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const directParsed = lines.map(parseSingleShareLink).filter(Boolean);
  if (directParsed.length > 0) {
    return directParsed;
  }

  // Try Base64 decoding
  const decoded = safeBase64Decode(trimmed);
  if (decoded) {
    const decodedLines = decoded.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const b64Parsed = decodedLines.map(parseSingleShareLink).filter(Boolean);
    if (b64Parsed.length > 0) return b64Parsed;
  }

  return null;
}

/**
 * Parses raw JSON / outbounds array / full sing-box configuration / VLESS share links / Base64 subscription.
 * Returns an array of raw usable proxy outbound objects.
 */
export function parseInput(text) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new Error('Empty input provided.');
  }

  // Check for share links or Base64 subscription first
  const shareOutbounds = tryParseShareLinksOrBase64(text);
  if (shareOutbounds && shareOutbounds.length > 0) {
    return deepClone(shareOutbounds);
  }

  const cleaned = cleanJsonString(text);
  if (!cleaned) {
    throw new Error('Empty input provided.');
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Invalid JSON format: ${err.message}`);
  }

  let candidateOutbounds = [];
  if (Array.isArray(parsed)) {
    candidateOutbounds = parsed;
  } else if (typeof parsed === 'object' && parsed !== null && Array.isArray(parsed.outbounds)) {
    candidateOutbounds = parsed.outbounds;
  } else {
    throw new Error("Input must be a JSON array of outbounds, a complete sing-box configuration object with an 'outbounds' array, or VLESS share links.");
  }

  const usable = candidateOutbounds.filter(isUsableProxyOutbound);
  if (usable.length === 0) {
    throw new Error('No usable proxy outbounds found in the input (control outbounds like direct/block/selector were ignored).');
  }

  return deepClone(usable);
}

/**
 * Normalizes usable raw outbounds into managed node items with deterministic identifiers.
 */
export function normalizeNodes(rawOutbounds, startingPort = 20801, listenAddress = '127.0.0.1') {
  if (!Array.isArray(rawOutbounds)) return [];

  let enabledCount = 0;
  return rawOutbounds.map((rawNode, idx) => {
    const num = idx + 1;
    const padded = padIndex(num);
    const originalTag = (rawNode && rawNode.tag) ? String(rawNode.tag) : `node-${padded}`;
    const type = (rawNode && rawNode.type) ? String(rawNode.type).toLowerCase() : 'vless';
    const clonedOutbound = deepClone(rawNode || {});

    // Sanitize unsupported xhttp / splithttp transport for sing-box 1.13.18
    let warning = null;
    if (clonedOutbound.transport && (clonedOutbound.transport.type === 'xhttp' || clonedOutbound.transport.type === 'splithttp')) {
      clonedOutbound.transport.type = 'http';
      warning = 'Transport xhttp was converted to http for sing-box 1.13.18 compatibility';
    }

    const assignedPort = startingPort + enabledCount;
    enabledCount++;

    return {
      id: `node-${padded}`,
      index: num,
      displayIndex: padded,
      originalTag,
      type,
      outboundTag: `proxy-out-${padded}`,
      inboundTag: `proxy-in-${padded}`,
      dnsTag: `dns-proxy-${padded}`,
      port: assignedPort,
      listenAddress: listenAddress || '127.0.0.1',
      enabled: true,
      warning,
      rawOutbound: clonedOutbound
    };
  });
}

/**
 * Resequences port numbers for enabled nodes without any gaps.
 */
export function resequencePorts(nodes, startingPort = 20801) {
  if (!Array.isArray(nodes)) return [];
  let currentPort = startingPort;
  for (const node of nodes) {
    if (node.enabled) {
      node.port = currentPort;
      currentPort++;
    } else {
      node.port = null;
    }
  }
  return nodes;
}

/**
 * Validates ports of enabled nodes.
 */
export function validatePorts(nodes) {
  if (!Array.isArray(nodes)) {
    return { valid: false, error: 'invalid', message: 'Nodes array is invalid.' };
  }

  const enabledNodes = nodes.filter(n => n.enabled);
  if (enabledNodes.length === 0) {
    return { valid: false, error: 'no_enabled_nodes', message: 'No enabled nodes to allocate ports for.' };
  }

  const portMap = new Map();
  for (const node of enabledNodes) {
    const port = parseInt(node.port, 10);
    if (isNaN(port) || port < 1 || port > 65535 || String(port) !== String(node.port).trim()) {
      return {
        valid: false,
        error: 'invalid_port',
        message: `Port for node "${node.originalTag}" is invalid (${node.port}). Ports must be integers between 1 and 65535.`,
        invalidNodeId: node.id
      };
    }

    if (portMap.has(port)) {
      const existing = portMap.get(port);
      return {
        valid: false,
        error: 'duplicate_port',
        message: `Duplicate port ${port} detected between "${existing.originalTag}" and "${node.originalTag}". Each port must be unique.`,
        duplicatePort: port
      };
    }
    portMap.set(port, node);
  }

  return { valid: true, error: null };
}

/**
 * Generates the full sing-box 1.13.18 configuration object.
 */
export function generateConfig({
  normalizedNodes,
  template = null,
  bootstrapDns = '1.1.1.1',
  remoteDns = '1.1.1.1',
  dnsStrategy = 'prefer_ipv4',
  logLevel = 'warn',
  listenAddress = '127.0.0.1',
  enableMasterPort = false,
  masterPort = 20800
}) {
  if (!Array.isArray(normalizedNodes) || normalizedNodes.length === 0) {
    throw new Error('Cannot generate configuration: No proxy nodes available.');
  }

  const enabledNodes = normalizedNodes.filter(n => n.enabled);
  if (enabledNodes.length === 0) {
    throw new Error('Cannot generate configuration: All proxy nodes are disabled.');
  }

  const portValidation = validatePorts(normalizedNodes);
  if (!portValidation.valid) {
    throw new Error(portValidation.message);
  }

  // Base config structure
  let baseConfig = template ? deepClone(template) : {
    log: {
      level: logLevel || 'warn',
      timestamp: true
    },
    dns: {
      servers: [],
      rules: [],
      final: 'local_dns',
      strategy: dnsStrategy || 'prefer_ipv4'
    },
    inbounds: [],
    outbounds: [
      { type: 'direct', tag: 'direct' },
      { type: 'block', tag: 'block' }
    ],
    route: {
      default_domain_resolver: 'local_dns',
      rules: [],
      final: 'block'
    },
    experimental: {
      clash_api: {
        external_controller: '127.0.0.1:9090',
        secret: ''
      }
    }
  };

  const finalConfig = deepClone(baseConfig);

  // 1. Log configuration
  if (!finalConfig.log) finalConfig.log = {};
  finalConfig.log.level = logLevel || 'warn';
  finalConfig.log.timestamp = true;

  // 2. DNS section
  if (!finalConfig.dns) finalConfig.dns = {};
  finalConfig.dns.strategy = dnsStrategy || 'prefer_ipv4';
  finalConfig.dns.final = 'local_dns';

  // Build DNS servers
  const dnsServers = [];

  // Per-proxy DNS servers
  enabledNodes.forEach(node => {
    dnsServers.push({
      tag: node.dnsTag,
      type: 'udp',
      server: remoteDns || '1.1.1.1',
      detour: node.outboundTag
    });
  });

  // Master Port DNS server (routes via auto-fastest urltest outbound)
  if (enableMasterPort) {
    dnsServers.push({
      tag: 'dns-master',
      type: 'udp',
      server: remoteDns || '1.1.1.1',
      detour: 'auto-fastest'
    });
  }

  // Bootstrap local_dns server
  if (bootstrapDns === 'local') {
    dnsServers.push({
      tag: 'local_dns',
      type: 'local'
    });
  } else {
    dnsServers.push({
      tag: 'local_dns',
      type: 'udp',
      server: bootstrapDns || '1.1.1.1'
    });
  }

  finalConfig.dns.servers = dnsServers;

  // Build DNS rules
  const dnsRules = [];

  // Exemption rule for server hostnames to resolve via local_dns directly (prevent dependency loop)
  const proxyHostnames = [...new Set(
    enabledNodes
      .map(n => n.rawOutbound && n.rawOutbound.server)
      .filter(isHostname)
  )];

  if (proxyHostnames.length > 0) {
    dnsRules.push({
      domain: proxyHostnames,
      server: 'local_dns'
    });
  }

  // Master Port DNS routing
  if (enableMasterPort) {
    dnsRules.push({
      inbound: 'master-in',
      server: 'dns-master'
    });
  }

  // Per-inbound DNS routing
  enabledNodes.forEach(node => {
    dnsRules.push({
      inbound: node.inboundTag,
      server: node.dnsTag
    });
  });

  finalConfig.dns.rules = dnsRules;

  // 3. Inbounds
  const individualInbounds = enabledNodes.map(node => ({
    type: 'mixed',
    tag: node.inboundTag,
    listen: node.listenAddress || listenAddress || '127.0.0.1',
    listen_port: parseInt(node.port, 10)
  }));

  if (enableMasterPort) {
    const masterInbound = {
      type: 'mixed',
      tag: 'master-in',
      listen: listenAddress || '127.0.0.1',
      listen_port: parseInt(masterPort, 10) || 20800
    };
    finalConfig.inbounds = [masterInbound, ...individualInbounds];
  } else {
    finalConfig.inbounds = individualInbounds;
  }

  // 4. Outbounds & Endpoints
  const generatedEndpoints = [];
  const generatedOutbounds = [];

  enabledNodes.forEach(node => {
    const clonedOutbound = deepClone(node.rawOutbound);
    if (clonedOutbound.type === 'wireguard') {
      const ep = {
        type: 'wireguard',
        tag: node.outboundTag,
        address: Array.isArray(clonedOutbound.local_address) ? clonedOutbound.local_address : (clonedOutbound.address || ['10.0.0.2/32']),
        private_key: clonedOutbound.private_key,
        peers: [
          {
            address: clonedOutbound.server,
            port: clonedOutbound.server_port || 51820,
            public_key: clonedOutbound.peer_public_key || clonedOutbound.public_key || '',
            allowed_ips: ['0.0.0.0/0', '::/0']
          }
        ]
      };
      if (clonedOutbound.mtu) ep.mtu = clonedOutbound.mtu;
      if (clonedOutbound.pre_shared_key) ep.peers[0].pre_shared_key = clonedOutbound.pre_shared_key;
      if (clonedOutbound.reserved) ep.peers[0].reserved = clonedOutbound.reserved;
      generatedEndpoints.push(ep);
    } else {
      clonedOutbound.tag = node.outboundTag;
      generatedOutbounds.push(clonedOutbound);
    }
  });

  if (generatedEndpoints.length > 0) {
    finalConfig.endpoints = generatedEndpoints;
  }

  const specialOutbounds = [];
  if (enableMasterPort) {
    specialOutbounds.push({
      type: 'urltest',
      tag: 'auto-fastest',
      outbounds: enabledNodes.map(n => n.outboundTag),
      url: 'https://cp.cloudflare.com/generate_204',
      interval: '3m',
      tolerance: 50
    });
  }

  const baseOutbounds = [
    { type: 'direct', tag: 'direct' },
    { type: 'block', tag: 'block' }
  ];

  finalConfig.outbounds = [...generatedOutbounds, ...specialOutbounds, ...baseOutbounds];

  // 5. Route section
  if (!finalConfig.route) finalConfig.route = {};
  finalConfig.route.default_domain_resolver = 'local_dns';
  finalConfig.route.final = 'block';

  const routeRules = [];
  if (enableMasterPort) {
    routeRules.push({
      inbound: 'master-in',
      outbound: 'auto-fastest'
    });
  }

  // Strict 1:1 Inbound -> Outbound route rules
  enabledNodes.forEach(node => {
    routeRules.push({
      inbound: node.inboundTag,
      outbound: node.outboundTag
    });
  });

  finalConfig.route.rules = routeRules;

  // 6. Experimental (Clash API for real-time traffic statistics)
  if (!finalConfig.experimental) {
    finalConfig.experimental = {
      clash_api: {
        external_controller: '127.0.0.1:9090',
        secret: ''
      }
    };
  }

  return finalConfig;
}

/**
 * Comprehensive client-side structural validation of the generated configuration.
 */
export function validateGeneratedConfig(config, normalizedNodes) {
  const errors = [];
  const warnings = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Configuration is not an object.'], warnings };
  }

  if (!Array.isArray(config.inbounds) || config.inbounds.length === 0) {
    errors.push('Configuration has no inbounds defined.');
  }

  if (!Array.isArray(config.outbounds) || config.outbounds.length === 0) {
    errors.push('Configuration has no outbounds defined.');
  }

  if (!config.dns || !Array.isArray(config.dns.servers)) {
    errors.push('Configuration has invalid DNS structure.');
  }

  if (!config.route || !Array.isArray(config.route.rules)) {
    errors.push('Configuration has invalid route structure.');
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  const enabledNodes = (normalizedNodes || []).filter(n => n.enabled);
  const expectedCount = enabledNodes.length;

  // Check inbounds count & uniqueness
  const inboundTags = new Set();
  const inboundPorts = new Set();
  config.inbounds.forEach((inb, i) => {
    if (!inb.tag) errors.push(`Inbound #${i} has no tag.`);
    if (inboundTags.has(inb.tag)) errors.push(`Duplicate inbound tag: ${inb.tag}`);
    inboundTags.add(inb.tag);

    if (!inb.listen_port || inb.listen_port < 1 || inb.listen_port > 65535) {
      errors.push(`Inbound ${inb.tag} has invalid port: ${inb.listen_port}`);
    }
    if (inboundPorts.has(inb.listen_port)) {
      errors.push(`Duplicate inbound port: ${inb.listen_port}`);
    }
    inboundPorts.add(inb.listen_port);

    if (inb.type !== 'mixed') {
      warnings.push(`Inbound ${inb.tag} uses type "${inb.type}" instead of "mixed".`);
    }
  });

  // Check outbounds & endpoints tags & uniqueness
  const outboundTags = new Set();
  (config.endpoints || []).forEach((ep, i) => {
    if (!ep.tag) errors.push(`Endpoint #${i} has no tag.`);
    if (outboundTags.has(ep.tag)) errors.push(`Duplicate tag in endpoints: ${ep.tag}`);
    outboundTags.add(ep.tag);
  });

  config.outbounds.forEach((out, i) => {
    if (!out.tag) errors.push(`Outbound #${i} has no tag.`);
    if (outboundTags.has(out.tag)) errors.push(`Duplicate outbound tag: ${out.tag}`);
    outboundTags.add(out.tag);

    if (out.type === 'vless') {
      if (!out.server) errors.push(`VLESS outbound ${out.tag} missing "server" field.`);
      if (!out.server_port) errors.push(`VLESS outbound ${out.tag} missing "server_port" field.`);
      if (!out.uuid) errors.push(`VLESS outbound ${out.tag} missing "uuid" field.`);
    } else if (out.type === 'trojan') {
      if (!out.server) errors.push(`Trojan outbound ${out.tag} missing "server" field.`);
      if (!out.server_port) errors.push(`Trojan outbound ${out.tag} missing "server_port" field.`);
      if (!out.password) errors.push(`Trojan outbound ${out.tag} missing "password" field.`);
    } else if (out.type === 'shadowsocks') {
      if (!out.server) errors.push(`Shadowsocks outbound ${out.tag} missing "server" field.`);
      if (!out.server_port) errors.push(`Shadowsocks outbound ${out.tag} missing "server_port" field.`);
      if (!out.method) errors.push(`Shadowsocks outbound ${out.tag} missing "method" field.`);
      if (!out.password) errors.push(`Shadowsocks outbound ${out.tag} missing "password" field.`);
    } else if (out.type === 'hysteria2') {
      if (!out.server) errors.push(`Hysteria2 outbound ${out.tag} missing "server" field.`);
      if (!out.server_port) errors.push(`Hysteria2 outbound ${out.tag} missing "server_port" field.`);
      if (!out.password) errors.push(`Hysteria2 outbound ${out.tag} missing "password" field.`);
    }
  });

  // Check DNS servers
  const dnsTags = new Set();
  config.dns.servers.forEach((ds, i) => {
    if (!ds.tag) errors.push(`DNS server #${i} has no tag.`);
    if (dnsTags.has(ds.tag)) errors.push(`Duplicate DNS server tag: ${ds.tag}`);
    dnsTags.add(ds.tag);

    if (ds.detour && !outboundTags.has(ds.detour)) {
      errors.push(`DNS server ${ds.tag} references unknown outbound detour: ${ds.detour}`);
    }
  });

  if (!dnsTags.has('local_dns')) {
    errors.push('Missing "local_dns" server in DNS configuration.');
  }

  // Check Route rules (1:1 mapping and no cross-routing)
  const routedInbounds = new Set();
  config.route.rules.forEach(rule => {
    if (rule.inbound) {
      const inTag = Array.isArray(rule.inbound) ? rule.inbound[0] : rule.inbound;
      const outTag = rule.outbound;

      if (!inboundTags.has(inTag)) {
        errors.push(`Route rule references unknown inbound: ${inTag}`);
      }
      if (!outboundTags.has(outTag)) {
        errors.push(`Route rule references unknown outbound: ${outTag}`);
      }

      if (outTag === 'direct' || outTag === 'block') {
        errors.push(`Proxy inbound ${inTag} is routed to "${outTag}", which violates proxy isolation.`);
      }

      // Check corresponding node mapping
      const matchedNode = enabledNodes.find(n => n.inboundTag === inTag);
      if (matchedNode) {
        if (outTag !== matchedNode.outboundTag) {
          errors.push(`Cross-routing detected: Inbound ${inTag} is routed to ${outTag}, expected ${matchedNode.outboundTag}.`);
        }
      }
      routedInbounds.add(inTag);
    }
  });

  // Verify all enabled nodes have routes
  enabledNodes.forEach(node => {
    if (!routedInbounds.has(node.inboundTag)) {
      errors.push(`Enabled node ${node.originalTag} (${node.inboundTag}) has no routing rule.`);
    }
    if (!inboundTags.has(node.inboundTag)) {
      errors.push(`Enabled node ${node.originalTag} (${node.inboundTag}) has no generated inbound.`);
    }
    if (!outboundTags.has(node.outboundTag)) {
      errors.push(`Enabled node ${node.originalTag} (${node.outboundTag}) has no generated outbound.`);
    }
    if (!dnsTags.has(node.dnsTag)) {
      errors.push(`Enabled node ${node.originalTag} (${node.dnsTag}) has no generated DNS server.`);
    }
  });

  if (config.route.final === 'direct') {
    errors.push('route.final is set to "direct", which can cause silent IP leaks.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalInbounds: config.inbounds.length,
      totalOutbounds: config.outbounds.length,
      totalDnsServers: config.dns.servers.length,
      totalRouteRules: config.route.rules.length,
      expectedNodeCount: expectedCount
    }
  };
}
