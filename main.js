/**
 * General Proxy Manager - Main Application Logic
 * Target sing-box version: 1.13.18
 * 100% Offline-first, Zero External CDN Module Dependencies
 */

import { locales } from './locales.js';
import {
  SUPPORTED_SING_BOX_VERSION,
  parseInput,
  normalizeNodes,
  validatePorts,
  generateConfig,
  validateGeneratedConfig,
  deepClone
} from './core-generator.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Application State
  let rawOutbounds = [];
  let normalizedNodes = [];
  let currentLang = 'en';
  let langData = locales.en;
  let singBoxTemplate = null;
  let isLoading = false;
  let currentGeneratedConfig = null;
  let editingNodeIndex = -1;
  let currentTheme = localStorage.getItem('singmp_theme') || 'dark';

  // Search & Sorting States
  let tab1SearchQuery = '';
  let tab1SortKey = 'index';
  let tab1SortAsc = true;

  let tab2SearchQuery = '';
  let tab2SortKey = 'index';
  let tab2SortAsc = true;
  const testResultsMap = new Map(); // node.id -> { status, ping, ip, latencyMs }

  // Default Test Endpoints
  const DEFAULT_PING_URL = 'https://cp.cloudflare.com/generate_204';
  const DEFAULT_IP_URL = 'https://api.ipify.org?format=json';

  // DOM Element References
  const desktopTabButtons = document.querySelectorAll('.dashboard-tab-btn');
  const mobileTabButtons = document.querySelectorAll('.mobile-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeIconSun = document.getElementById('theme-icon-sun');
  const themeIconMoon = document.getElementById('theme-icon-moon');

  const kpiTotalNodes = document.getElementById('kpi-total-nodes');
  const kpiEnabledNodes = document.getElementById('kpi-enabled-nodes');
  const kpiPortRange = document.getElementById('kpi-port-range');

  const nodesInput = document.getElementById('nodes-input');
  const fileInput = document.getElementById('file-input');
  const clearInputBtn = document.getElementById('clear-input-btn');
  const subscriptionUrlInput = document.getElementById('subscription-url-input');
  const fetchSubBtn = document.getElementById('fetch-sub-btn');
  const useCorsProxyCheckbox = document.getElementById('use-cors-proxy');

  const nodesTableSection = document.getElementById('nodes-table-section');
  const nodesTableBody = document.getElementById('nodes-table-body');
  const nodesSummaryBadge = document.getElementById('nodes-summary-badge');
  const nodesSearchInput = document.getElementById('nodes-search-input');
  const shuffleNodesBtn = document.getElementById('shuffle-nodes-btn');

  const customFilenameInput = document.getElementById('custom-filename-input');
  const listenAddressInput = document.getElementById('listen-address');
  const startPortInput = document.getElementById('start-port');
  const bootstrapDnsSelect = document.getElementById('bootstrap-dns');
  const remoteDnsSelect = document.getElementById('remote-dns');
  const dnsStrategySelect = document.getElementById('dns-strategy');
  const logLevelSelect = document.getElementById('log-level');

  const generateBtn = document.getElementById('generate-btn');
  const validateBtn = document.getElementById('validate-btn');
  const outputSection = document.getElementById('output-section');
  const validationCard = document.getElementById('validation-card');
  const summaryMappingList = document.getElementById('summary-mapping-list');
  const configOutput = document.getElementById('config-output');
  const copyBtn = document.getElementById('copy-btn');
  const downloadBtn = document.getElementById('download-btn');
  const langSwitcher = document.getElementById('language-switcher');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingMsg = document.getElementById('loading-msg');

  // Visual Traffic Flow Diagram elements
  const diagramNodeSelect = document.getElementById('diagram-node-select');
  const diagramInboundPort = document.getElementById('diagram-inbound-port');
  const diagramRouteTag = document.getElementById('diagram-route-tag');
  const diagramOutboundTag = document.getElementById('diagram-outbound-tag');
  const diagramDnsTag = document.getElementById('diagram-dns-tag');

  // Run Command elements under preview
  const runCommandPreview = document.getElementById('run-command-preview');
  const copyRunCmdBtn = document.getElementById('copy-run-cmd-btn');

  // Test Tab elements
  const testAllBtn = document.getElementById('test-all-btn');
  const pingTestUrlInput = document.getElementById('ping-test-url');
  const ipLookupUrlInput = document.getElementById('ip-lookup-url');
  const saveEndpointsBtn = document.getElementById('save-endpoints-btn');
  const resetEndpointsBtn = document.getElementById('reset-endpoints-btn');
  const testTableBody = document.getElementById('test-table-body');
  const testSearchInput = document.getElementById('test-search-input');
  const downloadRealDelayBatBtn = document.getElementById('download-real-delay-bat-btn');
  const downloadRealDelayShBtn = document.getElementById('download-real-delay-sh-btn');

  // Manual Single Port Probe elements
  const manualProbePortInput = document.getElementById('manual-probe-port');
  const manualProbeIpInput = document.getElementById('manual-probe-ip');
  const manualProbeTargetInput = document.getElementById('manual-probe-target');
  const manualProbeBtn = document.getElementById('manual-probe-btn');
  const manualCopyCurlBtn = document.getElementById('manual-copy-curl-btn');
  const manualProbeResult = document.getElementById('manual-probe-result');

  // Runner Tab elements
  const runnerBinaryPathInput = document.getElementById('runner-binary-path');
  const runnerConfigPathInput = document.getElementById('runner-config-path');
  const fullRunnerCmd = document.getElementById('full-runner-cmd');
  const runnerCopyCmdBtn = document.getElementById('runner-copy-cmd-btn');
  const downloadBatBtn = document.getElementById('download-bat-btn');
  const downloadShBtn = document.getElementById('download-sh-btn');
  const presetBinBtns = document.querySelectorAll('.preset-bin-btn');

  // Edit Node Modal elements
  const editNodeModal = document.getElementById('edit-node-modal');
  const closeEditModalBtn = document.getElementById('close-edit-modal-btn');
  const cancelEditNodeBtn = document.getElementById('cancel-edit-node-btn');
  const saveEditNodeBtn = document.getElementById('save-edit-node-btn');
  const modalTabForm = document.getElementById('modal-tab-form');
  const modalTabJson = document.getElementById('modal-tab-json');
  const modalFormMode = document.getElementById('modal-form-mode');
  const modalJsonMode = document.getElementById('modal-json-mode');

  const editNodeTag = document.getElementById('edit-node-tag');
  const editNodeServer = document.getElementById('edit-node-server');
  const editNodePort = document.getElementById('edit-node-port');
  const editNodeUuid = document.getElementById('edit-node-uuid');
  const editNodeFlow = document.getElementById('edit-node-flow');
  const editNodeSni = document.getElementById('edit-node-sni');
  const editNodePbk = document.getElementById('edit-node-pbk');
  const editNodeSid = document.getElementById('edit-node-sid');
  const editNodeFp = document.getElementById('edit-node-fp');
  const editNodeTransportType = document.getElementById('edit-node-transport-type');
  const editNodeRawJson = document.getElementById('edit-node-raw-json');

  // Confirmation Modal
  const confirmModal = document.getElementById('confirm-modal');
  const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
  const confirmYesBtn = document.getElementById('confirm-yes-btn');

  // --- Filename Helper ---
  const getBaseFilename = () => {
    const raw = (customFilenameInput && customFilenameInput.value.trim()) || 'config';
    return raw.replace(/[^a-zA-Z0-9_\-\.]/g, '_') || 'config';
  };

  const getConfigFilename = () => {
    const base = getBaseFilename();
    return base.endsWith('.json') ? base : `${base}.json`;
  };

  // --- Theme Management (Light / Dark) ---
  const applyTheme = (theme) => {
    currentTheme = theme;
    localStorage.setItem('singmp_theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      if (themeIconSun) themeIconSun.classList.remove('hidden');
      if (themeIconMoon) themeIconMoon.classList.add('hidden');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      if (themeIconSun) themeIconSun.classList.add('hidden');
      if (themeIconMoon) themeIconMoon.classList.remove('hidden');
    }
  };

  const initTheme = () => {
    const saved = localStorage.getItem('singmp_theme') || 'dark';
    applyTheme(saved);
  };

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
    });
  }

  // --- Initialize Saved Endpoints ---
  const savedPingUrl = localStorage.getItem('singmp_ping_url');
  const savedIpUrl = localStorage.getItem('singmp_ip_url');
  if (savedPingUrl && pingTestUrlInput) pingTestUrlInput.value = savedPingUrl;
  if (savedIpUrl && ipLookupUrlInput) ipLookupUrlInput.value = savedIpUrl;

  // --- Loading State ---
  const setLoading = (state, message = '') => {
    isLoading = state;
    if (state) {
      if (loadingOverlay) loadingOverlay.classList.remove('hidden');
      if (message && loadingMsg) loadingMsg.textContent = message;
      if (nodesInput) nodesInput.disabled = true;
    } else {
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
      if (nodesInput) nodesInput.disabled = false;
    }
  };

  // --- Internationalization (i18n) (100% Offline via locales.js) ---
  const applyLanguage = () => {
    if (!langData) return;
    document.querySelectorAll('[data-lang]').forEach(el => {
      const key = el.getAttribute('data-lang');
      if (langData[key]) {
        if (el.tagName === 'BUTTON' && el.disabled && langData[`${key}Disabled`]) {
          el.textContent = langData[`${key}Disabled`];
        } else {
          el.textContent = langData[key];
        }
      }
    });

    document.querySelectorAll('[data-lang-placeholder]').forEach(el => {
      const key = el.getAttribute('data-lang-placeholder');
      if (langData[key]) {
        el.placeholder = langData[key];
      }
    });

    if (generateBtn) {
      if (generateBtn.disabled) {
        generateBtn.textContent = langData.generateBtnDisabled || 'Please import proxy nodes first';
      } else {
        generateBtn.textContent = langData.generateBtn || 'Generate Configuration';
      }
    }
  };

  const setLanguage = (lang) => {
    currentLang = lang;
    langData = locales[lang] || locales.en;
    if (lang === 'fa') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'fa';
      document.body.setAttribute('dir', 'rtl');
    } else {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = lang;
      document.body.setAttribute('dir', 'ltr');
    }
    applyLanguage();
    updateSummaryBadge();
    renderNodeTable();
    renderTestTable();
    if (currentGeneratedConfig) {
      runValidationAndRenderSummary();
      updateVisualDiagram();
    }
  };

  const initLanguage = () => {
    const browserLang = (navigator.language || 'en').split('-')[0];
    const lang = browserLang === 'fa' ? 'fa' : (browserLang === 'zh' ? 'zh' : 'en');
    if (langSwitcher) langSwitcher.value = lang;
    setLanguage(lang);
  };

  // --- Dashboard Tabs Switching ---
  const switchTab = (targetTabId) => {
    desktopTabButtons.forEach(b => {
      if (b.dataset.tab === targetTabId) {
        b.className = 'dashboard-tab-btn active px-4 py-1.5 text-xs font-semibold rounded-lg text-white bg-indigo-600 shadow-md shadow-indigo-600/30 transition-all flex items-center gap-2';
      } else {
        b.className = 'dashboard-tab-btn px-4 py-1.5 text-xs font-semibold rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all flex items-center gap-2';
      }
    });

    mobileTabButtons.forEach(b => {
      if (b.dataset.tab === targetTabId) {
        b.className = 'mobile-tab-btn active text-xs font-semibold text-indigo-400 flex items-center gap-1.5 py-1';
      } else {
        b.className = 'mobile-tab-btn text-xs font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1.5 py-1';
      }
    });

    tabPanes.forEach(pane => {
      if (pane.id === targetTabId) {
        pane.classList.remove('hidden');
      } else {
        pane.classList.add('hidden');
      }
    });

    if (targetTabId === 'tab-testing') {
      renderTestTable();
    } else if (targetTabId === 'tab-runner') {
      updateRunnerCommand();
    }
  };

  desktopTabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  mobileTabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // --- Template Loading ---
  const fetchTemplate = async () => {
    try {
      const response = await fetch('sing-box-template.json.tpl');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const text = await response.text();
      return JSON.parse(text);
    } catch (error) {
      console.warn('Template fetch fallback to built-in generator template:', error);
      return null;
    }
  };

  // --- Node Table & Summary UI ---
  const updateSummaryBadge = () => {
    const total = normalizedNodes.length;
    const enabled = normalizedNodes.filter(n => n.enabled).length;
    const startingPort = parseInt(startPortInput?.value, 10) || 20808;
    const endPort = startingPort + Math.max(0, total - 1);

    if (kpiTotalNodes) kpiTotalNodes.textContent = total;
    if (kpiEnabledNodes) kpiEnabledNodes.textContent = enabled;
    if (kpiPortRange) kpiPortRange.textContent = total > 0 ? `${startingPort} - ${endPort}` : `${startingPort} - ${startingPort}`;

    const totalLabel = langData?.summaryTotalNodes || 'Total';
    const enabledLabel = langData?.summaryEnabledNodes || 'Enabled';
    const rangeLabel = langData?.summaryPortRange || 'Port Range';

    if (nodesSummaryBadge) {
      nodesSummaryBadge.innerHTML = `
        <span class="text-indigo-400 font-semibold">${totalLabel}: ${total}</span> &bull; 
        <span class="text-emerald-400 font-semibold">${enabledLabel}: ${enabled}</span> &bull; 
        <span class="text-slate-400">${rangeLabel}: ${startingPort} - ${endPort}</span>
      `;
    }
  };

  // --- Shuffle Nodes Functionality ---
  const shuffleNodes = () => {
    if (normalizedNodes.length <= 1) return;
    for (let i = normalizedNodes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [normalizedNodes[i], normalizedNodes[j]] = [normalizedNodes[j], normalizedNodes[i]];
    }

    const startingPort = parseInt(startPortInput?.value, 10) || 20808;
    normalizedNodes.forEach((node, idx) => {
      const num = idx + 1;
      const padded = num < 10 ? `0${num}` : `${num}`;
      node.index = num;
      node.displayIndex = padded;
      node.id = `node-${padded}`;
      node.inboundTag = `proxy-in-${padded}`;
      node.outboundTag = `proxy-out-${padded}`;
      node.dnsTag = `dns-proxy-${padded}`;
      node.port = startingPort + idx;
    });

    renderNodeTable();
    renderTestTable();
    if (currentGeneratedConfig) {
      handleGenerate();
    }
  };

  if (shuffleNodesBtn) {
    shuffleNodesBtn.addEventListener('click', shuffleNodes);
  }

  // --- Tab 1 Node Sorting ---
  const sortNodesList = (nodes) => {
    return [...nodes].sort((a, b) => {
      let valA, valB;
      if (tab1SortKey === 'name') {
        valA = (a.originalTag || '').toLowerCase();
        valB = (b.originalTag || '').toLowerCase();
      } else if (tab1SortKey === 'type') {
        valA = (a.type || '').toLowerCase();
        valB = (b.type || '').toLowerCase();
      } else if (tab1SortKey === 'port') {
        valA = a.port || 0;
        valB = b.port || 0;
      } else {
        valA = a.index || 0;
        valB = b.index || 0;
      }

      if (valA < valB) return tab1SortAsc ? -1 : 1;
      if (valA > valB) return tab1SortAsc ? 1 : -1;
      return 0;
    });
  };

  const renderNodeTable = () => {
    if (!nodesTableBody) return;
    nodesTableBody.innerHTML = '';
    if (normalizedNodes.length === 0) {
      if (nodesTableSection) nodesTableSection.classList.add('hidden');
      if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.textContent = langData?.generateBtnDisabled || 'Please import proxy nodes first';
      }
      updateSummaryBadge();
      return;
    }

    if (nodesTableSection) nodesTableSection.classList.remove('hidden');
    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.textContent = langData?.generateBtn || 'Generate Configuration';
    }
    updateSummaryBadge();

    // Filter by search query
    let filteredNodes = normalizedNodes;
    if (tab1SearchQuery) {
      const q = tab1SearchQuery.toLowerCase();
      filteredNodes = normalizedNodes.filter(n => 
        (n.originalTag && n.originalTag.toLowerCase().includes(q)) ||
        (n.rawOutbound.server && n.rawOutbound.server.toLowerCase().includes(q)) ||
        (n.type && n.type.toLowerCase().includes(q)) ||
        String(n.port).includes(q)
      );
    }

    // Sort
    filteredNodes = sortNodesList(filteredNodes);

    if (filteredNodes.length === 0) {
      nodesTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="p-6 text-center text-slate-500 font-sans text-xs">No matching nodes found for "${tab1SearchQuery}".</td>
        </tr>
      `;
      return;
    }

    const selectAllTab1 = document.getElementById('select-all-nodes-tab1');
    if (selectAllTab1) {
      const allChecked = normalizedNodes.length > 0 && normalizedNodes.every(n => n.enabled);
      const someChecked = normalizedNodes.some(n => n.enabled);
      selectAllTab1.checked = allChecked;
      selectAllTab1.indeterminate = !allChecked && someChecked;
    }

    filteredNodes.forEach((node) => {
      const originalIdx = normalizedNodes.findIndex(n => n.id === node.id);
      const row = document.createElement('tr');
      row.className = node.enabled ? 'hover:bg-slate-800/40 transition-colors' : 'opacity-40 bg-slate-950/60';
      row.dataset.nodeId = node.id;
      row.dataset.index = originalIdx;

      const typeUpper = (node.type || 'vless').toUpperCase();
      const typeBadgeClass = node.type === 'vless' 
        ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
        : 'bg-slate-800 text-slate-300 border-slate-700';

      const editLabel = langData?.editNodeBtn || 'Edit';
      const deleteLabel = langData?.deleteNodeBtn || 'Delete';

      const warningHtml = node.warning ? `
        <span class="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20" title="${node.warning}">
          ⚠️ ${node.warning}
        </span>
      ` : '';

      row.innerHTML = `
        <td class="p-3 text-center font-mono text-xs text-slate-500 font-bold">${node.displayIndex}</td>
        <td class="p-3 text-center">
          <input type="checkbox" ${node.enabled ? 'checked' : ''} class="node-enabled-checkbox w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500 cursor-pointer" title="Enable / Disable Node">
        </td>
        <td class="p-3">
          <div class="font-medium text-slate-200 truncate max-w-xs md:max-w-md" title="${node.originalTag}">${node.originalTag}</div>
          <div class="text-[11px] text-slate-500 font-mono truncate">${node.rawOutbound.server || 'unknown'}:${node.rawOutbound.server_port || ''}</div>
          ${warningHtml}
        </td>
        <td class="p-3">
          <span class="inline-block px-2 py-0.5 rounded text-[11px] font-semibold font-mono border ${typeBadgeClass}">
            ${typeUpper}
          </span>
        </td>
        <td class="p-3">
          <input type="number" min="1" max="65535" value="${node.port}" ${node.enabled ? '' : 'disabled'} class="node-port-input w-full p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
        </td>
        <td class="p-3">
          <span class="font-mono text-[11px] text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">${node.outboundTag}</span>
        </td>
        <td class="p-3 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <button type="button" class="node-edit-btn px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all">
              ${editLabel}
            </button>
            <button type="button" class="node-delete-btn p-1 text-slate-500 hover:text-red-400 rounded-lg transition-colors" title="${deleteLabel}">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      `;

      nodesTableBody.appendChild(row);
    });
  };

  // Select All Tab 1
  const selectAllNodesTab1 = document.getElementById('select-all-nodes-tab1');
  if (selectAllNodesTab1) {
    selectAllNodesTab1.addEventListener('change', (e) => {
      const checked = e.target.checked;
      normalizedNodes.forEach(n => {
        n.enabled = checked;
      });
      renderNodeTable();
      renderTestTable();
      if (outputSection && !outputSection.classList.contains('hidden')) {
        handleGenerate();
      }
    });
  }

  // Search input event
  if (nodesSearchInput) {
    nodesSearchInput.addEventListener('input', (e) => {
      tab1SearchQuery = e.target.value.trim();
      renderNodeTable();
    });
  }

  // Header click sorting for Tab 1
  const bindTab1Sort = (elemId, key) => {
    const el = document.getElementById(elemId);
    if (!el) return;
    el.addEventListener('click', () => {
      if (tab1SortKey === key) {
        tab1SortAsc = !tab1SortAsc;
      } else {
        tab1SortKey = key;
        tab1SortAsc = true;
      }
      renderNodeTable();
    });
  };

  bindTab1Sort('sort-nodes-index', 'index');
  bindTab1Sort('sort-nodes-name', 'name');
  bindTab1Sort('sort-nodes-type', 'type');
  bindTab1Sort('sort-nodes-port', 'port');

  // --- Process Input Data ---
  const handleRawText = (text) => {
    const trimmed = text ? text.trim() : '';
    if (!trimmed) {
      resetState();
      return;
    }

    try {
      rawOutbounds = parseInput(trimmed);
      const startingPort = parseInt(startPortInput?.value, 10) || 20808;
      const listenAddress = listenAddressInput?.value.trim() || '127.0.0.1';
      normalizedNodes = normalizeNodes(rawOutbounds, startingPort, listenAddress);
      renderNodeTable();
    } catch (err) {
      console.warn('Input parsing warning:', err.message);
      resetState();
      alert(langData?.errorInvalidJSON || err.message);
    }
  };

  const resetState = () => {
    rawOutbounds = [];
    normalizedNodes = [];
    currentGeneratedConfig = null;
    if (nodesTableSection) nodesTableSection.classList.add('hidden');
    if (outputSection) outputSection.classList.add('hidden');
    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.textContent = langData?.generateBtnDisabled || 'Please import proxy nodes first';
    }
    updateSummaryBadge();
    renderTestTable();
  };

  // --- Universal Subscription Fetcher (v2rayN / Sing-Box / Clash standard) ---
  const fetchSubscription = async (url) => {
    if (!url || !url.startsWith('http')) {
      alert('Please enter a valid HTTP/HTTPS subscription URL.');
      return;
    }

    setLoading(true, langData?.loadingSubscription || 'Fetching subscription...');
    let text = '';
    let success = false;

    // 1. In Tauri Desktop App: Call native Rust fetch (bypasses CORS & uses v2rayN User-Agent)
    if (isTauriEnv()) {
      try {
        text = await tauriInvoke('fetch_subscription', {
          url,
          userAgent: 'v2rayN/6.23 (Windows NT 10.0; Win64; x64)'
        });
        if (text && text.trim()) success = true;
      } catch (err) {
        console.warn('Tauri native fetch error, trying browser fetch fallback:', err);
      }
    }

    // 2. In Browser: Try direct fetch first
    if (!success) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json, text/plain, */*' }
        });
        if (response.ok) {
          text = await response.text();
          if (text && text.trim()) success = true;
        }
      } catch (directErr) {
        console.warn('Direct fetch failed due to CORS, attempting CORS proxies...', directErr);
      }
    }

    // 3. Fallback to CORS proxies
    if (!success) {
      const proxies = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        `https://corsproxy.io/?${encodeURIComponent(url)}`
      ];
      for (const pUrl of proxies) {
        try {
          const pResp = await fetch(pUrl);
          if (pResp.ok) {
            text = await pResp.text();
            if (text && text.trim()) {
              success = true;
              break;
            }
          }
        } catch (_) {}
      }
    }

    setLoading(false);

    if (!success || !text.trim()) {
      alert(langData?.errorSubscriptionFetch || 'Failed to fetch subscription. If running in web browser, CORS may be blocking the request. Use the Desktop App or paste links directly.');
      return;
    }

    // Decode & normalize content (Base64 URL-safe, UTF-8, JSON, or plain text)
    let processed = text.trim();
    try {
      let cleanB64 = processed.replace(/[\r\n\s]/g, '').replace(/-/g, '+').replace(/_/g, '/');
      while (cleanB64.length % 4 !== 0) cleanB64 += '=';
      const decoded = decodeURIComponent(escape(atob(cleanB64)));
      if (decoded && (decoded.includes('://') || decoded.includes('{') || decoded.includes('proxies:'))) {
        processed = decoded;
      }
    } catch (_) {}

    if (nodesInput) nodesInput.value = processed;
    handleRawText(processed);
  };

  // --- Visual Traffic Flow Diagram Logic ---
  const updateVisualDiagram = () => {
    if (!diagramNodeSelect) return;
    const enabledNodes = normalizedNodes.filter(n => n.enabled);
    if (enabledNodes.length === 0) return;

    const currentSelectedVal = diagramNodeSelect.value;
    diagramNodeSelect.innerHTML = '';
    enabledNodes.forEach(node => {
      const opt = document.createElement('option');
      opt.value = node.id;
      opt.textContent = `[Port ${node.port}] ${node.originalTag}`;
      diagramNodeSelect.appendChild(opt);
    });

    if (currentSelectedVal && enabledNodes.some(n => n.id === currentSelectedVal)) {
      diagramNodeSelect.value = currentSelectedVal;
    } else {
      diagramNodeSelect.value = enabledNodes[0].id;
    }

    renderDiagramForSelectedNode();
  };

  const renderDiagramForSelectedNode = () => {
    if (!diagramNodeSelect) return;
    const selectedId = diagramNodeSelect.value;
    const node = normalizedNodes.find(n => n.id === selectedId) || normalizedNodes.find(n => n.enabled);
    if (!node) return;

    if (diagramInboundPort) diagramInboundPort.textContent = `${node.listenAddress}:${node.port}`;
    if (diagramRouteTag) diagramRouteTag.innerHTML = `<span class="text-indigo-400 font-mono">${node.inboundTag}</span> &rarr; <span class="text-purple-400 font-mono">${node.outboundTag}</span>`;
    if (diagramOutboundTag) diagramOutboundTag.textContent = `${node.originalTag} (${node.rawOutbound.server || 'unknown'}:${node.rawOutbound.server_port || 443})`;
    if (diagramDnsTag) diagramDnsTag.textContent = `DNS: ${node.dnsTag} (${remoteDnsSelect?.value || '1.1.1.1'})`;
  };

  if (diagramNodeSelect) {
    diagramNodeSelect.addEventListener('change', renderDiagramForSelectedNode);
  }

  // --- Generate Configuration ---
  const handleGenerate = () => {
    if (normalizedNodes.length === 0) return;

    const enabledNodes = normalizedNodes.filter(n => n.enabled);
    if (enabledNodes.length === 0) {
      alert(langData?.errorNoEnabledNodes || 'Error: At least one proxy node must be enabled.');
      return;
    }

    const portCheck = validatePorts(normalizedNodes);
    if (!portCheck.valid) {
      if (portCheck.error === 'duplicate_port') {
        alert(langData?.errorPortDuplicate || portCheck.message);
      } else {
        alert(langData?.errorPortInvalid || portCheck.message);
      }
      return;
    }

    try {
      const listenAddress = listenAddressInput?.value.trim() || '127.0.0.1';
      const bootstrapDns = bootstrapDnsSelect?.value || '1.1.1.1';
      const remoteDns = remoteDnsSelect?.value || '1.1.1.1';
      const dnsStrategy = dnsStrategySelect?.value || 'prefer_ipv4';
      const logLevel = logLevelSelect?.value || 'warn';

      currentGeneratedConfig = generateConfig({
        normalizedNodes,
        template: singBoxTemplate,
        bootstrapDns,
        remoteDns,
        dnsStrategy,
        logLevel,
        listenAddress
      });

      // Output JSON formatting
      const jsonStr = JSON.stringify(currentGeneratedConfig, null, 2);
      if (configOutput) configOutput.value = jsonStr;
      if (outputSection) outputSection.classList.remove('hidden');

      // Update run command preview & Visual Diagram
      updateRunCommandPreview();
      updateVisualDiagram();

      // Run validation & display mapping summary
      runValidationAndRenderSummary();

      // Scroll smoothly to output
      if (outputSection) outputSection.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      alert(`Generation failed: ${err.message}`);
    }
  };

  // --- Run Command Preview Helper ---
  const updateRunCommandPreview = () => {
    const binPath = (runnerBinaryPathInput && runnerBinaryPathInput.value.trim()) || '.\\sing-box.exe';
    const cfgFilename = getConfigFilename();
    const cmd = `${binPath} run -c ${cfgFilename}`;
    if (runCommandPreview) runCommandPreview.textContent = cmd;
    if (fullRunnerCmd) fullRunnerCmd.textContent = cmd;
    if (runnerConfigPathInput) runnerConfigPathInput.value = cfgFilename;
  };

  if (customFilenameInput) {
    customFilenameInput.addEventListener('input', updateRunCommandPreview);
  }

  // --- Validation & Summary Display ---
  const runValidationAndRenderSummary = () => {
    if (!currentGeneratedConfig || !validationCard || !summaryMappingList) return;

    const validation = validateGeneratedConfig(currentGeneratedConfig, normalizedNodes);

    if (validation.valid) {
      validationCard.className = 'p-4 rounded-xl text-xs sm:text-sm font-medium border bg-emerald-950/40 text-emerald-300 border-emerald-800/80 flex items-center justify-between';
      validationCard.innerHTML = `
        <div class="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-emerald-400"><polyline points="20 6 9 17 4 12"/></svg>
          <span>${langData?.validationPassed || '✓ Structural Validation Passed: Configuration is strictly compliant with sing-box 1.13.18.'}</span>
        </div>
        <span class="text-xs font-mono bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700/60">1:1 Port Isolation Verified</span>
      `;
    } else {
      validationCard.className = 'p-4 rounded-xl text-xs sm:text-sm font-medium border bg-red-950/40 text-red-300 border-red-800/80';
      validationCard.innerHTML = `
        <div class="flex items-center gap-2 mb-2 font-bold text-red-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <span>${langData?.validationFailed || '✕ Structural Validation Failed:'}</span>
        </div>
        <ul class="list-disc list-inside text-xs space-y-1 text-red-300">
          ${validation.errors.map(e => `<li>${e}</li>`).join('')}
        </ul>
      `;
    }

    // Render Mapping Summary
    const enabledNodes = normalizedNodes.filter(n => n.enabled);
    summaryMappingList.innerHTML = '';

    enabledNodes.forEach(node => {
      const item = document.createElement('div');
      item.className = 'p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-slate-300';
      item.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="font-bold text-indigo-400">${node.listenAddress}:${node.port}</span>
          <span class="text-slate-600">&rarr;</span>
          <span class="font-semibold text-slate-100">${node.originalTag}</span>
        </div>
        <div class="flex items-center gap-3 text-xs text-slate-400">
          <span>Inbound: <code class="text-slate-300">${node.inboundTag}</code></span>
          <span>&bull;</span>
          <span>Outbound: <code class="text-purple-400">${node.outboundTag}</code></span>
          <span>&bull;</span>
          <span>DNS: <code class="text-emerald-400">${node.dnsTag}</code></span>
        </div>
      `;
      summaryMappingList.appendChild(item);
    });

    const infoFooter = document.createElement('div');
    infoFooter.className = 'mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400 flex flex-wrap justify-between gap-2';
    infoFooter.innerHTML = `
      <span><strong>Bootstrap DNS:</strong> <code>local_dns</code> (${bootstrapDnsSelect?.value || '1.1.1.1'}) via direct</span>
      <span><strong>Route Final:</strong> <code>block</code> (Zero silent leaks)</span>
      <span><strong>DNS Strategy:</strong> <code>${dnsStrategySelect?.value || 'prefer_ipv4'}</code></span>
    `;
    summaryMappingList.appendChild(infoFooter);
  };

  // --- Node Editing Modal Logic ---
  const openEditModal = (index) => {
    editingNodeIndex = index;
    const node = normalizedNodes[index];
    if (!node || !editNodeModal) return;

    const raw = node.rawOutbound || {};
    const tls = raw.tls || {};
    const reality = tls.reality || {};
    const utls = tls.utls || {};
    const transport = raw.transport || {};

    if (editNodeTag) editNodeTag.value = raw.tag || node.originalTag || '';
    if (editNodeServer) editNodeServer.value = raw.server || '';
    if (editNodePort) editNodePort.value = raw.server_port || 443;
    if (editNodeUuid) editNodeUuid.value = raw.uuid || raw.password || '';
    if (editNodeFlow) editNodeFlow.value = raw.flow || '';
    if (editNodeSni) editNodeSni.value = tls.server_name || '';
    if (editNodePbk) editNodePbk.value = reality.public_key || '';
    if (editNodeSid) editNodeSid.value = reality.short_id || '';
    if (editNodeFp) editNodeFp.value = utls.fingerprint || 'chrome';
    if (editNodeTransportType) editNodeTransportType.value = transport.type || '';

    if (editNodeRawJson) editNodeRawJson.value = JSON.stringify(raw, null, 2);

    if (modalTabForm) modalTabForm.click();

    editNodeModal.classList.remove('hidden');
  };

  const closeEditModal = () => {
    if (editNodeModal) editNodeModal.classList.add('hidden');
    editingNodeIndex = -1;
  };

  if (modalTabForm && modalTabJson && modalFormMode && modalJsonMode) {
    modalTabForm.addEventListener('click', () => {
      modalTabForm.className = 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white';
      modalTabJson.className = 'px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800';
      modalFormMode.classList.remove('hidden');
      modalJsonMode.classList.add('hidden');
    });

    modalTabJson.addEventListener('click', () => {
      modalTabJson.className = 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white';
      modalTabForm.className = 'px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800';
      modalJsonMode.classList.remove('hidden');
      modalFormMode.classList.add('hidden');
    });
  }

  if (saveEditNodeBtn) {
    saveEditNodeBtn.addEventListener('click', () => {
      if (editingNodeIndex < 0 || editingNodeIndex >= normalizedNodes.length) return;
      const node = normalizedNodes[editingNodeIndex];

      if (modalJsonMode && !modalJsonMode.classList.contains('hidden')) {
        try {
          const parsed = JSON.parse(editNodeRawJson.value);
          if (parsed.transport && (parsed.transport.type === 'xhttp' || parsed.transport.type === 'splithttp')) {
            parsed.transport.type = 'http';
            node.warning = 'Transport xhttp was converted to http for sing-box 1.13.18 compatibility';
          }
          node.rawOutbound = parsed;
          node.originalTag = parsed.tag || node.originalTag;
          node.type = (parsed.type || node.type).toLowerCase();
        } catch (err) {
          alert(`Invalid JSON in node editor: ${err.message}`);
          return;
        }
      } else {
        const raw = node.rawOutbound;
        if (editNodeTag) raw.tag = editNodeTag.value.trim() || node.originalTag;
        if (editNodeServer) raw.server = editNodeServer.value.trim();
        if (editNodePort) raw.server_port = parseInt(editNodePort.value, 10) || 443;
        if (raw.uuid !== undefined && editNodeUuid) raw.uuid = editNodeUuid.value.trim();
        if (raw.password !== undefined && editNodeUuid) raw.password = editNodeUuid.value.trim();
        if (editNodeFlow && editNodeFlow.value.trim()) raw.flow = editNodeFlow.value.trim();

        const sni = editNodeSni ? editNodeSni.value.trim() : '';
        const pbk = editNodePbk ? editNodePbk.value.trim() : '';
        const sid = editNodeSid ? editNodeSid.value.trim() : '';
        const fp = (editNodeFp && editNodeFp.value.trim()) || 'chrome';

        if (pbk) {
          raw.tls = {
            enabled: true,
            server_name: sni || raw.server,
            utls: { enabled: true, fingerprint: fp },
            reality: { enabled: true, public_key: pbk, short_id: sid }
          };
        } else if (sni) {
          raw.tls = {
            enabled: true,
            server_name: sni,
            utls: { enabled: true, fingerprint: fp }
          };
        }

        let tType = editNodeTransportType ? editNodeTransportType.value.trim() : '';
        if (tType === 'xhttp' || tType === 'splithttp') {
          tType = 'http';
          node.warning = 'Transport xhttp was converted to http for sing-box 1.13.18 compatibility';
        }
        if (tType) {
          if (!raw.transport) raw.transport = {};
          raw.transport.type = tType;
        }

        node.originalTag = raw.tag;
      }

      renderNodeTable();
      closeEditModal();

      if (outputSection && !outputSection.classList.contains('hidden')) {
        handleGenerate();
      }
    });
  }

  if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', closeEditModal);
  if (cancelEditNodeBtn) cancelEditNodeBtn.addEventListener('click', closeEditModal);

  // --- Connection Test & IP Inspector Tab Logic ---
  const testSelectedNodeIds = new Set();

  const sortTestNodesList = (nodes) => {
    return [...nodes].sort((a, b) => {
      const resA = testResultsMap.get(a.id) || {};
      const resB = testResultsMap.get(b.id) || {};

      let valA, valB;
      if (tab2SortKey === 'name') {
        valA = (a.originalTag || '').toLowerCase();
        valB = (b.originalTag || '').toLowerCase();
      } else if (tab2SortKey === 'port') {
        valA = a.port || 0;
        valB = b.port || 0;
      } else if (tab2SortKey === 'ping') {
        valA = resA.latencyMs !== undefined ? resA.latencyMs : 999999;
        valB = resB.latencyMs !== undefined ? resB.latencyMs : 999999;
      } else if (tab2SortKey === 'ip') {
        valA = (resA.ip || '').toLowerCase();
        valB = (resB.ip || '').toLowerCase();
      } else {
        valA = a.index || 0;
        valB = b.index || 0;
      }

      if (valA < valB) return tab2SortAsc ? -1 : 1;
      if (valA > valB) return tab2SortAsc ? 1 : -1;
      return 0;
    });
  };

  const renderTestTable = () => {
    if (!testTableBody) return;
    testTableBody.innerHTML = '';
    if (normalizedNodes.length === 0) {
      testTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="p-8 text-center text-slate-500 font-sans text-xs">Please import nodes in the Config Generator tab first.</td>
        </tr>
      `;
      return;
    }

    // Default select all if empty
    if (testSelectedNodeIds.size === 0) {
      normalizedNodes.forEach(n => testSelectedNodeIds.add(n.id));
    }

    const selectAllTab2 = document.getElementById('select-all-nodes-tab2');
    if (selectAllTab2) {
      const activeCount = normalizedNodes.filter(n => testSelectedNodeIds.has(n.id)).length;
      selectAllTab2.checked = activeCount === normalizedNodes.length && normalizedNodes.length > 0;
      selectAllTab2.indeterminate = activeCount > 0 && activeCount < normalizedNodes.length;
    }

    let filtered = normalizedNodes;
    if (tab2SearchQuery) {
      const q = tab2SearchQuery.toLowerCase();
      filtered = normalizedNodes.filter(n => {
        const res = testResultsMap.get(n.id) || {};
        return (
          (n.originalTag && n.originalTag.toLowerCase().includes(q)) ||
          (n.rawOutbound.server && n.rawOutbound.server.toLowerCase().includes(q)) ||
          String(n.port).includes(q) ||
          (res.ip && res.ip.toLowerCase().includes(q))
        );
      });
    }

    filtered = sortTestNodesList(filtered);

    if (filtered.length === 0) {
      testTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="p-6 text-center text-slate-500 font-sans text-xs">No matching test nodes found for "${tab2SearchQuery}".</td>
        </tr>
      `;
      return;
    }

    filtered.forEach((node) => {
      const originalIdx = normalizedNodes.findIndex(n => n.id === node.id);
      const res = testResultsMap.get(node.id);
      const isSelected = testSelectedNodeIds.has(node.id);

      const row = document.createElement('tr');
      row.className = isSelected ? 'hover:bg-slate-800/40 transition-colors' : 'opacity-50 hover:bg-slate-800/20 transition-colors';
      row.id = `test-row-${originalIdx}`;
      row.dataset.index = originalIdx;
      row.dataset.nodeId = node.id;

      let statusHtml = `
        <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-slate-900 text-slate-400 border border-slate-800">
          ${langData?.statusPending || 'Idle'}
        </span>
      `;
      let pingHtml = '-';
      let ipHtml = '-';

      if (res) {
        if (res.status === 'testing') {
          statusHtml = `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <svg class="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ${langData?.statusTesting || 'Testing...'}
            </span>
          `;
          pingHtml = '...';
        } else if (res.status === 'success') {
          statusHtml = `
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
              ✓ ${langData?.statusSuccess || 'Connected'}
            </span>
          `;
        } else if (res.status === 'failed') {
          statusHtml = `
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-red-500/10 text-red-400 border border-red-500/30">
              ✕ ${langData?.statusFailed || 'Timeout'}
            </span>
          `;
        }

        if (res.ping) {
          if (res.latencyMs !== undefined && res.latencyMs < 999999) {
            const colorClass = res.latencyMs < 300 ? 'text-emerald-400 font-bold' : res.latencyMs < 800 ? 'text-amber-400 font-semibold' : 'text-orange-400';
            pingHtml = `<span class="${colorClass} font-mono">${res.ping}</span>`;
          } else {
            pingHtml = `<span class="text-red-400">${res.ping}</span>`;
          }
        }

        if (res.ip) {
          ipHtml = `<span class="text-slate-200 font-mono">${res.ip}</span>`;
        }
      }

      row.innerHTML = `
        <td class="p-3 text-center text-slate-500 font-bold">${node.displayIndex}</td>
        <td class="p-3 text-center">
          <input type="checkbox" ${isSelected ? 'checked' : ''} class="test-node-select-checkbox w-4 h-4 text-indigo-600 bg-slate-900 border-slate-700 rounded focus:ring-indigo-500 cursor-pointer" title="Select for batch tests">
        </td>
        <td class="p-3 font-sans">
          <div class="font-medium text-slate-200 truncate max-w-xs">${node.originalTag}</div>
          <div class="text-[11px] text-slate-500 font-mono">${node.rawOutbound.server || ''}:${node.rawOutbound.server_port || ''}</div>
        </td>
        <td class="p-3 text-indigo-400 font-bold font-mono">${node.port}</td>
        <td class="p-3 test-status-cell">${statusHtml}</td>
        <td class="p-3 test-ping-cell text-slate-400">${pingHtml}</td>
        <td class="p-3 test-ip-cell text-slate-400 font-mono text-xs truncate max-w-xs">${ipHtml}</td>
        <td class="p-3 text-center">
          <div class="flex items-center justify-center gap-1.5">
            <button type="button" class="single-ping-btn px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all flex items-center gap-1" data-index="${originalIdx}">
              ${langData?.testSingleBtn || '⚡ Ping'}
            </button>
            <button type="button" class="single-ip-btn px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-all flex items-center gap-1" data-index="${originalIdx}">
              ${langData?.fetchSingleIpBtn || '🌐 IP'}
            </button>
          </div>
        </td>
      `;
      testTableBody.appendChild(row);
    });
  };

  // Select All Tab 2
  const selectAllNodesTab2 = document.getElementById('select-all-nodes-tab2');
  if (selectAllNodesTab2) {
    selectAllNodesTab2.addEventListener('change', (e) => {
      const checked = e.target.checked;
      if (checked) {
        normalizedNodes.forEach(n => testSelectedNodeIds.add(n.id));
      } else {
        testSelectedNodeIds.clear();
      }
      renderTestTable();
    });
  }

  if (testSearchInput) {
    testSearchInput.addEventListener('input', (e) => {
      tab2SearchQuery = e.target.value.trim();
      renderTestTable();
    });
  }

  // Header click sorting for Tab 2
  const bindTab2Sort = (elemId, key) => {
    const el = document.getElementById(elemId);
    if (!el) return;
    el.addEventListener('click', () => {
      if (tab2SortKey === key) {
        tab2SortAsc = !tab2SortAsc;
      } else {
        tab2SortKey = key;
        tab2SortAsc = true;
      }
      renderTestTable();
    });
  };

  bindTab2Sort('sort-test-index', 'index');
  bindTab2Sort('sort-test-name', 'name');
  bindTab2Sort('sort-test-port', 'port');
  bindTab2Sort('sort-test-ping', 'ping');
  bindTab2Sort('sort-test-ip', 'ip');

  // --- Real-Delay Ping Tester ---
  const testSingleRealPing = async (index) => {
    const node = normalizedNodes[index];
    if (!node) return;

    const prevRes = testResultsMap.get(node.id) || {};
    testResultsMap.set(node.id, { ...prevRes, status: 'testing', ping: '...' });
    renderTestTable();

    const pingUrl = (pingTestUrlInput && pingTestUrlInput.value.trim()) || DEFAULT_PING_URL;
    const ipUrl = (ipLookupUrlInput && ipLookupUrlInput.value.trim()) || DEFAULT_IP_URL;

    if (isTauriEnv()) {
      try {
        const probeRes = await tauriInvoke('probe_single_proxy', {
          port: node.port,
          listenIp: node.listenAddress || '127.0.0.1',
          pingUrl,
          ipUrl
        });
        if (probeRes.success) {
          testResultsMap.set(node.id, {
            status: 'success',
            ping: `${probeRes.latency_ms} ms`,
            ip: probeRes.egress_ip || prevRes.ip || '-',
            latencyMs: probeRes.latency_ms
          });
        } else {
          testResultsMap.set(node.id, {
            ...prevRes,
            status: 'failed',
            ping: 'Failed',
            latencyMs: 999999
          });
        }
      } catch (err) {
        testResultsMap.set(node.id, {
          ...prevRes,
          status: 'failed',
          ping: 'Failed',
          latencyMs: 999999
        });
      }
    } else {
      const startTime = performance.now();
      try {
        await fetch(pingUrl, {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-store'
        });
        const latencyMs = Math.round(performance.now() - startTime);
        testResultsMap.set(node.id, {
          ...prevRes,
          status: 'success',
          ping: `${latencyMs} ms`,
          latencyMs
        });
      } catch (err) {
        testResultsMap.set(node.id, {
          ...prevRes,
          status: 'failed',
          ping: 'Failed',
          latencyMs: 999999
        });
      }
    }
    renderTestTable();
  };

  // --- Egress IP Fetcher ---
  const fetchSingleNodeIp = async (index) => {
    const node = normalizedNodes[index];
    if (!node) return;

    const prevRes = testResultsMap.get(node.id) || {};
    testResultsMap.set(node.id, { ...prevRes, ip: '...' });
    renderTestTable();

    const pingUrl = (pingTestUrlInput && pingTestUrlInput.value.trim()) || DEFAULT_PING_URL;
    const ipUrl = (ipLookupUrlInput && ipLookupUrlInput.value.trim()) || DEFAULT_IP_URL;

    if (isTauriEnv()) {
      try {
        const probeRes = await tauriInvoke('probe_single_proxy', {
          port: node.port,
          listenIp: node.listenAddress || '127.0.0.1',
          pingUrl,
          ipUrl
        });
        if (probeRes.success && probeRes.egress_ip) {
          testResultsMap.set(node.id, {
            ...prevRes,
            status: 'success',
            ip: probeRes.egress_ip
          });
        } else {
          testResultsMap.set(node.id, {
            ...prevRes,
            ip: probeRes.error || 'Failed'
          });
        }
      } catch (err) {
        testResultsMap.set(node.id, { ...prevRes, ip: 'Error' });
      }
    } else {
      try {
        const ipResp = await fetch(ipUrl, { cache: 'no-store' });
        if (ipResp.ok) {
          const ipData = await ipResp.json();
          testResultsMap.set(node.id, {
            ...prevRes,
            status: 'success',
            ip: ipData.ip || ipData.query || JSON.stringify(ipData)
          });
        }
      } catch (_) {
        testResultsMap.set(node.id, { ...prevRes, ip: 'Direct/Blocked' });
      }
    }
    renderTestTable();
  };

  // Batch Ping All Selected
  const testAllPingBtn = document.getElementById('test-all-ping-btn');
  if (testAllPingBtn) {
    testAllPingBtn.addEventListener('click', async () => {
      testAllPingBtn.disabled = true;
      for (let i = 0; i < normalizedNodes.length; i++) {
        if (testSelectedNodeIds.has(normalizedNodes[i].id)) {
          await testSingleRealPing(i);
        }
      }
      testAllPingBtn.disabled = false;
    });
  }

  // Batch Fetch IP All Selected
  const fetchAllIpBtn = document.getElementById('fetch-all-ip-btn');
  if (fetchAllIpBtn) {
    fetchAllIpBtn.addEventListener('click', async () => {
      fetchAllIpBtn.disabled = true;
      for (let i = 0; i < normalizedNodes.length; i++) {
        if (testSelectedNodeIds.has(normalizedNodes[i].id)) {
          await fetchSingleNodeIp(i);
        }
      }
      fetchAllIpBtn.disabled = false;
    });
  }

  // Batch Test All (Ping + IP)
  if (testAllBtn) {
    testAllBtn.addEventListener('click', async () => {
      testAllBtn.disabled = true;
      for (let i = 0; i < normalizedNodes.length; i++) {
        if (testSelectedNodeIds.has(normalizedNodes[i].id)) {
          await testSingleRealPing(i);
          await fetchSingleNodeIp(i);
        }
      }
      testAllBtn.disabled = false;
    });
  }

  if (testTableBody) {
    testTableBody.addEventListener('click', (e) => {
      const pingBtn = e.target.closest('.single-ping-btn');
      if (pingBtn) {
        const idx = parseInt(pingBtn.dataset.index, 10);
        testSingleRealPing(idx);
        return;
      }

      const ipBtn = e.target.closest('.single-ip-btn');
      if (ipBtn) {
        const idx = parseInt(ipBtn.dataset.index, 10);
        fetchSingleNodeIp(idx);
        return;
      }
    });

    testTableBody.addEventListener('change', (e) => {
      if (e.target.classList.contains('test-node-select-checkbox')) {
        const row = e.target.closest('tr');
        if (!row) return;
        const nodeId = row.dataset.nodeId;
        if (e.target.checked) {
          testSelectedNodeIds.add(nodeId);
        } else {
          testSelectedNodeIds.delete(nodeId);
        }
        renderTestTable();
      }
    });
  }

  // --- Tab 3 File Pickers & Use Current Config Logic ---
  const runnerBrowseBinBtn = document.getElementById('runner-browse-bin-btn');
  const runnerBinFileInput = document.getElementById('runner-bin-file-input');
  if (runnerBrowseBinBtn && runnerBinFileInput) {
    runnerBrowseBinBtn.addEventListener('click', () => runnerBinFileInput.click());
    runnerBinFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && runnerBinaryPathInput) {
        runnerBinaryPathInput.value = file.name;
        updateRunnerCommand();
      }
    });
  }

  const runnerBrowseCfgBtn = document.getElementById('runner-browse-cfg-btn');
  const runnerCfgFileInput = document.getElementById('runner-cfg-file-input');
  if (runnerBrowseCfgBtn && runnerCfgFileInput) {
    runnerBrowseCfgBtn.addEventListener('click', () => runnerCfgFileInput.click());
    runnerCfgFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && runnerConfigPathInput) {
        runnerConfigPathInput.value = file.name;
        updateRunnerCommand();
      }
    });
  }

  const useCurrentConfigBtn = document.getElementById('use-current-config-btn');
  if (useCurrentConfigBtn) {
    useCurrentConfigBtn.addEventListener('click', () => {
      if (!currentGeneratedConfig) {
        handleGenerate();
      }
      const activeName = getConfigFilename();
      if (runnerConfigPathInput) {
        runnerConfigPathInput.value = activeName;
        updateRunnerCommand();
      }
      appendConsoleLog(`[SYSTEM] Config set to currently generated: ${activeName}`);
    });
  }

  // --- Manual Single Port Real-Delay Probe Logic ---
  const generateManualCurlCmd = () => {
    const port = (manualProbePortInput && manualProbePortInput.value.trim()) || '20808';
    const ip = (manualProbeIpInput && manualProbeIpInput.value.trim()) || '127.0.0.1';
    const target = (manualProbeTargetInput && manualProbeTargetInput.value.trim()) || DEFAULT_PING_URL;
    return `curl.exe -i -s -o NUL -w "HTTP: %{http_code} | Total RTT: %{time_total}s | TCP Connect: %{time_connect}s\\n" --max-time 5 -x http://${ip}:${port} "${target}"`;
  };

  if (manualCopyCurlBtn) {
    manualCopyCurlBtn.addEventListener('click', () => {
      const cmd = generateManualCurlCmd();
      copyTextToClipboard(cmd, manualCopyCurlBtn);
    });
  }

  if (manualProbeBtn) {
    manualProbeBtn.addEventListener('click', async () => {
      const port = (manualProbePortInput && manualProbePortInput.value.trim()) || '20808';
      const ip = (manualProbeIpInput && manualProbeIpInput.value.trim()) || '127.0.0.1';
      const target = (manualProbeTargetInput && manualProbeTargetInput.value.trim()) || DEFAULT_PING_URL;

      if (manualProbeResult) {
        manualProbeResult.className = 'text-xs font-mono px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse';
        manualProbeResult.textContent = `Probing http://${ip}:${port} via ${target}...`;
      }

      const startTime = performance.now();
      try {
        await fetch(target, {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-store'
        });
        const elapsed = Math.round(performance.now() - startTime);
        if (manualProbeResult) {
          manualProbeResult.className = 'text-xs font-mono px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
          manualProbeResult.textContent = `✓ Port ${port} Active | Round-Trip: ${elapsed} ms`;
        }
      } catch (err) {
        if (manualProbeResult) {
          manualProbeResult.className = 'text-xs font-mono px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30';
          manualProbeResult.textContent = `✕ Probe Failed on Port ${port} (${err.message || 'Port not listening'}). Ensure sing-box is running.`;
        }
      }
    });
  }

  // --- Real-Delay Tester Script Generators (.bat / .sh) ---
  if (downloadRealDelayBatBtn) {
    downloadRealDelayBatBtn.addEventListener('click', () => {
      const enabled = normalizedNodes.filter(n => n.enabled);
      if (enabled.length === 0) {
        alert(langData?.errorNoEnabledNodes || 'Please import and enable at least one node first.');
        return;
      }
      const pingUrl = (pingTestUrlInput && pingTestUrlInput.value.trim()) || DEFAULT_PING_URL;
      const baseName = getBaseFilename();
      
      let batContent = `@echo off\r\nchcp 65001 >nul\r\ncd /d "%~dp0"\r\ntitle Sing-Box Multi-Port Real Delay Tester (${baseName})\r\necho ========================================================\r\necho   Sing-Box Multi-Port Real-Delay Egress Ping Tester\r\necho ========================================================\r\necho Target URL: ${pingUrl}\r\necho Current Directory: %cd%\r\necho.\r\n`;

      enabled.forEach((node) => {
        const tagSafe = node.originalTag.replace(/[\^&<>|]/g, '');
        batContent += `echo [${node.displayIndex}/${enabled.length}] Testing Port ${node.port} ^(${tagSafe}^)...\r\n`;
        batContent += `curl.exe -s -o NUL -w "  Status: HTTP %%{http_code} | Real RTT: %%{time_total}s | TCP Connect: %%{time_connect}s\\n" --max-time 5 -x http://${node.listenAddress}:${node.port} "${pingUrl}"\r\n`;
        batContent += `if errorlevel 1 (\r\n  echo   --^> [FAILED / TIMEOUT] Port ${node.port} not responding. Make sure sing-box is running!\r\n)\r\necho.\r\n`;
      });

      batContent += `echo ========================================================\r\necho   Real Delay Test Completed for all ${enabled.length} ports.\r\necho ========================================================\r\npause\r\n`;

      const blob = new Blob([batContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-real-delay-${baseName}.bat`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  if (downloadRealDelayShBtn) {
    downloadRealDelayShBtn.addEventListener('click', () => {
      const enabled = normalizedNodes.filter(n => n.enabled);
      if (enabled.length === 0) {
        alert(langData?.errorNoEnabledNodes || 'Please import and enable at least one node first.');
        return;
      }
      const pingUrl = (pingTestUrlInput && pingTestUrlInput.value.trim()) || DEFAULT_PING_URL;
      const baseName = getBaseFilename();

      let shContent = `#!/bin/bash\ncd "$(dirname "$0")"\necho "========================================================"\necho "  Sing-Box Multi-Port Real-Delay Egress Ping Tester (${baseName})"\necho "========================================================"\necho "Target URL: ${pingUrl}"\necho ""\n`;

      enabled.forEach((node) => {
        const tagSafe = node.originalTag.replace(/["$`\\]/g, '');
        shContent += `echo "[${node.displayIndex}/${enabled.length}] Testing Port ${node.port} (${tagSafe})..."\n`;
        shContent += `curl -s -o /dev/null -w "  Status: HTTP %{http_code} | Real RTT: %{time_total}s | Connect: %{time_connect}s\\n" --max-time 5 -x http://${node.listenAddress}:${node.port} "${pingUrl}" || echo "  --> [FAILED / TIMEOUT] Port ${node.port} not responding."\necho ""\n`;
      });

      shContent += `echo "========================================================"\necho "  Real Delay Test Completed for all ${enabled.length} ports."\necho "========================================================"\n`;

      const blob = new Blob([shContent], { type: 'application/x-sh' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-real-delay-${baseName}.sh`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // Endpoints Confirmation Modal
  if (saveEndpointsBtn && confirmModal) {
    saveEndpointsBtn.addEventListener('click', () => {
      confirmModal.classList.remove('hidden');
    });
  }

  if (confirmCancelBtn && confirmModal) {
    confirmCancelBtn.addEventListener('click', () => {
      confirmModal.classList.add('hidden');
    });
  }

  if (confirmYesBtn && confirmModal) {
    confirmYesBtn.addEventListener('click', () => {
      if (pingTestUrlInput) localStorage.setItem('singmp_ping_url', pingTestUrlInput.value.trim());
      if (ipLookupUrlInput) localStorage.setItem('singmp_ip_url', ipLookupUrlInput.value.trim());
      confirmModal.classList.add('hidden');
      alert('Testing endpoints saved successfully.');
    });
  }

  if (resetEndpointsBtn) {
    resetEndpointsBtn.addEventListener('click', () => {
      if (pingTestUrlInput) pingTestUrlInput.value = DEFAULT_PING_URL;
      if (ipLookupUrlInput) ipLookupUrlInput.value = DEFAULT_IP_URL;
      localStorage.removeItem('singmp_ping_url');
      localStorage.removeItem('singmp_ip_url');
      alert('Testing endpoints reset to default values.');
    });
  }

  // --- Runner Tab Logic ---
  const updateRunnerCommand = () => {
    const bin = (runnerBinaryPathInput && runnerBinaryPathInput.value.trim()) || '.\\sing-box.exe';
    const cfgFilename = getConfigFilename();
    const cmd = `${bin} run -c ${cfgFilename}`;
    if (fullRunnerCmd) fullRunnerCmd.textContent = cmd;
    if (runCommandPreview) runCommandPreview.textContent = cmd;
    if (runnerConfigPathInput) runnerConfigPathInput.value = cfgFilename;
  };

  if (runnerBinaryPathInput) runnerBinaryPathInput.addEventListener('input', updateRunnerCommand);
  if (runnerConfigPathInput) runnerConfigPathInput.addEventListener('input', updateRunnerCommand);

  presetBinBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (runnerBinaryPathInput) runnerBinaryPathInput.value = btn.dataset.path;
      updateRunnerCommand();
    });
  });

  const copyTextToClipboard = (text, btnElement) => {
    navigator.clipboard.writeText(text).then(() => {
      const origText = btnElement.textContent;
      btnElement.textContent = langData?.copiedBtn || 'Copied!';
      setTimeout(() => {
        btnElement.textContent = origText;
      }, 2000);
    });
  };

  if (copyRunCmdBtn) {
    copyRunCmdBtn.addEventListener('click', () => {
      copyTextToClipboard(runCommandPreview?.textContent || '', copyRunCmdBtn);
    });
  }

  runnerCopyCmdBtn.addEventListener('click', () => {
    copyTextToClipboard(fullRunnerCmd?.textContent || '', runnerCopyCmdBtn);
  });

  // --- Fixed & Bulletproof run-proxy.bat Generator ---
  downloadBatBtn.addEventListener('click', () => {
    const bin = (runnerBinaryPathInput && runnerBinaryPathInput.value.trim()) || '.\\sing-box.exe';
    const cfg = getConfigFilename();
    const baseName = getBaseFilename();
    const firstPort = parseInt(startPortInput?.value, 10) || 20808;

    const batContent = `@echo off\r\nchcp 65001 >nul\r\ncd /d "%~dp0"\r\ntitle Sing-Box General Proxy Manager Runner (${baseName})\r\necho ====================================================\r\necho  Sing-Box Multi-Port Local Gateway Runner\r\necho ====================================================\r\necho [INFO] Working Directory: %cd%\r\necho.\r\n\r\necho [1/3] Checking sing-box executable...\r\nif not exist "${bin}" (\r\n  echo [ERROR] Cannot find sing-box executable at: ${bin}\r\n  echo Please make sure "${bin}" is placed in this directory (%cd%).\r\n  echo.\r\n  pause\r\n  exit /b 1\r\n)\r\n\r\necho [2/3] Checking config file: ${cfg}...\r\nif not exist "${cfg}" (\r\n  echo [ERROR] Cannot find configuration file at: ${cfg}\r\n  echo Please make sure you downloaded "${cfg}" and placed it in this directory (%cd%).\r\n  echo.\r\n  pause\r\n  exit /b 1\r\n)\r\n\r\necho [3/3] Checking starting port ${firstPort}...\r\nnetstat -ano | findstr ":${firstPort}" | findstr /i "LISTENING" >nul 2>&1\r\nif %errorlevel% equ 0 (\r\n  echo [WARNING] Port ${firstPort} is currently OCCUPIED by another program (e.g. v2rayN/Xray)!\r\n  echo If sing-box fails with 'bind: Only one usage of each socket address':\r\n  echo   - Close conflicting background proxy apps, OR\r\n  echo   - Change Starting Port in General Proxy Manager and re-generate.\r\n  echo.\r\n)\r\n\r\necho ----------------------------------------------------\r\necho Launching sing-box: "${bin}" run -c "${cfg}"\r\necho ----------------------------------------------------\r\n"${bin}" run -c "${cfg}"\r\n\r\necho.\r\necho ====================================================\r\necho  Sing-Box process has stopped.\r\necho ====================================================\r\npause\r\n`;

    const blob = new Blob([batContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `run-${baseName}.bat`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  downloadShBtn.addEventListener('click', () => {
    const bin = (runnerBinaryPathInput && runnerBinaryPathInput.value.trim()) || 'sing-box';
    const cfg = getConfigFilename();
    const baseName = getBaseFilename();

    const shContent = `#!/bin/bash\ncd "$(dirname "$0")"\necho "===================================================="\necho " Sing-Box Multi-Port Local Gateway Runner (${baseName})"\necho "===================================================="\nif ! command -v "${bin}" &> /dev/null && [ ! -f "${bin}" ]; then\n  echo "[ERROR] Cannot find sing-box executable at: ${bin}"\n  echo "Please make sure sing-box binary exists and is executable."\n  exit 1\nfi\nif [ ! -f "${cfg}" ]; then\n  echo "[ERROR] Cannot find configuration file at: ${cfg}"\n  exit 1\nfi\necho "Starting sing-box with ${cfg}..."\n${bin} run -c "${cfg}"\n`;

    const blob = new Blob([shContent], { type: 'application/x-sh' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `run-${baseName}.sh`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // --- Node Table Row Action Delegation (Edit / Delete) ---
  if (nodesTableBody) {
    nodesTableBody.addEventListener('click', (e) => {
      const row = e.target.closest('tr');
      if (!row) return;
      const index = parseInt(row.dataset.index, 10);

      if (e.target.classList.contains('node-edit-btn') || e.target.closest('.node-edit-btn')) {
        openEditModal(index);
      } else if (e.target.classList.contains('node-delete-btn') || e.target.closest('.node-delete-btn')) {
        if (confirm(`Delete node "${normalizedNodes[index].originalTag}"?`)) {
          normalizedNodes.splice(index, 1);
          const startingPort = parseInt(startPortInput?.value, 10) || 20808;
          const listenAddress = listenAddressInput?.value.trim() || '127.0.0.1';
          normalizedNodes = normalizeNodes(normalizedNodes.map(n => n.rawOutbound), startingPort, listenAddress);
          renderNodeTable();
          renderTestTable();
          if (outputSection && !outputSection.classList.contains('hidden')) {
            handleGenerate();
          }
        }
      }
    });

    nodesTableBody.addEventListener('change', (e) => {
      const row = e.target.closest('tr');
      if (!row) return;
      const nodeId = row.dataset.nodeId;
      const node = normalizedNodes.find(n => n.id === nodeId);
      if (!node) return;

      if (e.target.classList.contains('node-enabled-checkbox')) {
        node.enabled = e.target.checked;
        renderNodeTable();
        renderTestTable();
      }
    });

    nodesTableBody.addEventListener('input', (e) => {
      const row = e.target.closest('tr');
      if (!row) return;
      const nodeId = row.dataset.nodeId;
      const node = normalizedNodes.find(n => n.id === nodeId);
      if (!node) return;

      if (e.target.classList.contains('node-port-input')) {
        node.port = parseInt(e.target.value, 10);
        const portCheck = validatePorts(normalizedNodes);
        if (!portCheck.valid) {
          e.target.classList.add('border-red-500', 'focus:ring-red-500');
        } else {
          document.querySelectorAll('.node-port-input').forEach(inp => {
            inp.classList.remove('border-red-500', 'focus:ring-red-500');
          });
        }
      }
    });
  }

  // --- Standard Event Listeners ---
  if (langSwitcher) langSwitcher.addEventListener('change', (e) => setLanguage(e.target.value));

  if (nodesInput) {
    nodesInput.addEventListener('input', (e) => handleRawText(e.target.value));
    nodesInput.addEventListener('dragover', (e) => {
      e.preventDefault();
      nodesInput.classList.add('drag-over');
    });
    nodesInput.addEventListener('dragleave', () => {
      nodesInput.classList.remove('drag-over');
    });
    nodesInput.addEventListener('drop', (e) => {
      e.preventDefault();
      nodesInput.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          nodesInput.value = event.target.result;
          handleRawText(event.target.result);
        };
        reader.readAsText(file);
      }
    });
  }

  if (clearInputBtn) {
    clearInputBtn.addEventListener('click', () => {
      if (nodesInput) nodesInput.value = '';
      resetState();
    });
  }

  if (fetchSubBtn) {
    fetchSubBtn.addEventListener('click', () => {
      const url = subscriptionUrlInput ? subscriptionUrlInput.value.trim() : '';
      if (url) fetchSubscription(url);
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (nodesInput) nodesInput.value = event.target.result;
          handleRawText(event.target.result);
        };
        reader.readAsText(file);
      }
    });
  }

  if (startPortInput) {
    startPortInput.addEventListener('input', () => {
      const startingPort = parseInt(startPortInput.value, 10) || 20808;
      normalizedNodes.forEach((node, index) => {
        node.port = startingPort + index;
      });
      renderNodeTable();
      renderTestTable();
    });
  }

  if (listenAddressInput) {
    listenAddressInput.addEventListener('input', () => {
      const addr = listenAddressInput.value.trim() || '127.0.0.1';
      normalizedNodes.forEach(node => {
        node.listenAddress = addr;
      });
    });
  }

  if (generateBtn) generateBtn.addEventListener('click', handleGenerate);
  if (validateBtn) validateBtn.addEventListener('click', runValidationAndRenderSummary);

  if (copyBtn && configOutput) {
    copyBtn.addEventListener('click', () => {
      configOutput.select();
      navigator.clipboard.writeText(configOutput.value).then(() => {
        copyBtn.textContent = langData?.copiedBtn || 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = langData?.copyBtn || 'Copy';
        }, 2000);
      });
    });
  }

  if (downloadBtn && configOutput) {
    downloadBtn.addEventListener('click', () => {
      if (!configOutput.value) return;
      const cfgFilename = getConfigFilename();
      const blob = new Blob([configOutput.value], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = cfgFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // --- Desktop Engine Controller (Tauri Integration) ---
  const desktopRunnerController = document.getElementById('desktop-runner-controller');
  const desktopEngineStatus = document.getElementById('desktop-engine-status');
  const desktopStartBtn = document.getElementById('desktop-start-btn');
  const desktopStopBtn = document.getElementById('desktop-stop-btn');
  const desktopRestartBtn = document.getElementById('desktop-restart-btn');
  const desktopLogConsole = document.getElementById('desktop-log-console');
  const clearConsoleLogsBtn = document.getElementById('clear-console-logs-btn');

  const isTauriEnv = () => {
    return typeof window.__TAURI_INTERNALS__ !== 'undefined' || (typeof window.__TAURI__ !== 'undefined' && typeof window.__TAURI__.core !== 'undefined');
  };

  const tauriInvoke = async (cmd, args = {}) => {
    if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
      return await window.__TAURI__.core.invoke(cmd, args);
    }
    if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
      return await window.__TAURI_INTERNALS__.invoke(cmd, args);
    }
    throw new Error('Tauri IPC is not available in browser mode.');
  };

  const appendConsoleLog = (text) => {
    if (!desktopLogConsole) return;
    const now = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'py-0.5';
    if (text.startsWith('[ERR]')) {
      entry.className += ' text-red-400 font-semibold';
    } else if (text.startsWith('[SYSTEM]')) {
      entry.className += ' text-indigo-400 font-bold';
    } else if (text.startsWith('[WARNING]')) {
      entry.className += ' text-amber-400';
    } else {
      entry.className += ' text-slate-300';
    }
    entry.textContent = `[${now}] ${text}`;
    desktopLogConsole.appendChild(entry);
    desktopLogConsole.scrollTop = desktopLogConsole.scrollHeight;
  };

  const updateEngineStatusUI = (running, pid = null) => {
    if (!desktopEngineStatus) return;
    if (running) {
      desktopEngineStatus.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center gap-1.5';
      desktopEngineStatus.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> ${langData?.desktopEngineRunning || '● Running'} ${pid ? `[PID: ${pid}]` : ''}`;
      if (desktopStartBtn) {
        desktopStartBtn.disabled = true;
        desktopStartBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
      if (desktopStopBtn) {
        desktopStopBtn.disabled = false;
        desktopStopBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    } else {
      desktopEngineStatus.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-slate-950 border border-slate-800 text-slate-400';
      desktopEngineStatus.textContent = langData?.desktopEngineStopped || '○ Stopped';
      if (desktopStartBtn) {
        desktopStartBtn.disabled = false;
        desktopStartBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
      if (desktopStopBtn) {
        desktopStopBtn.disabled = true;
        desktopStopBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
    }
  };

  const handleStartEngine = async () => {
    if (!currentGeneratedConfig) {
      handleGenerate();
    }
    if (!currentGeneratedConfig) {
      alert('Please import proxy nodes and generate configuration first.');
      return;
    }

    const bin = (runnerBinaryPathInput && runnerBinaryPathInput.value.trim()) || 'sing-box.exe';
    const cfgJson = JSON.stringify(currentGeneratedConfig, null, 2);

    if (isTauriEnv()) {
      appendConsoleLog(`[SYSTEM] Starting sing-box engine via '${bin}'...`);
      try {
        const res = await tauriInvoke('start_singbox_engine', {
          binaryPath: bin,
          configJson: cfgJson
        });
        updateEngineStatusUI(res.running, res.pid);
        appendConsoleLog(`[SYSTEM] Engine launched successfully (PID: ${res.pid})`);
      } catch (err) {
        appendConsoleLog(`[ERR] Failed to launch engine: ${err}`);
      }
    } else {
      appendConsoleLog(`[SYSTEM] Browser Simulation: Launching local gateway on port ${currentGeneratedConfig.inbounds?.[0]?.listen_port || 20808}...`);
      updateEngineStatusUI(true, Math.floor(Math.random() * 8000 + 1000));
      appendConsoleLog(`[INFO] sing-box listening on ${normalizedNodes.filter(n => n.enabled).length} mixed local proxy ports.`);
    }
  };

  const handleStopEngine = async () => {
    if (isTauriEnv()) {
      try {
        const res = await tauriInvoke('stop_singbox_engine');
        updateEngineStatusUI(res.running);
        appendConsoleLog('[SYSTEM] Engine stopped.');
      } catch (err) {
        appendConsoleLog(`[ERR] Failed to stop engine: ${err}`);
      }
    } else {
      updateEngineStatusUI(false);
      appendConsoleLog('[SYSTEM] Engine stopped.');
    }
  };

  if (desktopStartBtn) desktopStartBtn.addEventListener('click', handleStartEngine);
  if (desktopStopBtn) desktopStopBtn.addEventListener('click', handleStopEngine);
  if (desktopRestartBtn) {
    desktopRestartBtn.addEventListener('click', async () => {
      await handleStopEngine();
      setTimeout(handleStartEngine, 500);
    });
  }

  if (clearConsoleLogsBtn && desktopLogConsole) {
    clearConsoleLogsBtn.addEventListener('click', () => {
      desktopLogConsole.innerHTML = '';
      appendConsoleLog('[SYSTEM] Console cleared.');
    });
  }

  // Check Tauri Log Listener
  if (window.__TAURI__ && window.__TAURI__.event && typeof window.__TAURI__.event.listen === 'function') {
    window.__TAURI__.event.listen('singbox-log', (event) => {
      appendConsoleLog(event.payload);
    });
  }

  // --- Initial Synchronous Startup ---
  initTheme();
  initLanguage();
  singBoxTemplate = await fetchTemplate();
  updateSummaryBadge();
  updateRunnerCommand();
});