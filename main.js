// Import JS-YAML library from CDN
import jsyaml from 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/+esm';

// --- APPLICATION LOGIC ---

document.addEventListener('DOMContentLoaded', async () => {
    // Global variables
    let outbounds = [];
    let langData = {};
    let singBoxTemplate = null;
    let isLoading = false;

    // Element references
    const nodesInput = document.getElementById('nodes-input');
    const fileInput = document.getElementById('file-input');
    const startPortInput = document.getElementById('start-port');
    const nodesListContainer = document.getElementById('nodes-list');
    const generateBtn = document.getElementById('generate-btn');
    const configContent = document.getElementById('config-content'); // Changed from configSection
    const outputSection = document.getElementById('output-section');
    const configOutput = document.getElementById('config-output');
    const copyBtn = document.getElementById('copy-btn');
    const downloadBtn = document.getElementById('download-btn');
    const langSwitcher = document.getElementById('language-switcher');
    const loadingOverlay = document.getElementById('loading-overlay');
    
    // --- UI State Management ---
    const setLoading = (state) => {
        isLoading = state;
        if (state) {
            loadingOverlay.classList.remove('hidden');
            loadingOverlay.classList.add('flex');
            nodesInput.disabled = true;
        } else {
            loadingOverlay.classList.add('hidden');
            loadingOverlay.classList.remove('flex');
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
        // Update elements with data-lang for text content
        document.querySelectorAll('[data-lang]').forEach(el => {
            const key = el.getAttribute('data-lang');
            if (langData[key]) {
                 if (el.tagName === 'BUTTON' && el.disabled) {
                    el.textContent = langData['generateBtnDisabled'];
                } else {
                    el.textContent = langData[key];
                }
            }
        });
        // Update elements with data-lang-title for tooltips
        document.querySelectorAll('[data-lang-title]').forEach(el => {
            const key = el.getAttribute('data-lang-title');
            if (langData[key]) {
                el.setAttribute('title', langData[key]);
            }
        });

        if (generateBtn.disabled) {
            generateBtn.textContent = langData.generateBtnDisabled;
        }
    };

    const setLanguage = async (lang) => {
        const data = await fetchLanguageFile(lang);
        if (data) {
            langData = data;
            applyLanguage();
        }
    };
    
    const initLanguage = async () => {
        const browserLang = navigator.language.split('-')[0];
        const lang = browserLang === 'zh' ? 'zh' : 'en';
        langSwitcher.value = lang;
        await setLanguage(lang);
    };

    // --- Template Loading ---
    const fetchTemplate = async () => {
        const url = 'sing-box-template.json.tpl';
        let text;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            text = await response.text();
        } catch (fetchError) {
            alert(langData.errorTemplateFetch);
            return null;
        }

        try {
            let cleanedText = text.replace(/(?<!:)\s*\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
            cleanedText = cleanedText.replace(/,(\s*[}\]])/g, '$1');
            cleanedText = cleanedText.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
            return JSON.parse(cleanedText);
        } catch (parseError) {
            alert(langData.errorTemplateParse);
            return null;
        }
    };

    // --- Port Validation ---
    const validatePorts = () => {
        const portInputs = Array.from(document.querySelectorAll('.node-port'));
        const portValues = new Map();
        let allPortsValid = true;

        // Reset all borders first
        portInputs.forEach(input => input.classList.remove('border-red-500', 'focus:ring-red-500'));

        for (const input of portInputs) {
            const port = parseInt(input.value, 10);
            
            // Check range
            if (isNaN(port) || port < 1 || port > 65535) {
                input.classList.add('border-red-500', 'focus:ring-red-500');
                allPortsValid = false;
            }

            // Check for duplicates
            if (portValues.has(port)) portValues.get(port).push(input);
            else portValues.set(port, [input]);
        }

        let hasDuplicates = false;
        for (const inputs of portValues.values()) {
            if (inputs.length > 1) {
                hasDuplicates = true;
                inputs.forEach(input => input.classList.add('border-red-500', 'focus:ring-red-500'));
            }
        }
        
        if (!allPortsValid) return { valid: false, error: 'invalid' };
        if (hasDuplicates) return { valid: false, error: 'duplicate' };
        return { valid: true, error: null };
    };

    // --- Node Handling ---
    const parseAndRenderNodes = (text) => {
        try {
            let cleanedText = text.replace(/,(\s*[}\]])/g, '$1');
            cleanedText = cleanedText.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
            const parsed = JSON.parse(cleanedText);
            let potentialOutbounds = null;

            if (Array.isArray(parsed)) potentialOutbounds = parsed;
            else if (typeof parsed === 'object' && parsed !== null && Array.isArray(parsed.outbounds)) potentialOutbounds = parsed.outbounds;

            if (potentialOutbounds) {
                outbounds = potentialOutbounds.filter(node => node && typeof node === 'object' && node.tag);
                if (outbounds.length > 0) {
                    renderNodeList();
                    configContent.classList.remove('hidden'); // Show content
                    generateBtn.disabled = false;
                    generateBtn.textContent = langData.generateBtn;
                } else {
                    resetConfigView();
                }
            } else {
                throw new Error("Input is not an array and does not contain an 'outbounds' array key.");
            }
        } catch (error) {
            alert(langData.errorInvalidJSON);
            resetConfigView();
        }
    };
    
    // --- Subscription Handling ---
    const fetchSubscription = async (url) => {
        // Using a public CORS proxy to fetch subscription content
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        setLoading(true);
        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const text = await response.text();
            nodesInput.value = text; // Populate textarea with fetched content
            // *** BUG FIX STARTS HERE ***
            // Directly call the parsing function, bypassing the handleInput's loading check.
            parseAndRenderNodes(text);
            // *** BUG FIX ENDS HERE ***
        } catch (error) {
            console.error("Subscription fetch error:", error);
            alert(langData.errorSubscriptionFetch);
            resetConfigView();
        } finally {
            setLoading(false);
        }
    };
    
    // --- Main Input Processor ---
    const handleInput = (text) => {
        if (isLoading) return;
        const trimmedText = text.trim();
        if (!trimmedText) {
            resetConfigView();
            return;
        }

        // Check if the input is a URL
        if (trimmedText.startsWith('http://') || trimmedText.startsWith('https://')) {
            fetchSubscription(trimmedText);
        } else {
            // Assume it's JSON content
            parseAndRenderNodes(trimmedText);
        }
    };

    const renderNodeList = () => {
        nodesListContainer.innerHTML = '';
        const startingPort = parseInt(startPortInput.value, 10);
        
        const header = document.createElement('div');
        header.className = 'grid grid-cols-12 gap-2 items-center font-semibold text-sm text-gray-600 dark:text-gray-300 px-2';
        header.innerHTML = `
            <div class="col-span-6" data-lang="nodeNameLabel">${langData.nodeNameLabel}</div>
            <div class="col-span-4" data-lang="portLabel">${langData.portLabel}</div>
            <div class="col-span-2 text-center flex items-center justify-center gap-1">
                <span data-lang="defaultLabel">${langData.defaultLabel}</span>
                <div data-lang-title="defaultTooltip" title="${langData.defaultTooltip}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="cursor-help text-gray-400"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                </div>
            </div>
        `;
        nodesListContainer.appendChild(header);

        outbounds.forEach((node, index) => {
            const nodeEl = document.createElement('div');
            nodeEl.className = 'grid grid-cols-12 gap-2 items-center bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg';
            nodeEl.innerHTML = `
                <div class="col-span-6 truncate" title="${node.tag}">${node.tag}</div>
                <div class="col-span-4">
                    <input type="number" value="${startingPort + index}" class="node-port w-full p-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
                <div class="col-span-2 flex justify-center">
                    <input type="radio" name="default-node" value="${node.tag}" ${index === 0 ? 'checked' : ''} class="default-node-radio h-5 w-5 text-blue-600 focus:ring-blue-500">
                </div>
            `;
            nodesListContainer.appendChild(nodeEl);
        });
    };

    const resetConfigView = () => {
        configContent.classList.add('hidden'); // Hide content
        outputSection.classList.add('hidden');
        generateBtn.disabled = true;
        generateBtn.textContent = langData.generateBtnDisabled;
        nodesListContainer.innerHTML = '';
        outbounds = [];
    };

    // --- Config Generation ---
    const generateConfig = () => {
        if (!singBoxTemplate) return;

        const portValidation = validatePorts();
        if (!portValidation.valid) {
            if (portValidation.error === 'duplicate') alert(langData.errorPortDuplicate);
            else alert(langData.errorPortInvalid);
            return;
        }
        
        const finalConfig = JSON.parse(JSON.stringify(singBoxTemplate));
        
        // --- Start of Final Logic ---
        
        // 1. Prepare base arrays
        finalConfig.inbounds = [];
        finalConfig.dns.servers = finalConfig.dns.servers.filter(s => s.tag === 'local_dns');
        finalConfig.dns.rules = finalConfig.dns.rules.filter(r => r.rule_set && r.rule_set.includes('geosite-cn'));
        finalConfig.route.rules = finalConfig.route.rules.filter(r => r.rule_set || r.ip_is_private || r.clash_mode);
        
        // ** NEW ** Add a global DNS strategy to prefer IPv4 and avoid IPv6 errors
        finalConfig.dns.strategy = "prefer_ipv4";

        const userOutbounds = JSON.parse(JSON.stringify(outbounds));
        const baseOutbounds = finalConfig.outbounds.filter(o => ['direct', 'block'].includes(o.tag));
        finalConfig.outbounds = [...userOutbounds, ...baseOutbounds];
        
        let defaultNodeTag = document.querySelector('input[name="default-node"]:checked').value;
        let defaultDnsServerTag = '';

        // Update rule_set download_detour to use the default proxy node so rule files
        // are fetched through the proxy tunnel (avoids direct-connection blocks / timeouts)
        finalConfig.route.rule_set.forEach(rs => {
            rs.download_detour = defaultNodeTag;
        });

        // 2. Extract proxy server hostnames to create a DNS exemption rule
        const proxyHostnames = [...new Set(userOutbounds
            .map(o => o.server)
            .filter(server => server && !/^\d{1,3}(\.\d{1,3}){3}$/.test(server))
        )];

        if (proxyHostnames.length > 0) {
            finalConfig.dns.rules.unshift({ "domain": proxyHostnames, "server": "local_dns" });
        }

        // 3. Create Inbounds, DNS servers, DNS rules, and Route rules for each node
        const nodeElements = nodesListContainer.querySelectorAll('.grid.grid-cols-12.gap-2.items-center');
        nodeElements.forEach((el, index) => {
            if (index === 0) return;
            const node = outbounds[index-1];
            const portInput = el.querySelector('.node-port');
            const radioInput = el.querySelector('.default-node-radio');
            const port = parseInt(portInput.value, 10);
            const tag = node.tag;
            const inboundTag = `in-${port}`;
            const dnsServerTag = `dns-${tag}`;

            finalConfig.inbounds.push({ "type": "mixed", "tag": inboundTag, "listen": "127.0.0.1", "listen_port": port });
            finalConfig.dns.servers.unshift({ "tag": dnsServerTag, "type": "https", "server": "1.1.1.1", "detour": tag });
            finalConfig.dns.rules.push({ "inbound": inboundTag, "server": dnsServerTag });
            finalConfig.route.rules.unshift({ "inbound": inboundTag, "outbound": tag });

            if (radioInput.checked) defaultDnsServerTag = dnsServerTag;
        });

        // 4. Set default routes, domain resolver, and final DNS
        finalConfig.route.final = defaultNodeTag;
        finalConfig.route.default_domain_resolver = { "server": "local_dns" };
        finalConfig.dns.final = defaultDnsServerTag;
        const globalModeRule = finalConfig.route.rules.find(r => r.clash_mode === "Global");
        if(globalModeRule) globalModeRule.outbound = defaultNodeTag;

        // --- End of Final Logic ---

        configOutput.value = JSON.stringify(finalConfig, null, 2);
        outputSection.classList.remove('hidden');
    };

    // --- Event Listeners ---
    langSwitcher.addEventListener('change', (e) => setLanguage(e.target.value));

    nodesInput.addEventListener('input', (e) => handleInput(e.target.value));

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                nodesInput.value = event.target.result;
                handleInput(event.target.result);
            };
            reader.readAsText(file);
        }
    });
    
    // Drag and Drop Listeners
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
                handleInput(event.target.result);
            };
            reader.readAsText(file);
        }
    });

    startPortInput.addEventListener('input', () => {
        const ports = document.querySelectorAll('.node-port');
        const startingPort = parseInt(startPortInput.value, 10);
        ports.forEach((port, index) => {
            port.value = startingPort + index;
        });
        validatePorts(); // Validate on batch change
    });

    // Live validation for individual port changes
    nodesListContainer.addEventListener('input', (e) => {
        if (e.target.classList.contains('node-port')) {
            validatePorts();
        }
    });

    generateBtn.addEventListener('click', generateConfig);

    copyBtn.addEventListener('click', () => {
        configOutput.select();
        document.execCommand('copy');
        copyBtn.textContent = langData.copiedBtn;
        setTimeout(() => { copyBtn.textContent = langData.copyBtn; }, 2000);
    });

    downloadBtn.addEventListener('click', () => {
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
    if (!singBoxTemplate) {
        document.querySelector('main').style.display = 'none';
    }
});
