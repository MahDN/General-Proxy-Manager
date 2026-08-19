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
  resequencePorts,
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

const SAMPLE_TEST_VLESS_LINKS = `vless://c55bcf9d-5faf-4a44-b737-7a59ca9d0707@sv7.nonpath.ir:42542?encryption=none&type=http&host=us.demonware.net&path=/&method=GET&packetEncoding=xudp#MagicNet%20VLESS
vless://c55bcf9d-5faf-4a44-b737-7a59ca9d0707@sv0.nonpath.ir:42542?encryption=none&type=http&host=us.demonware.net&path=/&method=GET&packetEncoding=xudp#MagicNet%20Irancell%201
vless://c55bcf9d-5faf-4a44-b737-7a59ca9d0707@sv1.mobileemdad.top:443?encryption=none&security=reality&sni=us.demonware.net&fp=edge&pbk=PjR-SM4fOm2fY4mTqWoqZDRyxontvpailM0gBqUxlUQ&sid=cbe2503ffd040d&packetEncoding=xudp#MagicNet%20Germany
vless://c55bcf9d-5faf-4a44-b737-7a59ca9d0707@pt-play.mobileemdad.top:443?encryption=none&security=reality&sni=us.demonware.net&fp=qq&pbk=PjR-SM4fOm2fY4mTqWoqZDRyxontvpailM0gBqUxlUQ&sid=aefc7f3722&packetEncoding=xudp#MagicNet%20FI`;

test('TEST 25: Parse real vless:// links (multi-node) and validate with sing-box check', () => {
  let linksContent = SAMPLE_TEST_VLESS_LINKS;
  const linksPath = path.join(process.cwd(), 'links.txt');
  if (fs.existsSync(linksPath)) {
    linksContent = fs.readFileSync(linksPath, 'utf8');
  }
  const parsed = parseInput(linksContent);
  assert.ok(parsed.length >= 4);

  const normalized = normalizeNodes(parsed, 10808);
  assert.equal(normalized.length, parsed.length);

  const config = generateConfig({ normalizedNodes: normalized });
  const validation = validateGeneratedConfig(config, normalized);
  assert.equal(validation.valid, true, `Validation failed: ${validation.errors.join(', ')}`);

  assert.equal(config.inbounds.length, parsed.length);
  assert.equal(config.outbounds.length, parsed.length + 2); // proxy outbounds + direct + block
  assert.equal(config.route.rules.length, parsed.length);
  assert.equal(config.dns.servers.length, parsed.length + 1); // dns servers + local_dns

  const check = runSingBoxCheck(config);
  assert.equal(check.success, true, check.error);
});

test('TEST 26: Parse Base64 subscription string containing vless:// links', () => {
  let rawLinks = SAMPLE_TEST_VLESS_LINKS;
  const linksPath = path.join(process.cwd(), 'links.txt');
  if (fs.existsSync(linksPath)) {
    rawLinks = fs.readFileSync(linksPath, 'utf8');
  }
  const base64Content = Buffer.from(rawLinks, 'utf8').toString('base64');

  const parsed = parseInput(base64Content);
  assert.ok(parsed.length >= 4);

  const normalized = normalizeNodes(parsed, 10808);
  const config = generateConfig({ normalizedNodes: normalized });
  const validation = validateGeneratedConfig(config, normalized);
  assert.equal(validation.valid, true);

  const check = runSingBoxCheck(config);
  assert.equal(check.success, true, check.error);
});

test('TEST 27: Resequencing ports without gaps when some nodes are disabled', () => {
  const raw = [sampleVless1, sampleVless2, sampleVless1, sampleVless2, sampleVless1];
  const normalized = normalizeNodes(raw, 20801);
  assert.equal(normalized.length, 5);

  // Disable node 1 and node 3 (0-indexed: 1 and 3)
  normalized[1].enabled = false;
  normalized[3].enabled = false;

  resequencePorts(normalized, 20801);
  assert.equal(normalized[0].port, 20801);
  assert.equal(normalized[1].port, null);
  assert.equal(normalized[2].port, 20802);
  assert.equal(normalized[3].port, null);
  assert.equal(normalized[4].port, 20803);

  const config = generateConfig({ normalizedNodes: normalized, enableMasterPort: false });
  assert.equal(config.inbounds.length, 3);
  assert.equal(config.inbounds[0].listen_port, 20801);
  assert.equal(config.inbounds[1].listen_port, 20802);
  assert.equal(config.inbounds[2].listen_port, 20803);
});

test('TEST 28: Trojan share link parsing', () => {
  const trojanLink = 'trojan://myPassword123@trojan.example.com:443?security=tls&sni=sni.example.com&type=ws&path=%2Fws#MyTrojanNode';
  const parsed = parseInput(trojanLink);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].type, 'trojan');
  assert.equal(parsed[0].server, 'trojan.example.com');
  assert.equal(parsed[0].server_port, 443);
  assert.equal(parsed[0].password, 'myPassword123');
  assert.equal(parsed[0].tls.server_name, 'sni.example.com');
  assert.equal(parsed[0].transport.type, 'ws');
  assert.equal(parsed[0].transport.path, '/ws');
  assert.equal(parsed[0].tag, 'MyTrojanNode');
});

test('TEST 29: Shadowsocks SIP002 share link parsing', () => {
  // aes-256-gcm:secret123 -> YWVzLTI1Ni1nY206c2VjcmV0MTIz
  const ssLink = 'ss://YWVzLTI1Ni1nY206c2VjcmV0MTIz@ss.example.com:8388#MyShadowsocksNode';
  const parsed = parseInput(ssLink);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].type, 'shadowsocks');
  assert.equal(parsed[0].server, 'ss.example.com');
  assert.equal(parsed[0].server_port, 8388);
  assert.equal(parsed[0].method, 'aes-256-gcm');
  assert.equal(parsed[0].password, 'secret123');
  assert.equal(parsed[0].tag, 'MyShadowsocksNode');
});

test('TEST 30: Hysteria 2 share link parsing (hy2:// & hysteria2://)', () => {
  const hy2Link = 'hy2://hy2Pass@hy2.example.com:8443?sni=hy2.example.com&insecure=1&obfs=salamander&obfs-password=obfs123#MyHysteria2Node';
  const parsed = parseInput(hy2Link);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].type, 'hysteria2');
  assert.equal(parsed[0].server, 'hy2.example.com');
  assert.equal(parsed[0].server_port, 8443);
  assert.equal(parsed[0].password, 'hy2Pass');
  assert.equal(parsed[0].tls.insecure, true);
  assert.equal(parsed[0].obfs.type, 'salamander');
  assert.equal(parsed[0].obfs.password, 'obfs123');
  assert.equal(parsed[0].tag, 'MyHysteria2Node');
});

test('TEST 31: WireGuard share link parsing', () => {
  const wgLink = 'wireguard://aGVsbG93b3JsZHByaXZhdGVrZXkxMjM0NTY3ODkwMTI=@wg.example.com:51820?public_key=cHVibGlja2V5MTIzNDU2Nzg5MDEyMzQ1Njc4OTA=&ip=10.0.0.2/32&reserved=1,2,3#MyWireGuardNode';
  const parsed = parseInput(wgLink);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].type, 'wireguard');
  assert.equal(parsed[0].server, 'wg.example.com');
  assert.equal(parsed[0].server_port, 51820);
  assert.equal(parsed[0].local_address[0], '10.0.0.2/32');
  assert.deepEqual(parsed[0].reserved, [1, 2, 3]);
  assert.equal(parsed[0].tag, 'MyWireGuardNode');
});

test('TEST 32: Mixed multi-protocol subscription (VLESS + Trojan + SS + Hysteria2 + WireGuard)', () => {
  const mixedLinks = [
    'vless://550e8400-e29b-41d4-a716-446655440000@vless.example.com:443?security=tls#VlessNode',
    'trojan://pass1@trojan.example.com:443?security=tls#TrojanNode',
    'ss://YWVzLTI1Ni1nY206c2VjcmV0MTIz@ss.example.com:8388#SSNode',
    'hy2://hy2pass@hy2.example.com:443#Hy2Node',
    'wireguard://cHJpdmF0ZWtleTEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=@wg.example.com:51820?public_key=cHVibGlja2V5MTIzNDU2Nzg5MDEyMzQ1Njc4OTA=#WgNode'
  ].join('\n');

  const parsed = parseInput(mixedLinks);
  assert.equal(parsed.length, 5);
  const types = parsed.map(n => n.type);
  assert.deepEqual(types, ['vless', 'trojan', 'shadowsocks', 'hysteria2', 'wireguard']);
});

test('TEST 33: Master Port 20800 and auto-fastest urltest outbound generation', () => {
  const raw = [sampleVless1, sampleVless2];
  const normalized = normalizeNodes(raw, 20801);
  const config = generateConfig({
    normalizedNodes: normalized,
    enableMasterPort: true,
    masterPort: 20800
  });

  // Master inbound + 2 individual inbounds
  assert.equal(config.inbounds.length, 3);
  assert.equal(config.inbounds[0].tag, 'master-in');
  assert.equal(config.inbounds[0].listen_port, 20800);
  assert.equal(config.inbounds[1].listen_port, 20801);
  assert.equal(config.inbounds[2].listen_port, 20802);

  // Auto-fastest urltest outbound
  const autoFastest = config.outbounds.find(o => o.tag === 'auto-fastest');
  assert.ok(autoFastest);
  assert.equal(autoFastest.type, 'urltest');
  assert.deepEqual(autoFastest.outbounds, ['proxy-out-01', 'proxy-out-02']);

  // Route rule for master-in
  const masterRoute = config.route.rules.find(r => r.inbound === 'master-in');
  assert.ok(masterRoute);
  assert.equal(masterRoute.outbound, 'auto-fastest');

  // Clash API experimental controller
  assert.ok(config.experimental);
  assert.ok(config.experimental.clash_api);
  assert.equal(config.experimental.clash_api.external_controller, '127.0.0.1:9090');

  const check = runSingBoxCheck(config);
  assert.equal(check.success, true, check.error);
});

test('TEST 34: Multi-protocol configuration with Master Port passes sing-box 1.13.18 check', () => {
  const mixedLinks = [
    'vless://550e8400-e29b-41d4-a716-446655440000@1.1.1.1:443?security=tls#Vless1',
    'trojan://myPassword123@1.1.1.1:443?security=tls#Trojan1',
    'ss://YWVzLTI1Ni1nY206c2VjcmV0MTIz@1.1.1.1:8388#SS1',
    'hy2://hy2Pass@1.1.1.1:8443#Hy2_1',
    'wireguard://aGVsbG93b3JsZHByaXZhdGVrZXkxMjM0NTY3ODkwMTI=@1.1.1.1:51820?public_key=cHVibGlja2V5MTIzNDU2Nzg5MDEyMzQ1Njc4OTA=&ip=10.0.0.2/32#Wg1'
  ].join('\n');

  const parsed = parseInput(mixedLinks);
  const normalized = normalizeNodes(parsed, 20801);
  const config = generateConfig({
    normalizedNodes: normalized,
    enableMasterPort: true,
    masterPort: 20800
  });

  const validation = validateGeneratedConfig(config, normalized);
  assert.equal(validation.valid, true);

  const check = runSingBoxCheck(config);
  assert.equal(check.success, true, check.error);
});


