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

export function tryParseShareLinksOrBase64(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();

  // Try direct lines with vless://
  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const directVless = lines.filter(l => l.startsWith('vless://'));
  if (directVless.length > 0) {
    const outbounds = directVless.map(parseVlessLink).filter(Boolean);
    if (outbounds.length > 0) return outbounds;
  }

  // Try Base64 decoding
  try {
    const cleanB64 = trimmed.replace(/\s/g, '');
    let decoded = '';
    if (typeof atob === 'function') {
      decoded = atob(cleanB64);
    } else if (typeof Buffer !== 'undefined') {
      decoded = Buffer.from(cleanB64, 'base64').toString('utf8');
    }
    if (decoded && (decoded.includes('vless://') || decoded.includes('vmess://') || decoded.includes('trojan://') || decoded.includes('ss://'))) {
      const decodedLines = decoded.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const b64Vless = decodedLines.filter(l => l.startsWith('vless://'));
      if (b64Vless.length > 0) {
        const outbounds = b64Vless.map(parseVlessLink).filter(Boolean);
        if (outbounds.length > 0) return outbounds;
      }
    }
  } catch (_) {}

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
export function normalizeNodes(rawOutbounds, startingPort = 10808, listenAddress = '127.0.0.1') {
  if (!Array.isArray(rawOutbounds)) return [];

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

    return {
      id: `node-${padded}`,
      index: num,
      displayIndex: padded,
      originalTag,
      type,
      outboundTag: `proxy-out-${padded}`,
      inboundTag: `proxy-in-${padded}`,
      dnsTag: `dns-proxy-${padded}`,
      port: startingPort + idx,
      listenAddress: listenAddress || '127.0.0.1',
      enabled: true,
      warning,
      rawOutbound: clonedOutbound
    };
  });
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
  listenAddress = '127.0.0.1'
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

  // Per-inbound DNS routing
  enabledNodes.forEach(node => {
    dnsRules.push({
      inbound: node.inboundTag,
      server: node.dnsTag
    });
  });

  finalConfig.dns.rules = dnsRules;

  // 3. Inbounds
  finalConfig.inbounds = enabledNodes.map(node => ({
    type: 'mixed',
    tag: node.inboundTag,
    listen: node.listenAddress || listenAddress || '127.0.0.1',
    listen_port: parseInt(node.port, 10)
  }));

  // 4. Outbounds
  const generatedOutbounds = enabledNodes.map(node => {
    const clonedOutbound = deepClone(node.rawOutbound);
    // Assign deterministic tag
    clonedOutbound.tag = node.outboundTag;
    return clonedOutbound;
  });

  const baseOutbounds = [
    { type: 'direct', tag: 'direct' },
    { type: 'block', tag: 'block' }
  ];

  finalConfig.outbounds = [...generatedOutbounds, ...baseOutbounds];

  // 5. Route section
  if (!finalConfig.route) finalConfig.route = {};
  finalConfig.route.default_domain_resolver = 'local_dns';
  finalConfig.route.final = 'block';

  // Strict 1:1 Inbound -> Outbound route rules
  finalConfig.route.rules = enabledNodes.map(node => ({
    inbound: node.inboundTag,
    outbound: node.outboundTag
  }));

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

  // Check outbounds tags & uniqueness
  const outboundTags = new Set();
  config.outbounds.forEach((out, i) => {
    if (!out.tag) errors.push(`Outbound #${i} has no tag.`);
    if (outboundTags.has(out.tag)) errors.push(`Duplicate outbound tag: ${out.tag}`);
    outboundTags.add(out.tag);

    if (out.type === 'vless') {
      if (!out.server) errors.push(`VLESS outbound ${out.tag} missing "server" field.`);
      if (!out.server_port) errors.push(`VLESS outbound ${out.tag} missing "server_port" field.`);
      if (!out.uuid) errors.push(`VLESS outbound ${out.tag} missing "uuid" field.`);
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
