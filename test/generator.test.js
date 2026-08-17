import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  SUPPORTED_SING_BOX_VERSION,
  parseInput,
  normalizeNodes,
  validatePorts,
  generateConfig,
  validateGeneratedConfig,
  isIpv4,
  isIpv6,
  isHostname,
  isUsableProxyOutbound
} from '../core-generator.js';

const LOCAL_BIN = path.join(process.cwd(), 'sing-box.exe');
const TEMP_BIN = path.join(os.tmpdir(), 'sing-box-1.13.18', 'sing-box-1.13.18-windows-amd64', 'sing-box.exe');
const SINGBOX_BIN = fs.existsSync(LOCAL_BIN) ? LOCAL_BIN : TEMP_BIN;
const HAS_SINGBOX_BIN = fs.existsSync(SINGBOX_BIN);

function runSingBoxCheck(configObj) {
  if (!HAS_SINGBOX_BIN) return { available: false, success: true };
  const tmpFile = path.join(os.tmpdir(), `sb-test-${Date.now()}-${Math.random().toString(36).substring(7)}.json`);
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(configObj, null, 2), 'utf8');
    execFileSync(SINGBOX_BIN, ['check', '-c', tmpFile], { stdio: 'pipe' });
    return { available: true, success: true };
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    return { available: true, success: false, error: stderr };
  } finally {
    if (fs.existsSync(tmpFile)) {
      try { fs.unlinkSync(tmpFile); } catch (_) {}
    }
  }
}

// Sample VLESS node
const sampleVless1 = {
  type: 'vless',
  tag: 'Germany-01',
  server: 'de.example.com',
  server_port: 443,
  uuid: 'e22405bc-a71b-4c6d-948a-22e41588bc6e',
  flow: 'xtls-rprx-vision',
  tls: {
    enabled: true,
    server_name: 'de.example.com',
    utls: { enabled: true, fingerprint: 'chrome' }
  }
};

const sampleVless2 = {
  type: 'vless',
  tag: 'Netherlands-02',
  server: '198.51.100.2',
  server_port: 8443,
  uuid: 'f33516cd-b82c-5d7e-059b-33f52699cd7f',
  tls: {
    enabled: true,
    server_name: 'nl.example.com'
  },
  transport: {
    type: 'ws',
    path: '/vless-ws',
    headers: { Host: 'nl.example.com' }
  }
};

test('TEST 0: Supported Sing-Box Version Constant', () => {
  assert.equal(SUPPORTED_SING_BOX_VERSION, '1.13.18');
});

test('TEST 1: 1 VLESS node generates 1 inbound, 1 outbound, 1 route, 1 DNS path', () => {
  const raw = [sampleVless1];
  const normalized = normalizeNodes(raw, 10808);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].port, 10808);
  assert.equal(normalized[0].outboundTag, 'proxy-out-01');
  assert.equal(normalized[0].inboundTag, 'proxy-in-01');

  const config = generateConfig({ normalizedNodes: normalized });
  const validation = validateGeneratedConfig(config, normalized);
  assert.equal(validation.valid, true, `Validation failed: ${validation.errors.join(', ')}`);

  assert.equal(config.inbounds.length, 1);
  assert.equal(config.inbounds[0].tag, 'proxy-in-01');
  assert.equal(config.inbounds[0].listen_port, 10808);
  assert.equal(config.inbounds[0].type, 'mixed');

  // Outbounds: 1 proxy-out + direct + block
  assert.equal(config.outbounds.length, 3);
  assert.equal(config.outbounds[0].tag, 'proxy-out-01');
  assert.equal(config.outbounds[0].uuid, sampleVless1.uuid);

  // Route rules: 1 inbound -> outbound rule
  assert.equal(config.route.rules.length, 1);
  assert.equal(config.route.rules[0].inbound, 'proxy-in-01');
  assert.equal(config.route.rules[0].outbound, 'proxy-out-01');

  // DNS: dns-proxy-01 + local_dns
  assert.equal(config.dns.servers.length, 2);
  assert.equal(config.dns.servers[0].tag, 'dns-proxy-01');
  assert.equal(config.dns.servers[0].detour, 'proxy-out-01');

  // Runtime check
  const check = runSingBoxCheck(config);
  assert.equal(check.success, true, check.error);
});

test('TEST 2: Multiple VLESS nodes (10 nodes) generate ports 10808-10817 and strict 1:1 mapping', () => {
  const raw = Array.from({ length: 10 }, (_, i) => ({
    type: 'vless',
    tag: `Node-${i + 1}`,
    server: `node${i + 1}.example.com`,
    server_port: 443,
    uuid: `00000000-0000-0000-0000-00000000000${i}`,
    tls: { enabled: true, server_name: `node${i + 1}.example.com` }
  }));

  const normalized = normalizeNodes(raw, 10808);
  assert.equal(normalized.length, 10);

  const config = generateConfig({ normalizedNodes: normalized });
  const validation = validateGeneratedConfig(config, normalized);
  assert.equal(validation.valid, true, `Validation failed: ${validation.errors.join(', ')}`);

  assert.equal(config.inbounds.length, 10);
  for (let i = 0; i < 10; i++) {
    const pad = String(i + 1).padStart(2, '0');
    assert.equal(config.inbounds[i].listen_port, 10808 + i);
    assert.equal(config.inbounds[i].tag, `proxy-in-${pad}`);
    assert.equal(config.outbounds[i].tag, `proxy-out-${pad}`);
    assert.equal(config.route.rules[i].inbound, `proxy-in-${pad}`);
    assert.equal(config.route.rules[i].outbound, `proxy-out-${pad}`);
  }

  const check = runSingBoxCheck(config);
  assert.equal(check.success, true, check.error);
});

test('TEST 3: Duplicate port detection must fail validation', () => {
  const normalized = normalizeNodes([sampleVless1, sampleVless2], 10808);
  normalized[1].port = 10808; // Set duplicate port

  const portCheck = validatePorts(normalized);
  assert.equal(portCheck.valid, false);
  assert.equal(portCheck.error, 'duplicate_port');

  assert.throws(() => {
    generateConfig({ normalizedNodes: normalized });
  }, /Duplicate port 10808/);
});

test('TEST 4: Invalid port range (<1, >65535, NaN) must fail validation', () => {
  const normalized = normalizeNodes([sampleVless1], 10808);

  normalized[0].port = 0;
  assert.equal(validatePorts(normalized).valid, false);

  normalized[0].port = 70000;
  assert.equal(validatePorts(normalized).valid, false);

  normalized[0].port = 'invalid';
  assert.equal(validatePorts(normalized).valid, false);
});

test('TEST 5: Duplicate original tags produce unique internal identifiers', () => {
  const nodeA = { ...sampleVless1, tag: 'SAME_TAG' };
  const nodeB = { ...sampleVless2, tag: 'SAME_TAG' };

  const normalized = normalizeNodes([nodeA, nodeB], 10808);
  assert.equal(normalized[0].outboundTag, 'proxy-out-01');
  assert.equal(normalized[1].outboundTag, 'proxy-out-02');
  assert.notEqual(normalized[0].outboundTag, normalized[1].outboundTag);

  const config = generateConfig({ normalizedNodes: normalized });
  const validation = validateGeneratedConfig(config, normalized);
  assert.equal(validation.valid, true);
});

test('TEST 6: Hostname server creates valid bootstrap DNS rule', () => {
  const node = { ...sampleVless1, server: 'hostname.server.com' };
  const normalized = normalizeNodes([node], 10808);
  const config = generateConfig({ normalizedNodes: normalized });

  const bootstrapRule = config.dns.rules.find(r => r.domain && r.domain.includes('hostname.server.com'));
  assert.ok(bootstrapRule, 'Bootstrap rule for hostname must exist');
  assert.equal(bootstrapRule.server, 'local_dns');
});

test('TEST 7: IPv4 literal server does not create unnecessary hostname bootstrap rule', () => {
  const node = { ...sampleVless1, server: '1.2.3.4' };
  const normalized = normalizeNodes([node], 10808);
  const config = generateConfig({ normalizedNodes: normalized });

  const hostnameRule = config.dns.rules.find(r => r.domain);
  assert.equal(hostnameRule, undefined, 'IPv4 server literal must not create domain rules');
});

test('TEST 8: IPv6 literal server is identified correctly and does not create hostname rules', () => {
  assert.equal(isIpv6('2001:db8::1'), true);
  assert.equal(isIpv6('[2001:db8::1]'), true);
  assert.equal(isHostname('2001:db8::1'), false);

  const node = { ...sampleVless1, server: '2001:db8::1' };
  const normalized = normalizeNodes([node], 10808);
  const config = generateConfig({ normalizedNodes: normalized });

  const hostnameRule = config.dns.rules.find(r => r.domain);
  assert.equal(hostnameRule, undefined, 'IPv6 literal must not create domain rules');
});

test('TEST 9: VLESS Reality configuration survives unchanged', () => {
  const realityNode = {
    type: 'vless',
    tag: 'Reality-Node',
    server: 'reality.domain.com',
    server_port: 443,
    uuid: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    flow: 'xtls-rprx-vision',
    tls: {
      enabled: true,
      server_name: 'yahoo.com',
      utls: { enabled: true, fingerprint: 'chrome' },
      reality: {
        enabled: true,
        public_key: 'abcdef1234567890abcdef1234567890abcdef12345',
        short_id: '12345678'
      }
    },
    packet_encoding: 'xudp'
  };

  const normalized = normalizeNodes([realityNode], 10808);
  const config = generateConfig({ normalizedNodes: normalized });

  const out = config.outbounds[0];
  assert.equal(out.flow, 'xtls-rprx-vision');
  assert.deepEqual(out.tls.reality, realityNode.tls.reality);
  assert.equal(out.packet_encoding, 'xudp');

  const check = runSingBoxCheck(config);
  assert.equal(check.success, true, check.error);
});

test('TEST 10: VLESS WebSocket transport survives unchanged', () => {
  const wsNode = { ...sampleVless2 };
  const normalized = normalizeNodes([wsNode], 10808);
  const config = generateConfig({ normalizedNodes: normalized });

  const out = config.outbounds[0];
  assert.deepEqual(out.transport, wsNode.transport);

  const check = runSingBoxCheck(config);
  assert.equal(check.success, true, check.error);
});

test('TEST 11: VLESS gRPC transport survives unchanged', () => {
  const grpcNode = {
    type: 'vless',
    tag: 'gRPC-Node',
    server: 'grpc.example.com',
    server_port: 443,
    uuid: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    tls: { enabled: true, server_name: 'grpc.example.com' },
    transport: {
      type: 'grpc',
      service_name: 'vless-grpc'
    }
  };

  const normalized = normalizeNodes([grpcNode], 10808);
  const config = generateConfig({ normalizedNodes: normalized });

  const out = config.outbounds[0];
  assert.deepEqual(out.transport, grpcNode.transport);

  const check = runSingBoxCheck(config);
  assert.equal(check.success, true, check.error);
});

test('TEST 12: Malformed JSON generates user-friendly error', () => {
  assert.throws(() => {
    parseInput('{ invalid json');
  }, /Invalid JSON format/);
});

test('TEST 13: Full config with control outbounds extracts only usable proxy nodes', () => {
  const fullConfig = {
    log: { level: 'info' },
    outbounds: [
      { type: 'direct', tag: 'direct' },
      { type: 'block', tag: 'block' },
      { type: 'dns', tag: 'dns-out' },
      { type: 'selector', tag: 'auto', outbounds: ['vless-node'] },
      { type: 'urltest', tag: 'urltest', outbounds: ['vless-node'] },
      sampleVless1,
      sampleVless2
    ]
  };

  const parsed = parseInput(JSON.stringify(fullConfig));
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].tag, sampleVless1.tag);
  assert.equal(parsed[1].tag, sampleVless2.tag);
});

test('TEST 14: DNS isolation verification - inbound 01 -> DNS 01 -> proxy 01 and never cross-mapped', () => {
  const normalized = normalizeNodes([sampleVless1, sampleVless2], 10808);
  const config = generateConfig({ normalizedNodes: normalized });

  const dnsRule1 = config.dns.rules.find(r => r.inbound === 'proxy-in-01');
  const dnsRule2 = config.dns.rules.find(r => r.inbound === 'proxy-in-02');

  assert.equal(dnsRule1.server, 'dns-proxy-01');
  assert.equal(dnsRule2.server, 'dns-proxy-02');

  const server1 = config.dns.servers.find(s => s.tag === 'dns-proxy-01');
  const server2 = config.dns.servers.find(s => s.tag === 'dns-proxy-02');

  assert.equal(server1.detour, 'proxy-out-01');
  assert.equal(server2.detour, 'proxy-out-02');
});

test('TEST 15: Final routing verification - route.final is block and no direct fallback for proxy traffic', () => {
  const normalized = normalizeNodes([sampleVless1], 10808);
  const config = generateConfig({ normalizedNodes: normalized });

  assert.equal(config.route.final, 'block');
  assert.equal(config.route.rules[0].outbound, 'proxy-out-01');
  assert.notEqual(config.route.rules[0].outbound, 'direct');
});

test('TEST 16: Port generation with custom starting port 20000', () => {
  const nodes = [sampleVless1, sampleVless2, { ...sampleVless1, tag: 'Node-3' }];
  const normalized = normalizeNodes(nodes, 20000);

  assert.equal(normalized[0].port, 20000);
  assert.equal(normalized[1].port, 20001);
  assert.equal(normalized[2].port, 20002);
});

test('TEST 17: Manual custom ports survive in config generation', () => {
  const normalized = normalizeNodes([sampleVless1, sampleVless2], 10808);
  normalized[0].port = 12345;
  normalized[1].port = 54321;

  const config = generateConfig({ normalizedNodes: normalized });
  assert.equal(config.inbounds[0].listen_port, 12345);
  assert.equal(config.inbounds[1].listen_port, 54321);
});

test('TEST 18: Disabled node creates no active inbound, outbound, route, or DNS', () => {
  const normalized = normalizeNodes([sampleVless1, sampleVless2], 10808);
  normalized[1].enabled = false; // Disable node 2

  const config = generateConfig({ normalizedNodes: normalized });
  assert.equal(config.inbounds.length, 1);
  assert.equal(config.inbounds[0].tag, 'proxy-in-01');

  // Outbounds: 1 proxy-out + direct + block
  assert.equal(config.outbounds.length, 3);
  assert.equal(config.outbounds[0].tag, 'proxy-out-01');

  assert.equal(config.route.rules.length, 1);
  assert.equal(config.dns.rules.filter(r => r.inbound).length, 1);
});

test('TEST 19: Empty input handling throws clear error', () => {
  assert.throws(() => {
    parseInput('');
  }, /Empty input/);

  assert.throws(() => {
    parseInput('   ');
  }, /Empty input/);
});

test('TEST 20: Control outbounds alone throw no usable proxy nodes error', () => {
  const controlOnly = [
    { type: 'direct', tag: 'direct' },
    { type: 'block', tag: 'block' },
    { type: 'selector', tag: 'select' }
  ];

  assert.throws(() => {
    parseInput(JSON.stringify(controlOnly));
  }, /No usable proxy outbounds found/);
});

test('TEST 21: Complex VLESS fields are fully preserved without mutation', () => {
  const complexNode = {
    type: 'vless',
    tag: 'Complex',
    server: 'complex.example.com',
    server_port: 443,
    uuid: '11111111-2222-3333-4444-555555555555',
    flow: 'xtls-rprx-vision',
    network: 'tcp',
    tls: {
      enabled: true,
      server_name: 'complex.example.com',
      insecure: false,
      alpn: ['h2', 'http/1.1']
    },
    multiplex: {
      enabled: true,
      protocol: 'smux',
      max_streams: 32
    },
    custom_experimental_field: 'preserved_value'
  };

  const normalized = normalizeNodes([complexNode], 10808);
  const config = generateConfig({ normalizedNodes: normalized });

  const generated = config.outbounds[0];
  assert.equal(generated.network, 'tcp');
  assert.deepEqual(generated.multiplex, complexNode.multiplex);
  assert.equal(generated.custom_experimental_field, 'preserved_value');
  assert.deepEqual(generated.tls.alpn, ['h2', 'http/1.1']);
});

test('TEST 22: Tag collision resilience with special characters in original tags', () => {
  const weirdNodes = [
    { ...sampleVless1, tag: '节点 01 [VIP] (50% OFF) / 德国' },
    { ...sampleVless2, tag: '/// special ::: tags ???' }
  ];

  const normalized = normalizeNodes(weirdNodes, 10808);
  assert.equal(normalized[0].outboundTag, 'proxy-out-01');
  assert.equal(normalized[1].outboundTag, 'proxy-out-02');

  const config = generateConfig({ normalizedNodes: normalized });
  const validation = validateGeneratedConfig(config, normalized);
  assert.equal(validation.valid, true);

  const check = runSingBoxCheck(config);
  assert.equal(check.success, true, check.error);
});

test('TEST 23: Nodes with missing tag generate safe display identifiers', () => {
  const untaggedNode = {
    type: 'vless',
    server: 'notag.example.com',
    server_port: 443,
    uuid: '12345678-1234-1234-1234-123456789012'
  };

  const normalized = normalizeNodes([untaggedNode], 10808);
  assert.equal(normalized[0].originalTag, 'node-01');
  assert.equal(normalized[0].outboundTag, 'proxy-out-01');

  const config = generateConfig({ normalizedNodes: normalized });
  const validation = validateGeneratedConfig(config, normalized);
  assert.equal(validation.valid, true);
});

test('TEST 24: Generated mixed inbound is valid for sing-box 1.13.18', () => {
  const normalized = normalizeNodes([sampleVless1], 10808, '127.0.0.1');
  const config = generateConfig({ normalizedNodes: normalized });

  const inbound = config.inbounds[0];
  assert.equal(inbound.type, 'mixed');
  assert.equal(inbound.listen, '127.0.0.1');
  assert.equal(inbound.listen_port, 10808);

  const check = runSingBoxCheck(config);
  assert.equal(check.success, true, check.error);
});

test('TEST 25: Parse real vless:// links from links.txt (17 nodes) and validate with sing-box check', () => {
  const linksContent = fs.readFileSync(path.join(process.cwd(), 'links.txt'), 'utf8');
  const parsed = parseInput(linksContent);
  assert.equal(parsed.length, 17);

  const normalized = normalizeNodes(parsed, 10808);
  assert.equal(normalized.length, 17);

  const config = generateConfig({ normalizedNodes: normalized });
  const validation = validateGeneratedConfig(config, normalized);
  assert.equal(validation.valid, true, `Validation failed: ${validation.errors.join(', ')}`);

  assert.equal(config.inbounds.length, 17);
  assert.equal(config.outbounds.length, 19); // 17 proxy outbounds + direct + block
  assert.equal(config.route.rules.length, 17);
  assert.equal(config.dns.servers.length, 18); // 17 dns servers + local_dns

  const check = runSingBoxCheck(config);
  assert.equal(check.success, true, check.error);
});

test('TEST 26: Parse Base64 subscription string containing vless:// links', () => {
  const rawLinks = fs.readFileSync(path.join(process.cwd(), 'links.txt'), 'utf8');
  const base64Content = Buffer.from(rawLinks, 'utf8').toString('base64');

  const parsed = parseInput(base64Content);
  assert.equal(parsed.length, 17);

  const normalized = normalizeNodes(parsed, 10808);
  const config = generateConfig({ normalizedNodes: normalized });
  const validation = validateGeneratedConfig(config, normalized);
  assert.equal(validation.valid, true);

  const check = runSingBoxCheck(config);
  assert.equal(check.success, true, check.error);
});
