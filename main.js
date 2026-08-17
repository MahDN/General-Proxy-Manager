/**
 * General Proxy Manager - Main Application Logic
 * Target sing-box version: 1.13.18
 */

import jsyaml from 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm';
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
  let langData = {};
  let singBoxTemplate = null;
  let isLoading = false;
  let currentGeneratedConfig = null;

  // DOM Element References
  const nodesInput = document.getElementById('nodes-input');
  const fileInput = document.getElementById('file-input');
  const clearInputBtn = document.getElementById('clear-input-btn');
  const subscriptionUrlInput = document.getElementById('subscription-url-input');
  const fetchSubBtn = document.getElementById('fetch-sub-btn');
  const useCorsProxyCheckbox = document.getElementById('use-cors-proxy');

  const nodesTableSection = document.getElementById('nodes-table-section');
  const nodesTableBody = document.getElementById('nodes-table-body');
  const nodesSummaryBadge = document.getElementById('nodes-summary-badge');

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

  // --- Loading State ---
  const setLoading = (state, message = '') => {
    isLoading = state;
    if (state) {
      loadingOverlay.classList.remove('hidden');
      if (message) {
        const span = loadingOverlay.querySelector('span');
        if (span) span.textContent = message;
      }
      nodesInput.disabled = true;
    } else {
      loadingOverlay.classList.add('hidden');
      nodesInput.disabled = false;
    }
  };

  // --- Internationalization (i18n) ---
  const fetchLanguageFile = async (lang) => {
    const url = `${lang}.yml`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const yamlText = await response.text();
      return jsyaml.load(yamlText);
    } catch (error) {
      console.error(`Failed to fetch language file for ${lang}:`, error);
      return null;
    }
  };

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

    if (generateBtn.disabled) {
      generateBtn.textContent = langData.generateBtnDisabled || 'Please import proxy nodes first';
    } else {
      generateBtn.textContent = langData.generateBtn || 'Generate Configuration';
    }
  };

  const setLanguage = async (lang) => {
    const data = await fetchLanguageFile(lang);
    if (data) {
      langData = data;
      if (lang === 'fa') {
        document.documentElement.dir = 'rtl';
        document.body.setAttribute('dir', 'rtl');
      } else {
        document.documentElement.dir = 'ltr';
        document.body.setAttribute('dir', 'ltr');
      }
      applyLanguage();
      if (normalizedNodes.length > 0) {
        updateSummaryBadge();
      }
    }
  };

  const initLanguage = async () => {
    const browserLang = (navigator.language || 'en').split('-')[0];
    const lang = browserLang === 'fa' ? 'fa' : (browserLang === 'zh' ? 'zh' : 'en');
    langSwitcher.value = lang;
    await setLanguage(lang);
  };

  // --- Template Loading ---
  const fetchTemplate = async () => {
    try {
      const response = await fetch('sing-box-template.json.tpl');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const text = await response.text();
      return JSON.parse(text);
    } catch (error) {
      console.warn('Template fetch failed, using internal fallback template:', error);
      return null;
    }
  };

  // --- Node Table & Summary UI ---
  const updateSummaryBadge = () => {
    const total = normalizedNodes.length;
    const enabled = normalizedNodes.filter(n => n.enabled).length;
    const startingPort = parseInt(startPortInput.value, 10) || 10808;
    const endPort = startingPort + Math.max(0, total - 1);

    const totalLabel = langData.summaryTotalNodes || 'Total';
    const enabledLabel = langData.summaryEnabledNodes || 'Enabled';
    const rangeLabel = langData.summaryPortRange || 'Port Range';

    nodesSummaryBadge.innerHTML = `
      <span class="text-blue-600 dark:text-blue-400 font-semibold">${totalLabel}: ${total}</span> &bull; 
      <span class="text-emerald-600 dark:text-emerald-400 font-semibold">${enabledLabel}: ${enabled}</span> &bull; 
      <span class="text-slate-500">${rangeLabel}: ${startingPort} - ${endPort}</span>
    `;
  };

  const renderNodeTable = () => {
    nodesTableBody.innerHTML = '';
    if (normalizedNodes.length === 0) {
      nodesTableSection.classList.add('hidden');
      generateBtn.disabled = true;
      generateBtn.textContent = langData.generateBtnDisabled || 'Please import proxy nodes first';
      return;
    }

    nodesTableSection.classList.remove('hidden');
    generateBtn.disabled = false;
    generateBtn.textContent = langData.generateBtn || 'Generate Configuration';
    updateSummaryBadge();

    normalizedNodes.forEach((node, index) => {
      const row = document.createElement('tr');
      row.className = node.enabled ? 'hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors' : 'opacity-50 bg-slate-50/50 dark:bg-slate-900/30';
      row.dataset.nodeId = node.id;

      const typeUpper = (node.type || 'vless').toUpperCase();
      const typeBadgeClass = node.type === 'vless' 
        ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';

      row.innerHTML = `
        <td class="p-3 text-center font-mono text-xs text-slate-400 dark:text-slate-500 font-bold">${node.displayIndex}</td>
        <td class="p-3">
          <div class="font-medium text-slate-800 dark:text-slate-200 truncate max-w-xs md:max-w-md" title="${node.originalTag}">${node.originalTag}</div>
          <div class="text-xs text-slate-400 dark:text-slate-500 font-mono truncate">${node.rawOutbound.server || 'unknown'}:${node.rawOutbound.server_port || ''}</div>
        </td>
        <td class="p-3">
          <span class="inline-block px-2 py-0.5 rounded text-xs font-semibold font-mono border ${typeBadgeClass}">
            ${typeUpper}
          </span>
        </td>
        <td class="p-3 text-center">
          <input type="checkbox" ${node.enabled ? 'checked' : ''} class="node-enabled-checkbox w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer">
        </td>
        <td class="p-3">
          <input type="number" min="1" max="65535" value="${node.port}" ${node.enabled ? '' : 'disabled'} class="node-port-input w-full p-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500">
        </td>
        <td class="p-3">
          <span class="font-mono text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-800">${node.outboundTag}</span>
        </td>
      `;

      nodesTableBody.appendChild(row);
    });
  };

  // --- Process Input Data ---
  const handleRawText = (text) => {
    const trimmed = text ? text.trim() : '';
    if (!trimmed) {
      resetState();
      return;
    }

    try {
      rawOutbounds = parseInput(trimmed);
      const startingPort = parseInt(startPortInput.value, 10) || 10808;
      const listenAddress = listenAddressInput.value.trim() || '127.0.0.1';
      normalizedNodes = normalizeNodes(rawOutbounds, startingPort, listenAddress);
      renderNodeTable();
    } catch (err) {
      console.warn('Input parsing warning:', err.message);
      resetState();
      alert(langData.errorInvalidJSON || err.message);
    }
  };

  const resetState = () => {
    rawOutbounds = [];
    normalizedNodes = [];
    currentGeneratedConfig = null;
    nodesTableSection.classList.add('hidden');
    outputSection.classList.add('hidden');
    generateBtn.disabled = true;
    generateBtn.textContent = langData.generateBtnDisabled || 'Please import proxy nodes first';
  };

  // --- Subscription Fetch (Direct by default, with optional CORS proxy fallback) ---
  const fetchSubscription = async (url) => {
    if (!url || !url.startsWith('http')) {
      alert('Please enter a valid HTTP/HTTPS subscription URL.');
      return;
    }

    const useProxy = useCorsProxyCheckbox && useCorsProxyCheckbox.checked;
    const fetchUrl = useProxy
      ? `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
      : url;

    setLoading(true, langData.loadingSubscription || 'Fetching subscription...');
    try {
      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json, text/plain, */*'
        }
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const text = await response.text();
      nodesInput.value = text;
      handleRawText(text);
    } catch (error) {
      console.error('Subscription fetch error:', error);
      if (!useProxy) {
        alert((langData.errorSubscriptionFetch || 'Error: Direct subscription fetch failed. The remote server may block CORS.') + '\n\n' + (langData.useCorsProxyLabel || 'You can enable "Use third-party CORS proxy fallback" checkbox to bypass CORS restrictions.'));
      } else {
        alert(langData.errorSubscriptionFetch || 'Error: Failed to fetch subscription via CORS proxy. Please check the URL.');
      }
    } finally {
      setLoading(false);
    }
  };

  // --- Generate Configuration ---
  const handleGenerate = () => {
    if (normalizedNodes.length === 0) return;

    const enabledNodes = normalizedNodes.filter(n => n.enabled);
    if (enabledNodes.length === 0) {
      alert(langData.errorNoEnabledNodes || 'Error: At least one proxy node must be enabled.');
      return;
    }

    const portCheck = validatePorts(normalizedNodes);
    if (!portCheck.valid) {
      if (portCheck.error === 'duplicate_port') {
        alert(langData.errorPortDuplicate || portCheck.message);
      } else {
        alert(langData.errorPortInvalid || portCheck.message);
      }
      return;
    }

    try {
      const listenAddress = listenAddressInput.value.trim() || '127.0.0.1';
      const bootstrapDns = bootstrapDnsSelect.value;
      const remoteDns = remoteDnsSelect.value;
      const dnsStrategy = dnsStrategySelect.value;
      const logLevel = logLevelSelect.value;

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
      configOutput.value = jsonStr;
      outputSection.classList.remove('hidden');

      // Run validation & display mapping summary
      runValidationAndRenderSummary();

      // Scroll smoothly to output
      outputSection.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      alert(`Generation failed: ${err.message}`);
    }
  };

  // --- Validation & Summary Display ---
  const runValidationAndRenderSummary = () => {
    if (!currentGeneratedConfig) return;

    const validation = validateGeneratedConfig(currentGeneratedConfig, normalizedNodes);

    if (validation.valid) {
      validationCard.className = 'p-4 rounded-xl text-sm font-medium border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800 flex items-center justify-between';
      validationCard.innerHTML = `
        <div class="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-600"><polyline points="20 6 9 17 4 12"/></svg>
          <span>${langData.validationPassed || '✓ Structural Validation Passed: Configuration is strictly compliant with sing-box 1.13.18.'}</span>
        </div>
        <span class="text-xs font-mono bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded">1:1 Port Isolation Verified</span>
      `;
    } else {
      validationCard.className = 'p-4 rounded-xl text-sm font-medium border bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800';
      validationCard.innerHTML = `
        <div class="flex items-center gap-2 mb-2 font-bold">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-600"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <span>${langData.validationFailed || '✕ Structural Validation Failed:'}</span>
        </div>
        <ul class="list-disc list-inside text-xs space-y-1">
          ${validation.errors.map(e => `<li>${e}</li>`).join('')}
        </ul>
      `;
    }

    // Render Mapping Summary
    const enabledNodes = normalizedNodes.filter(n => n.enabled);
    summaryMappingList.innerHTML = '';

    enabledNodes.forEach(node => {
      const item = document.createElement('div');
      item.className = 'p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-slate-700 dark:text-slate-300';
      item.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="font-bold text-blue-600 dark:text-blue-400">${node.listenAddress}:${node.port}</span>
          <span class="text-slate-400">&rarr;</span>
          <span class="font-semibold text-slate-800 dark:text-slate-100">${node.originalTag}</span>
        </div>
        <div class="flex items-center gap-3 text-xs text-slate-400">
          <span>Inbound: <code class="text-slate-600 dark:text-slate-300">${node.inboundTag}</code></span>
          <span>&bull;</span>
          <span>Outbound: <code class="text-purple-600 dark:text-purple-400">${node.outboundTag}</code></span>
          <span>&bull;</span>
          <span>DNS: <code class="text-emerald-600 dark:text-emerald-400">${node.dnsTag}</code></span>
        </div>
      `;
      summaryMappingList.appendChild(item);
    });

    const infoFooter = document.createElement('div');
    infoFooter.className = 'mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap justify-between gap-2';
    infoFooter.innerHTML = `
      <span><strong>Bootstrap DNS:</strong> <code>local_dns</code> (${bootstrapDnsSelect.value}) via direct</span>
      <span><strong>Route Final:</strong> <code>block</code> (Zero silent leaks)</span>
      <span><strong>DNS Strategy:</strong> <code>${dnsStrategySelect.value}</code></span>
    `;
    summaryMappingList.appendChild(infoFooter);
  };

  // --- Event Listeners ---
  langSwitcher.addEventListener('change', (e) => setLanguage(e.target.value));

  nodesInput.addEventListener('input', (e) => handleRawText(e.target.value));

  clearInputBtn.addEventListener('click', () => {
    nodesInput.value = '';
    resetState();
  });

  fetchSubBtn.addEventListener('click', () => {
    const url = subscriptionUrlInput.value.trim();
    if (url) fetchSubscription(url);
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        nodesInput.value = event.target.result;
        handleRawText(event.target.result);
      };
      reader.readAsText(file);
    }
  });

  // Drag and drop support
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

  // Starting port batch allocation
  startPortInput.addEventListener('input', () => {
    const startingPort = parseInt(startPortInput.value, 10) || 10808;
    normalizedNodes.forEach((node, index) => {
      node.port = startingPort + index;
    });
    renderNodeTable();
  });

  // Listen address change
  listenAddressInput.addEventListener('input', () => {
    const addr = listenAddressInput.value.trim() || '127.0.0.1';
    normalizedNodes.forEach(node => {
      node.listenAddress = addr;
    });
  });

  // Table row events (checkbox toggle & individual port change)
  nodesTableBody.addEventListener('change', (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    const nodeId = row.dataset.nodeId;
    const node = normalizedNodes.find(n => n.id === nodeId);
    if (!node) return;

    if (e.target.classList.contains('node-enabled-checkbox')) {
      node.enabled = e.target.checked;
      renderNodeTable();
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

  generateBtn.addEventListener('click', handleGenerate);
  validateBtn.addEventListener('click', runValidationAndRenderSummary);

  copyBtn.addEventListener('click', () => {
    configOutput.select();
    navigator.clipboard.writeText(configOutput.value).then(() => {
      copyBtn.textContent = langData.copiedBtn || 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = langData.copyBtn || 'Copy';
      }, 2000);
    });
  });

  downloadBtn.addEventListener('click', () => {
    if (!configOutput.value) return;
    const blob = new Blob([configOutput.value], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // --- Initial Load ---
  await initLanguage();
  singBoxTemplate = await fetchTemplate();
});
