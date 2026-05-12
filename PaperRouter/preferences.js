/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * PaperRouter — Zotero collection router
 * Copyright (c) Mike Zhou (Keshen Zhou)
 * Copyright (c) Wight
 * 2026 PaperRouter rewrite based on the original Tidy Up plugin.
 */

// Provider tables live in chrome/content/providers.js (loaded by bootstrap.js).
// Settings UI references the same shared objects so updates land in one place.
// recommendedModels for LLM are objects {name, tier}; for Embedding stay as plain string[].
// Cohere added to LLM, Ollama commented out (default flow assumes API).
var LLM_PROVIDERS = TidyUpProviders.LLM_PROVIDERS;
var EMBEDDING_PROVIDERS = TidyUpProviders.EMBEDDING_PROVIDERS;

function _s(k, params) {
    return (typeof TidyUpL10n !== 'undefined') ? TidyUpL10n.getString(k, params) : k;
}

var TidyUpPrefs = {
    getRuntimeRouter: function() {
        try {
            if (typeof PaperRouter !== 'undefined' && PaperRouter) return PaperRouter;
        } catch (e) {}
        try {
            if (typeof TidyUp !== 'undefined' && TidyUp) return TidyUp;
        } catch (e) {}
        try {
            if (typeof Zotero !== 'undefined') {
                if (Zotero.PaperRouter) return Zotero.PaperRouter;
                if (Zotero.TidyUp) return Zotero.TidyUp;
            }
        } catch (e) {}
        return null;
    },

    localizeUI: function() {
        if (typeof TidyUpL10n === 'undefined') return;
        var s = TidyUpL10n.getString.bind(TidyUpL10n);
        var set = function(id, key, attr) {
            attr = attr || 'value';
            var el = document.getElementById(id);
            if (el) el.setAttribute(attr, s(key));
        };
        var setLabel = function(id, key) { set(id, key, 'label'); };
        var setPlaceholder = function(id, key) { set(id, key, 'placeholder'); };
        var setText = function(id, key) {
            var el = document.getElementById(id);
            if (el) el.textContent = s(key);
        };
        set('l10n-language-caption', 'language');
        setText('l10n-language-desc', 'prefs-language-desc');
        set('l10n-language-label', 'prefs-language-label');
        setText('l10n-api-settings', 'prefs-api-settings');
        setText('l10n-api-intro', 'prefs-api-intro');
        setText('l10n-embedding', 'prefs-embedding');
        setText('l10n-embedding-desc', 'prefs-embedding-desc');
        set('l10n-provider', 'prefs-provider');
        set('l10n-base-api-embedding', 'prefs-base-api');
        set('l10n-api-key', 'prefs-api-key');
        set('l10n-model', 'prefs-model');
        setPlaceholder('embedding-base-url', 'prefs-base-api-placeholder');
        setPlaceholder('embedding-api-key', 'prefs-api-key-placeholder');
        setPlaceholder('embedding-model', 'prefs-model-placeholder');
        setText('l10n-llm', 'prefs-llm');
        setText('l10n-llm-desc', 'prefs-llm-desc');
        set('l10n-algorithm', 'prefs-algorithm');
        setText('l10n-alg-vector', 'prefs-alg-vector');
        setText('l10n-alg-vector-hint', 'prefs-alg-vector-hint');
        setText('l10n-alg-zeroshot', 'prefs-alg-zeroshot');
        setText('l10n-alg-zeroshot-hint', 'prefs-alg-zeroshot-hint');
        set('l10n-llm-provider', 'prefs-llm-provider');
        set('l10n-base-api-llm', 'prefs-base-api');
        set('l10n-api-key-llm', 'prefs-api-key');
        set('l10n-model-llm', 'prefs-model');
        setPlaceholder('llm-base-url', 'prefs-base-api-placeholder');
        setPlaceholder('llm-api-key', 'prefs-api-key-placeholder');
        set('l10n-model-custom-label', 'prefs-model-custom-label');
        setPlaceholder('llm-model-custom', 'prefs-model-custom-placeholder');
        setLabel('btn-test-llm', 'prefs-btn-test-llm');
        setLabel('btn-save', 'prefs-btn-save');
        setLabel('btn-test', 'prefs-btn-test');
        setLabel('btn-clear-cache', 'prefs-btn-clear-cache');
        set('l10n-cached-count', 'prefs-cached-count');
        setLabel('btn-refresh-cache', 'prefs-btn-refresh');
        set('l10n-test-mode', 'prefs-test-mode');
        setText('l10n-test-mode-desc', 'prefs-test-mode-desc');
        setLabel('test-mode-enabled', 'prefs-test-mode-enable');
        set('l10n-max-process', 'prefs-max-process');
        set('l10n-collections-unit', 'prefs-collections-unit');
        setLabel('test-mode-mock-api', 'prefs-mock-api');
        set('l10n-collection-limit', 'prefs-collection-limit');
        setText('l10n-collection-limit-desc', 'prefs-collection-limit-desc');
        set('l10n-max-collections', 'prefs-max-collections');
        set('l10n-max-collections-unit', 'prefs-max-collections-unit');
        var langSelect = document.getElementById('language-select');
        if (langSelect && langSelect.menupopup) {
            var items = langSelect.menupopup.querySelectorAll('menuitem');
            items.forEach(function(mi, i) {
                var v = mi.getAttribute('value');
                mi.setAttribute('label', s('language-' + (v === 'auto' ? 'auto' : v)));
            });
        }
    },
    
    loadLanguage: function() {
        var sel = document.getElementById('language-select');
        if (!sel || typeof TidyUpL10n === 'undefined') return;
        var lang = TidyUpL10n.getLanguage();
        sel.value = lang || 'auto';
    },
    
    saveLanguage: function() {
        var sel = document.getElementById('language-select');
        if (!sel || typeof TidyUpL10n === 'undefined') return;
        TidyUpL10n.setLanguage(sel.value);
        this.localizeUI();
    },
    
    log: function(msg) {
        try {
            Zotero.debug('PaperRouter Preferences: ' + msg);
            console.log('PaperRouter Preferences: ' + msg);
        } catch (e) {}
    },
    
    _normalizeBaseUrl: function(url) {
        return (url || '').trim().replace(/\/+$/, '');
    },
    
    _setProviderUi: function(opts) {
        var providerEl = document.getElementById(opts.providerId);
        var baseUrlField = document.getElementById(opts.baseUrlId);

        if (!providerEl || !baseUrlField) return;

        var provider = providerEl.value;
        var providerTable = opts.providerTable || {};
        var cfg = providerTable[provider];

        var current = this._normalizeBaseUrl(baseUrlField.value);
        var currentIsEmpty = !current;
        var replaceIfIn = opts.autoReplaceIfCurrentIn || {};
        var replaceList = (replaceIfIn[provider] || []).map(this._normalizeBaseUrl);
        var shouldAutoSet = currentIsEmpty || replaceList.indexOf(current) !== -1;

        if (cfg && shouldAutoSet && cfg.defaultBaseUrl) {
            baseUrlField.value = cfg.defaultBaseUrl;
        } else if (!provider && shouldAutoSet) {
            baseUrlField.value = opts.noneBaseUrl || '';
        }
    },
    
    _refreshModelDatalist: function(datalistId, providerKey, providerTable) {
        // Embedding side — strings, simple datalist.
        var dl = document.getElementById(datalistId);
        if (!dl) return;
        dl.innerHTML = '';
        var cfg = providerTable[providerKey];
        if (!cfg) return;
        cfg.recommendedModels.forEach(function(m, i) {
            var opt = document.createElement('option');
            opt.value = m;
            opt.label = i === 0 ? m + ' (recommended)' : m;
            dl.appendChild(opt);
        });
    },

    // LLM side — XUL <menulist> + <menupopup> + <menuitem>. Disabled menuitems act as group headers (XUL has no native optgroup).
    // Closed state shows just the model name; open state shows grouped headers.
    _renderModelSelect: function(menulistId, providerKey, providerTable, currentValue) {
        var menulist = document.getElementById(menulistId);
        if (!menulist) return;
        var popup = menulist.querySelector('menupopup');
        if (!popup) return;
        while (popup.firstChild) popup.removeChild(popup.firstChild);
        var make = document.createXULElement
            ? document.createXULElement.bind(document)
            : function(t) { return document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', t); };

        var cfg = providerTable[providerKey];
        var hasPresets = cfg && cfg.recommendedModels && cfg.recommendedModels.length > 0;

        if (hasPresets) {
            var groups = {};
            cfg.recommendedModels.forEach(function(m) {
                (groups[m.tier] = groups[m.tier] || []).push(m);
            });
            var tierOrder = ['recommended', 'cheaper', 'top', 'reasoning', 'older', 'opensource', 'common'];
            tierOrder.forEach(function(tier) {
                if (!groups[tier]) return;
                // Group header — disabled menuitem styled as a label.
                var header = make('menuitem');
                header.setAttribute('label', _s('prefs-model-tier-' + tier));
                header.setAttribute('disabled', 'true');
                header.style.fontSize = '11px';
                header.style.fontWeight = '600';
                header.style.color = '#888';
                popup.appendChild(header);
                groups[tier].forEach(function(m) {
                    var mi = make('menuitem');
                    mi.setAttribute('value', m.name);
                    mi.setAttribute('label', m.name);
                    popup.appendChild(mi);
                });
            });
            popup.appendChild(make('menuseparator'));
        }
        var customMi = make('menuitem');
        customMi.setAttribute('value', '__custom__');
        customMi.setAttribute('label', _s('prefs-model-custom-option'));
        popup.appendChild(customMi);

        // Set the menulist's selected item.
        var preset = false;
        if (hasPresets) {
            preset = (cfg.recommendedModels || []).some(function(m) { return m.name === currentValue; });
        }
        if (preset) {
            menulist.value = currentValue;
        } else if (currentValue) {
            menulist.value = '__custom__';
        } else {
            menulist.value = (cfg && cfg.defaultModel) || '__custom__';
        }
    },

    _updateKeyEmptyHint: function(sectionKey) {
        var input = document.getElementById(sectionKey + '-api-key');
        var hint = document.getElementById(sectionKey + '-key-empty-hint');
        if (!input || !hint) return;
        if (!input.value) {
            hint.textContent = _s('prefs-key-empty-hint');
            hint.style.display = 'block';
        } else {
            hint.style.display = 'none';
        }
    },

    _populateProviderDropdown: function(popupId, providerTable) {
        var popup = document.getElementById(popupId);
        if (!popup) return;
        while (popup.firstChild) popup.removeChild(popup.firstChild);
        var makeItem = document.createXULElement
            ? document.createXULElement.bind(document)
            : function(t) { return document.createElementNS('http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul', t); };
        var none = makeItem('menuitem');
        none.setAttribute('value', '');
        none.setAttribute('label', _s('prefs-none'));
        popup.appendChild(none);
        for (var key in providerTable) {
            var mi = makeItem('menuitem');
            mi.setAttribute('value', key);
            mi.setAttribute('label', providerTable[key].displayName);
            popup.appendChild(mi);
        }
    },

    _stripVersion: function(url) {
        return (url || '').replace(/\/v\d+(beta)?\/?$/i, '');
    },

    // Heuristic cleanup for legacy global → per-provider model migration:
    // a per-provider model that (a) equals the legacy global model AND (b) is not in that provider's
    // recommendedModels list is almost certainly a stale cross-pollution leak. Clear it so the
    // model picker falls back to the provider's defaultModel.
    _cleanupMigrationLeaks: function() {
        try {
            ['llm', 'embedding'].forEach(function(side) {
                var legacy = Zotero.Prefs.get('extensions.tidy-up.' + side + '.model', true);
                if (!legacy) return;
                var table = (side === 'llm') ? LLM_PROVIDERS : EMBEDDING_PROVIDERS;
                Object.keys(table).forEach(function(provider) {
                    if (provider === 'custom') return;
                    var path = 'extensions.tidy-up.' + side + '.' + provider + '.model';
                    var saved = Zotero.Prefs.get(path, true);
                    if (!saved || saved !== legacy) return;
                    var presetNames = (table[provider].recommendedModels || []).map(function(m) {
                        return (typeof m === 'string') ? m : m.name;
                    });
                    if (presetNames.indexOf(saved) === -1) {
                        Zotero.Prefs.set(path, '', true);
                        Zotero.debug('PaperRouter: cleared migration leak ' + path + ' = "' + saved + '"');
                    }
                });
            });
        } catch (e) {
            Zotero.debug('PaperRouter: _cleanupMigrationLeaks error: ' + e.message);
        }
    },

    // Reset saved prefs that point at models we no longer ship (OpenAI o-series,
    // legacy Gemini, dropped OpenRouter defaults, Gemini embedding).
    _cleanupRemovedModels: function() {
        try {
            var resetIf = function(path, predicate, fallback) {
                var saved = Zotero.Prefs.get(path, true);
                if (typeof saved !== 'string' || !predicate(saved)) return;
                Zotero.Prefs.set(path, fallback, true);
                Zotero.debug('PaperRouter cleanup: reset "' + saved + '" at ' + path + ' → "' + fallback + '"');
            };

            resetIf('extensions.tidy-up.llm.openai.model',
                function(s) { return /^o[134]\b/.test(s.toLowerCase()); },
                (LLM_PROVIDERS.openai && LLM_PROVIDERS.openai.defaultModel) || 'gpt-4.1');

            resetIf('extensions.tidy-up.llm.gemini.model',
                function(s) { return /^gemini-(1\.5|2\.0)/.test(s); },
                LLM_PROVIDERS.gemini.defaultModel);

            var orRemoved = ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o-mini', 'meta-llama/llama-3.1-70b-instruct'];
            resetIf('extensions.tidy-up.llm.openrouter.model',
                function(s) { return orRemoved.indexOf(s) !== -1; },
                LLM_PROVIDERS.openrouter.defaultModel);

            // Embedding side: Gemini removed. If user had it selected, reset to '' so they re-pick.
            resetIf('extensions.tidy-up.embedding.provider',
                function(s) { return s === 'gemini'; },
                '');
        } catch (e) {
            Zotero.debug('PaperRouter: _cleanupRemovedModels error: ' + e.message);
        }
    },

    _guessProviderFromBaseUrl: function(baseUrl, providerTable) {
        var u = this._stripVersion(this._normalizeBaseUrl(baseUrl));
        if (!u) return '';
        for (var key in providerTable) {
            var def = this._stripVersion(this._normalizeBaseUrl(providerTable[key].defaultBaseUrl));
            if (def && def === u) return key;
        }
        return '';
    },

    _updateApiStatus: function(sectionKey) {
        var provider = document.getElementById(sectionKey + '-provider').value;
        var apiKey = document.getElementById(sectionKey + '-api-key').value;
        var el = document.getElementById(sectionKey + '-status');
        if (!el) return;
        if (provider && apiKey) {
            el.textContent = _s('prefs-status-configured');
            el.style.color = '#16a34a';
        } else {
            el.textContent = _s('prefs-status-not-configured');
            el.style.color = '#888';
        }
    },

    _updateProviderHint: function(sectionKey, providerTable) {
        var provider = document.getElementById(sectionKey + '-provider').value;
        var el = document.getElementById(sectionKey + '-provider-hint');
        if (!el) return;
        var keyMap = { ollama: 'prefs-hint-ollama', openrouter: 'prefs-hint-openrouter', custom: 'prefs-hint-custom' };
        el.textContent = keyMap[provider] ? _s(keyMap[provider]) : '';
    },

    _updateAlgorithmWarning: function() {
        var selected = document.querySelector('input[name="alg"]:checked');
        var warn = document.getElementById('algorithm-warning');
        if (!selected || !warn) return;
        var llmProvider = document.getElementById('llm-provider');
        var llmApiKey = document.getElementById('llm-api-key');
        var llmConfigured = llmProvider && llmProvider.value && llmApiKey && llmApiKey.value;
        var show = (selected.value === 'zeroshot' && !llmConfigured);
        if (show) warn.textContent = _s('prefs-alg-warning');
        warn.style.display = show ? 'block' : 'none';
    },

    showTestStatus: function(message, type) {
        var statusSpan = document.getElementById('test-status');
        if (!statusSpan) return;
        statusSpan.textContent = message;
        statusSpan.style.display = 'inline';
        
        statusSpan.style.color = type === 'success' ? '#155724' : 
                                 type === 'error' ? '#721c24' : '#0c5460';
        statusSpan.style.background = type === 'success' ? '#d4edda' : 
                                      type === 'error' ? '#f8d7da' : '#d1ecf1';
        statusSpan.style.padding = '4px 8px';
        statusSpan.style.borderRadius = '4px';
        statusSpan.style.border = '1px solid ' + 
                                 (type === 'success' ? '#c3e6cb' : 
                                  type === 'error' ? '#f5c6cb' : '#bee5eb');
        
        if (type === 'success') {
            setTimeout(function() {
                statusSpan.style.display = 'none';
            }, 5000);
        }
    },
    
    onProviderChange: function() {
        var provider = document.getElementById('embedding-provider').value;
        this._setProviderUi({
            providerId: 'embedding-provider',
            baseUrlId: 'embedding-base-url',
            providerTable: EMBEDDING_PROVIDERS,
            noneBaseUrl: '',
            autoReplaceIfCurrentIn: {
                openai: ['https://api.cohere.ai/v1', 'http://localhost:11434/v1', 'https://generativelanguage.googleapis.com/v1beta'],
                cohere: ['https://api.openai.com/v1', 'http://localhost:11434/v1', 'https://generativelanguage.googleapis.com/v1beta'],
                gemini: ['https://api.openai.com/v1', 'https://api.cohere.ai/v1', 'http://localhost:11434/v1'],
                ollama: ['https://api.openai.com/v1', 'https://api.cohere.ai/v1', 'https://generativelanguage.googleapis.com/v1beta'],
                '': ['https://api.openai.com/v1', 'https://api.cohere.ai/v1', 'http://localhost:11434/v1', 'https://generativelanguage.googleapis.com/v1beta']
            }
        });
        // Per-provider apiKey + model — load this provider's saved values.
        var savedKey = (provider && Zotero.Prefs.get('extensions.tidy-up.embedding.' + provider + '.apiKey', true)) || '';
        var savedModel = (provider && Zotero.Prefs.get('extensions.tidy-up.embedding.' + provider + '.model', true)) || '';
        var apiKeyEl = document.getElementById('embedding-api-key');
        if (apiKeyEl) {
            apiKeyEl.value = savedKey;
            apiKeyEl.type = 'password';
            var eyeBtn = document.getElementById('embedding-api-key-eye');
            if (eyeBtn) eyeBtn.textContent = '👁';
        }
        this._refreshModelDatalist('embedding-model-options', provider, EMBEDDING_PROVIDERS);
        var modelInput = document.getElementById('embedding-model');
        if (modelInput) {
            var newDefault = (EMBEDDING_PROVIDERS[provider] && EMBEDDING_PROVIDERS[provider].defaultModel) || '';
            modelInput.value = savedModel || newDefault;
        }
        this._updateKeyEmptyHint('embedding');
        this._updateProviderHint('embedding', EMBEDDING_PROVIDERS);
        this._updateApiStatus('embedding');
    },
    
    save: function() {
        this.log('save called');
        try {
            var provider = document.getElementById('embedding-provider').value;
            var baseUrl = document.getElementById('embedding-base-url').value;
            var apiKey = document.getElementById('embedding-api-key').value;
            var model = document.getElementById('embedding-model').value;
            
            Zotero.Prefs.set('extensions.tidy-up.embedding.provider', provider, true);
            Zotero.Prefs.set('extensions.tidy-up.embedding.baseUrl', baseUrl, true);
            // Per-provider apiKey + model. Legacy single-key prefs kept in sync for back-compat.
            if (provider) {
                Zotero.Prefs.set('extensions.tidy-up.embedding.' + provider + '.apiKey', apiKey, true);
                Zotero.Prefs.set('extensions.tidy-up.embedding.' + provider + '.model', model, true);
            }
            Zotero.Prefs.set('extensions.tidy-up.embedding.apiKey', apiKey, true);
            Zotero.Prefs.set('extensions.tidy-up.embedding.model', model, true);
            
            var router = this.getRuntimeRouter();
            if (router && router.setEmbeddingConfig) {
                router.setEmbeddingConfig({
                    provider: provider || null,
                    model: model || null,
                    baseUrl: baseUrl || null,
                    apiKey: apiKey || null
                });
            }
            
            this.showTestStatus((typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('msg-settings-saved') : 'Settings saved'), 'success');
            this.log('Settings saved successfully');
        } catch (e) {
            this.log('Error saving settings: ' + e.message);
            this.showTestStatus((typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('msg-save-failed', { msg: e.message }) : 'Save failed: ' + e.message), 'error');
        }
    },
    
    testConnection: function() {
        this.log('testConnection called');
        
        var provider = document.getElementById('embedding-provider').value;
        var apiKey = document.getElementById('embedding-api-key').value;
        var baseUrl = document.getElementById('embedding-base-url').value;
        
        this.log('provider=' + provider + ', baseUrl=' + baseUrl + ', apiKey=' + (apiKey ? 'set' : 'empty'));
        
        if (!provider) {
            this.showTestStatus((typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('msg-select-provider') : 'Please select a provider first'), 'error');
            return;
        }
        
        if (!apiKey) {
            this.showTestStatus((typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('msg-enter-api-key') : 'Please enter API Key first'), 'error');
            return;
        }
        
        if (!baseUrl) {
            this.showTestStatus((typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('msg-enter-base-api') : 'Please enter Base API first'), 'error');
            return;
        }
        
        this.showTestStatus((typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('msg-testing') : 'Testing...'), 'info');

        var self = this;
        try {
            var model = document.getElementById('embedding-model').value;

            this.testEmbedding({
                provider: provider,
                apiKey: apiKey,
                model: model,
                baseUrl: baseUrl
            }).then(function(embedding) {
                if (embedding) {
                    self.showTestStatus((typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('msg-connect-ok') : '✓ Connected'), 'success');
                } else {
                    self.showTestStatus((typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('msg-connect-fail') : '✗ Connection failed'), 'error');
                }
            }).catch(function(e) {
                self.showTestStatus('✗ ' + (e && e.message ? e.message : String(e)), 'error');
                self.log('Test connection error: ' + (e && e.message));
            });
        } catch (e) {
            self.showTestStatus('✗ ' + (e && e.message ? e.message : String(e)), 'error');
            self.log('Test connection sync error: ' + (e && e.message));
        }
    },
    
    // Wrap fetch with a 30s AbortController timeout so the test-connection button
    // cannot hang indefinitely on a stalled network. AbortError is rewritten to a
    // user-readable 'Request timeout (30s)' string.
    _fetchWithTimeout: function(url, options) {
        var ctrl = new AbortController();
        var timeoutId = setTimeout(function() { ctrl.abort(); }, 30000);
        var opts = Object.assign({}, options || {}, { signal: ctrl.signal });
        return fetch(url, opts)
            .finally(function() { clearTimeout(timeoutId); })
            .catch(function(e) {
                if (e && e.name === 'AbortError') throw new Error('Request timeout (30s)');
                throw e;
            });
    },

    testEmbedding: function(config) {
        var testText = 'Hello World';
        var fetchT = this._fetchWithTimeout.bind(this);

        if (config.provider === 'openai' || config.provider === 'ollama' || config.provider === 'custom') {
            var baseUrl = config.baseUrl;
            if (baseUrl.indexOf('/v1') === -1 && config.provider !== 'ollama') {
                baseUrl = baseUrl.replace(/\/$/, '') + '/v1';
            }
            var model = config.model || 'text-embedding-3-small';
            var headers = { 'Content-Type': 'application/json' };
            if (config.apiKey) headers['Authorization'] = 'Bearer ' + config.apiKey;

            return fetchT(baseUrl + '/embeddings', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ model: model, input: testText })
            }).then(function(response) {
                if (!response.ok) {
                    return response.text().then(function(errorText) {
                        throw new Error('HTTP ' + response.status + ': ' + errorText.substring(0, 100));
                    });
                }
                return response.json();
            }).then(function(data) {
                return data.data[0].embedding;
            });

        } else if (config.provider === 'cohere') {
            var baseUrl = config.baseUrl;
            if (baseUrl.indexOf('/v1') === -1) {
                baseUrl = baseUrl.replace(/\/$/, '') + '/v1';
            }
            var model = config.model || 'embed-multilingual-v3.0';

            return fetchT(baseUrl + '/embed', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + config.apiKey
                },
                body: JSON.stringify({ model: model, texts: [testText], input_type: 'search_document' })
            }).then(function(response) {
                if (!response.ok) {
                    return response.text().then(function(errorText) {
                        throw new Error('HTTP ' + response.status + ': ' + errorText.substring(0, 100));
                    });
                }
                return response.json();
            }).then(function(data) {
                return data.embeddings[0];
            });

        }

        return Promise.resolve(null);
    },
    
    updateCacheStatus: function() {
        try {
            var count = 0;
            var router = this.getRuntimeRouter();
            if (router && router.embeddingsCache) {
                count = router.embeddingsCache.cache.size;
            }
            document.getElementById('cache-count').value = count.toString();
        } catch (e) {
            document.getElementById('cache-count').value = '0';
        }
    },
    
    updateTestModeStatus: function() {
        var statusLabel = document.getElementById('test-mode-status');
        var enabledCheckbox = document.getElementById('test-mode-enabled');
        
        if (!statusLabel || !enabledCheckbox) return;
        
        if (enabledCheckbox.checked) {
            statusLabel.value = (typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('prefs-test-mode-warning') : '⚠ Test mode');
            statusLabel.style.color = '#d9534f';
        } else {
            statusLabel.value = (typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('prefs-normal-mode') : '✓ Normal mode');
            statusLabel.style.color = '#5cb85c';
        }
    },
    
    saveTestMode: function() {
        this.log('saveTestMode called');
        try {
            var enabled = document.getElementById('test-mode-enabled').checked;
            var maxCollections = parseInt(document.getElementById('test-mode-max-collections').value, 10) || 3;
            var mockApi = document.getElementById('test-mode-mock-api').checked;
            
            Zotero.Prefs.set('extensions.tidy-up.testMode.enabled', enabled, true);
            Zotero.Prefs.set('extensions.tidy-up.testMode.maxCollections', maxCollections, true);
            Zotero.Prefs.set('extensions.tidy-up.testMode.mockApiResponses', mockApi, true);
            
            var router = this.getRuntimeRouter();
            if (router && router.testMode) {
                router.testMode.enabled = enabled;
                router.testMode.maxCollections = maxCollections;
                router.testMode.mockApiResponses = mockApi;
            }
            
            this.updateTestModeStatus();
            this.log('Test mode saved: enabled=' + enabled + ', maxCollections=' + maxCollections + ', mockApi=' + mockApi);
        } catch (e) {
            this.log('Error saving test mode: ' + e.message);
        }
    },
    
    saveMaxCollectionNum: function() {
        this.log('saveMaxCollectionNum called');
        try {
            var maxNum = parseInt(document.getElementById('max-collection-num').value, 10) || 4;
            
            // Limit range
            if (maxNum < 1) maxNum = 1;
            if (maxNum > 20) maxNum = 20;
            
            document.getElementById('max-collection-num').value = maxNum;
            
            Zotero.Prefs.set('extensions.tidy-up.maxCollectionNum', maxNum, true);
            
            var router = this.getRuntimeRouter();
            if (router) {
                router.maxCollectionNum = maxNum;
            }
            
            this.updateMaxCollectionHint();
            this.log('Max collection num saved: ' + maxNum);
        } catch (e) {
            this.log('Error saving max collection num: ' + e.message);
        }
    },
    
    loadMaxCollectionNum: function() {
        try {
            var maxNum = Zotero.Prefs.get('extensions.tidy-up.maxCollectionNum', true);
            
            if (!maxNum) maxNum = 4;
            
            document.getElementById('max-collection-num').value = maxNum;
            
            var router = this.getRuntimeRouter();
            if (router) {
                router.maxCollectionNum = maxNum;
            }
            
            this.updateMaxCollectionHint();
            this.log('Max collection num loaded: ' + maxNum);
        } catch (e) {
            this.log('Error loading max collection num: ' + e.message);
        }
    },
    
    updateMaxCollectionHint: function() {
        var hintLabel = document.getElementById('max-collection-hint');
        var maxNum = parseInt(document.getElementById('max-collection-num').value, 10) || 4;
        
        if (hintLabel) {
            hintLabel.value = (typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('prefs-max-collections-hint', { count: maxNum }) : 'At most ' + maxNum + ' Collection(s) when recommending');
        }
    },
    
    onLlmProviderChange: function() {
        var provider = document.getElementById('llm-provider').value;
        this._setProviderUi({
            providerId: 'llm-provider',
            baseUrlId: 'llm-base-url',
            providerTable: LLM_PROVIDERS,
            noneBaseUrl: '',
            autoReplaceIfCurrentIn: {
                openai: ['https://api.cohere.ai/v1', 'http://localhost:11434/v1', 'https://generativelanguage.googleapis.com/v1beta', 'https://api.anthropic.com/v1', 'https://openrouter.ai/api/v1'],
                cohere: ['https://api.openai.com/v1', 'http://localhost:11434/v1', 'https://generativelanguage.googleapis.com/v1beta', 'https://api.anthropic.com/v1', 'https://openrouter.ai/api/v1'],
                anthropic: ['https://api.openai.com/v1', 'https://api.cohere.ai/v1', 'http://localhost:11434/v1', 'https://generativelanguage.googleapis.com/v1beta', 'https://openrouter.ai/api/v1'],
                gemini: ['https://api.openai.com/v1', 'https://api.cohere.ai/v1', 'http://localhost:11434/v1', 'https://api.anthropic.com/v1', 'https://openrouter.ai/api/v1'],
                openrouter: ['https://api.openai.com/v1', 'https://api.cohere.ai/v1', 'http://localhost:11434/v1', 'https://generativelanguage.googleapis.com/v1beta', 'https://api.anthropic.com/v1'],
                ollama: ['https://api.openai.com/v1', 'https://api.cohere.ai/v1', 'https://generativelanguage.googleapis.com/v1beta', 'https://api.anthropic.com/v1', 'https://openrouter.ai/api/v1'],
                '': ['https://api.openai.com/v1', 'https://api.cohere.ai/v1', 'http://localhost:11434/v1', 'https://generativelanguage.googleapis.com/v1beta', 'https://api.anthropic.com/v1', 'https://openrouter.ai/api/v1']
            }
        });
        // Per-provider apiKey + model: load this provider's saved values from prefs.
        var savedKey = (provider && Zotero.Prefs.get('extensions.tidy-up.llm.' + provider + '.apiKey', true)) || '';
        var savedModel = (provider && Zotero.Prefs.get('extensions.tidy-up.llm.' + provider + '.model', true)) || '';
        var apiKeyEl = document.getElementById('llm-api-key');
        if (apiKeyEl) {
            apiKeyEl.value = savedKey;
            apiKeyEl.type = 'password';
            var eyeBtn = document.getElementById('llm-api-key-eye');
            if (eyeBtn) eyeBtn.textContent = '👁';
        }
        var modelToShow = savedModel || (LLM_PROVIDERS[provider] && LLM_PROVIDERS[provider].defaultModel) || '';
        this._renderModelSelect('llm-model-select', provider, LLM_PROVIDERS, modelToShow);
        var customRow = document.getElementById('llm-model-custom-row');
        var customInput = document.getElementById('llm-model-custom');
        var sel = document.getElementById('llm-model-select');
        if (customRow && customInput && sel) {
            if (sel.value === '__custom__') {
                customRow.style.display = '';
                customInput.value = savedModel || '';
            } else {
                customRow.style.display = 'none';
                customInput.value = '';
            }
        }
        this._updateKeyEmptyHint('llm');
        this._updateProviderHint('llm', LLM_PROVIDERS);
        this._updateApiStatus('llm');
        this._updateAlgorithmWarning();
    },

    // Read the user's chosen model from select (or custom input if Custom selected).
    _readLlmModelFromUI: function() {
        var sel = document.getElementById('llm-model-select');
        if (!sel) return '';
        if (sel.value === '__custom__') {
            var custom = document.getElementById('llm-model-custom');
            return (custom && custom.value) ? custom.value.trim() : '';
        }
        return sel.value;
    },
    
    saveLlmConfig: function() {
        this.log('saveLlmConfig called');
        try {
            var provider = document.getElementById('llm-provider').value;
            var baseUrl = document.getElementById('llm-base-url').value;
            var apiKey = document.getElementById('llm-api-key').value;
            var algChecked = document.querySelector('input[name="alg"]:checked');
            var algorithm = algChecked ? algChecked.value : 'vector';
            var model = this._readLlmModelFromUI();

            Zotero.Prefs.set('extensions.tidy-up.llm.provider', provider, true);
            Zotero.Prefs.set('extensions.tidy-up.llm.baseUrl', baseUrl, true);
            // Per-provider apiKey + model. Also keep legacy single-key prefs in sync (back-compat for any code path still reading the old keys).
            if (provider) {
                Zotero.Prefs.set('extensions.tidy-up.llm.' + provider + '.apiKey', apiKey, true);
                Zotero.Prefs.set('extensions.tidy-up.llm.' + provider + '.model', model, true);
            }
            Zotero.Prefs.set('extensions.tidy-up.llm.apiKey', apiKey, true);
            Zotero.Prefs.set('extensions.tidy-up.llm.model', model, true);
            Zotero.Prefs.set('extensions.tidy-up.classification.algorithm', algorithm, true);
            
            var router = this.getRuntimeRouter();
            if (router && router.setLlmConfig) {
                router.setLlmConfig({
                    provider: provider || null,
                    model: model || null,
                    baseUrl: baseUrl || null,
                    apiKey: apiKey || null
                });
                
                if (router.setClassificationAlgorithm) {
                    router.setClassificationAlgorithm(algorithm);
                }
            }
            
            this.showLlmTestStatus((typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('msg-settings-saved') : 'Settings saved'), 'success');
            this.log('LLM config saved successfully, algorithm: ' + algorithm);
        } catch (e) {
            this.log('Error saving LLM config: ' + e.message);
            this.showLlmTestStatus((typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('msg-save-failed', { msg: e.message }) : 'Save failed: ' + e.message), 'error');
        }
    },
    
    testLlmConnection: function() {
        this.log('testLlmConnection called');
        
        var provider = document.getElementById('llm-provider').value;
        var apiKey = document.getElementById('llm-api-key').value;
        var baseUrl = document.getElementById('llm-base-url').value;
        
        this.log('LLM provider=' + provider + ', baseUrl=' + baseUrl + ', apiKey=' + (apiKey ? 'set' : 'empty'));
        
        if (!provider) {
            this.showLlmTestStatus((typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('msg-select-provider') : 'Please select a provider first'), 'error');
            return;
        }
        
        if (!apiKey) {
            this.showLlmTestStatus((typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('msg-enter-api-key') : 'Please enter API Key first'), 'error');
            return;
        }
        
        if (!baseUrl) {
            this.showLlmTestStatus((typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('msg-enter-base-api') : 'Please enter Base API first'), 'error');
            return;
        }
        
        this.showLlmTestStatus((typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('msg-testing') : 'Testing...'), 'info');

        var self = this;
        try {
            var model = this._readLlmModelFromUI();

            this.testLlmChat({
                provider: provider,
                apiKey: apiKey,
                model: model,
                baseUrl: baseUrl
            }).then(function(result) {
                if (result) {
                    var displayModel = (model && model.length > 24) ? model.substring(0, 22) + '..' : (model || '');
                    self.showLlmTestStatus((typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('msg-llm-connect-ok', { model: displayModel }) : '✓ Connected · ' + displayModel), 'success');
                    self.updateLlmStatus(typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('msg-llm-available') : 'Available');
                } else {
                    self.showLlmTestStatus((typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('msg-connect-fail') : '✗ Connection failed'), 'error');
                    self.updateLlmStatus(typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('msg-llm-unavailable') : 'Unavailable');
                }
            }).catch(function(e) {
                var emsg = (e && e.message) ? e.message : String(e);
                if (emsg.length > 50) emsg = emsg.substring(0, 47) + '...';
                self.showLlmTestStatus('✗ ' + emsg, 'error');
                self.updateLlmStatus('Unavailable');
                self.log('Test LLM connection error: ' + (e && e.message));
            });
        } catch (e) {
            // Catch synchronous throws (e.g. missing element) so the status doesn't hang at "Testing...".
            self.showLlmTestStatus('✗ ' + (e && e.message ? e.message : String(e)), 'error');
            self.updateLlmStatus('Unavailable');
            self.log('Test LLM connection sync error: ' + (e && e.message));
        }
    },
    
    testLlmChat: function(config) {
        var TEST_PROMPT = 'Classify the following Collection name as: external (describing surface features of Items, e.g. "--Top Venue Papers") or internal (defining semantically rich meaning, e.g. "Contrastive Learning"). Answer only "external" or "internal". Collection name: Test Collection';

        var req;
        switch (config.provider) {
            case 'openai':
            case 'openrouter':
            case 'custom':
                req = TidyUpProviders.buildOpenAIRequest(config, TEST_PROMPT, true);
                break;
            case 'anthropic':
                req = TidyUpProviders.buildAnthropicRequest(config, TEST_PROMPT, true);
                break;
            case 'gemini':
                req = TidyUpProviders.buildGeminiRequest(config, TEST_PROMPT, true);
                break;
            case 'cohere':
                req = TidyUpProviders.buildCohereRequest(config, TEST_PROMPT, true);
                break;
            default:
                return Promise.resolve(null);
        }

        return this._fetchWithTimeout(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body) })
            .then(function(response) {
                if (!response.ok) {
                    return response.text().then(function(errorText) {
                        throw new Error(TidyUpProviders.parseErrorBody(config.provider, response.status, errorText));
                    });
                }
                return response.json();
            })
            .then(function(data) {
                var kind = TidyUpProviders.classify(config.provider, config.model);
                var parsed = TidyUpProviders.parseChatResponse(config.provider, kind, data);
                if (parsed.error === 'empty_truncated') throw new Error(_s('err-empty-budget'));
                if (parsed.error) throw new Error(parsed.error);
                return parsed.content;
            });
    },
    
    showLlmTestStatus: function(message, type) {
        var statusSpan = document.getElementById('llm-test-status');
        if (!statusSpan) return;
        statusSpan.textContent = message;
        statusSpan.style.display = 'inline';
        
        statusSpan.style.color = type === 'success' ? '#155724' : 
                                 type === 'error' ? '#721c24' : '#0c5460';
        statusSpan.style.background = type === 'success' ? '#d4edda' : 
                                      type === 'error' ? '#f8d7da' : '#d1ecf1';
        statusSpan.style.padding = '4px 8px';
        statusSpan.style.borderRadius = '4px';
        statusSpan.style.border = '1px solid ' + 
                                 (type === 'success' ? '#c3e6cb' : 
                                  type === 'error' ? '#f5c6cb' : '#bee5eb');
        
        if (type === 'success') {
            setTimeout(function() {
                statusSpan.style.display = 'none';
            }, 5000);
        }
    },
    
    updateLlmStatus: function(status) {
        // Keep _updateApiStatus as primary; this now only overrides color on test result
        var statusLabel = document.getElementById('llm-status');
        if (!statusLabel) return;
        var availableStr = typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('msg-llm-available') : 'Available';
        if (status === availableStr) {
            statusLabel.textContent = '● Configured';
            statusLabel.style.color = '#16a34a';
        }
        // On unavailable, fall back to normal _updateApiStatus state
        this._updateApiStatus('llm');
    },
    
    loadLlmConfig: function() {
        try {
            var provider = Zotero.Prefs.get('extensions.tidy-up.llm.provider', true) || '';
            var baseUrl = Zotero.Prefs.get('extensions.tidy-up.llm.baseUrl', true) || '';
            var algorithm = Zotero.Prefs.get('extensions.tidy-up.classification.algorithm', true) || 'vector';

            if (!provider && baseUrl) {
                provider = this._guessProviderFromBaseUrl(baseUrl, LLM_PROVIDERS);
            }
            document.getElementById('llm-provider').value = provider;
            document.getElementById('llm-base-url').value = baseUrl || '';
            var algInput = document.querySelector('input[name="alg"][value="' + (algorithm || 'vector') + '"]');
            if (algInput) algInput.checked = true;

            // onLlmProviderChange will pick up the per-provider apiKey + model and render the model select.
            this.onLlmProviderChange();

            this.log('LLM config loaded: provider=' + provider + ', algorithm=' + algorithm);
        } catch (e) {
            this.log('Error loading LLM config: ' + e.message);
        }
    },
    
    loadTestMode: function() {
        try {
            var enabled = Zotero.Prefs.get('extensions.tidy-up.testMode.enabled', true);
            var maxCollections = Zotero.Prefs.get('extensions.tidy-up.testMode.maxCollections', true);
            var mockApi = Zotero.Prefs.get('extensions.tidy-up.testMode.mockApiResponses', true);
            
            if (enabled === undefined || enabled === null) enabled = true;
            if (!maxCollections) maxCollections = 3;
            if (mockApi === undefined || mockApi === null) mockApi = false;
            
            document.getElementById('test-mode-enabled').checked = enabled;
            document.getElementById('test-mode-max-collections').value = maxCollections;
            document.getElementById('test-mode-mock-api').checked = mockApi;
            
            this.updateTestModeStatus();
            this.log('Test mode loaded: enabled=' + enabled + ', maxCollections=' + maxCollections);
        } catch (e) {
            this.log('Error loading test mode: ' + e.message);
        }
    },
    
    clearCache: function() {
        try {
            var router = this.getRuntimeRouter();
            if (router && router.embeddingsCache) {
                router.embeddingsCache.cache.clear();
                var self = this;
                router.embeddingsCache.save().then(function() {
                    self.showTestStatus((typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('msg-cache-cleared') : 'Cache cleared'), 'success');
                    self.updateCacheStatus();
                });
            } else {
                this.showTestStatus((typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('msg-cache-unavailable') : 'Cannot access cache'), 'error');
            }
        } catch (e) {
            this.showTestStatus((typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('msg-clear-failed', { msg: e.message }) : 'Clear failed: ' + e.message), 'error');
        }
    },
    
    init: function() {
        this.log('Initializing preferences');
        
        var providerEl = document.getElementById('embedding-provider');
        if (!providerEl) {
            this.log('embedding-provider not found, DOM not ready');
            return false;
        }
        
        try {
            this.loadLanguage();
            this.localizeUI();
            this._cleanupMigrationLeaks();
            this._cleanupRemovedModels();

            var provider = Zotero.Prefs.get('extensions.tidy-up.embedding.provider', true) || '';
            var baseUrl = Zotero.Prefs.get('extensions.tidy-up.embedding.baseUrl', true) || '';

            this.log('Loaded settings: provider=' + provider);

            this._populateProviderDropdown('embedding-provider-popup', EMBEDDING_PROVIDERS);
            this._populateProviderDropdown('llm-provider-popup', LLM_PROVIDERS);

            if (!provider && baseUrl) {
                provider = this._guessProviderFromBaseUrl(baseUrl, EMBEDDING_PROVIDERS);
            }
            providerEl.value = provider;
            document.getElementById('embedding-base-url').value = baseUrl || '';

            // onProviderChange will pick up per-provider apiKey + model and populate the fields.
            this.onProviderChange();
            
            this.updateCacheStatus();
            
            this.loadTestMode();
            
            this.loadMaxCollectionNum();
            
            this.loadLlmConfig();

            this._updateApiStatus('embedding');
            this._updateApiStatus('llm');
            this._updateAlgorithmWarning();

            var self = this;
            
            var btnSave = document.getElementById('btn-save');
            var btnTest = document.getElementById('btn-test');
            var btnClearCache = document.getElementById('btn-clear-cache');
            var btnRefreshCache = document.getElementById('btn-refresh-cache');
            var btnTestLlm = document.getElementById('btn-test-llm');
            var testModeEnabled = document.getElementById('test-mode-enabled');
            var testModeMaxCollections = document.getElementById('test-mode-max-collections');
            var testModeMockApi = document.getElementById('test-mode-mock-api');
            var maxCollectionNumInput = document.getElementById('max-collection-num');
            var llmProvider = document.getElementById('llm-provider');
            var llmBaseUrl = document.getElementById('llm-base-url');
            var llmApiKey = document.getElementById('llm-api-key');
            var llmModelSelect = document.getElementById('llm-model-select');
            var llmModelCustom = document.getElementById('llm-model-custom');
            var embeddingModelInput = document.getElementById('embedding-model');
            var embeddingApiKey = document.getElementById('embedding-api-key');
            
            if (btnSave) {
                btnSave.addEventListener('command', function() { self.save(); });
            }
            if (btnTest) {
                btnTest.addEventListener('command', function() { self.testConnection(); });
            }
            if (btnClearCache) {
                btnClearCache.addEventListener('command', function() { self.clearCache(); });
            }
            if (btnRefreshCache) {
                btnRefreshCache.addEventListener('command', function() { self.updateCacheStatus(); });
            }
            providerEl.addEventListener('command', function() { self.onProviderChange(); });
            
            if (testModeEnabled) {
                testModeEnabled.addEventListener('command', function() { 
                    self.saveTestMode(); 
                });
            }
            if (testModeMaxCollections) {
                testModeMaxCollections.addEventListener('change', function() { 
                    self.saveTestMode(); 
                });
            }
            if (testModeMockApi) {
                testModeMockApi.addEventListener('command', function() { 
                    self.saveTestMode(); 
                });
            }
            if (maxCollectionNumInput) {
                maxCollectionNumInput.addEventListener('change', function() { 
                    self.saveMaxCollectionNum(); 
                });
            }
            if (btnTestLlm) {
                btnTestLlm.addEventListener('command', function() { 
                    self.testLlmConnection(); 
                });
            }
            if (llmProvider) {
                llmProvider.addEventListener('command', function() {
                    // Persist current UI fields to the OLD provider's slot before switching.
                    // The provider menulist already reads the new value, but Zotero.Prefs still
                    // holds the old active provider — read it from prefs to know where to save.
                    try {
                        var oldProvider = Zotero.Prefs.get('extensions.tidy-up.llm.provider', true);
                        if (oldProvider) {
                            Zotero.Prefs.set('extensions.tidy-up.llm.' + oldProvider + '.apiKey', llmApiKey.value || '', true);
                            Zotero.Prefs.set('extensions.tidy-up.llm.' + oldProvider + '.model', self._readLlmModelFromUI() || '', true);
                        }
                    } catch (e) { self.log('save-old-provider on switch failed: ' + e.message); }
                    // Update active provider, then load the new provider's saved fields.
                    Zotero.Prefs.set('extensions.tidy-up.llm.provider', llmProvider.value, true);
                    self.onLlmProviderChange();
                });
            }
            if (llmBaseUrl) {
                llmBaseUrl.addEventListener('change', function() { 
                    self.saveLlmConfig(); 
                });
            }
            if (llmApiKey) {
                llmApiKey.addEventListener('change', function() { 
                    self.saveLlmConfig(); 
                });
            }
            if (llmModelSelect) {
                llmModelSelect.addEventListener('command', function() {
                    var customRow = document.getElementById('llm-model-custom-row');
                    if (customRow) customRow.style.display = (llmModelSelect.value === '__custom__') ? '' : 'none';
                    if (llmModelSelect.value !== '__custom__') self.saveLlmConfig();
                });
            }
            if (llmModelCustom) {
                llmModelCustom.addEventListener('change', function() { self.saveLlmConfig(); });
            }
            if (embeddingModelInput) {
                embeddingModelInput.addEventListener('change', function() {
                    self.save();
                });
            }
            if (embeddingApiKey) {
                embeddingApiKey.addEventListener('input', function() {
                    self._updateApiStatus('embedding');
                    self._updateKeyEmptyHint('embedding');
                });
            }
            if (llmApiKey) {
                llmApiKey.addEventListener('input', function() {
                    self._updateApiStatus('llm');
                    self._updateKeyEmptyHint('llm');
                    self._updateAlgorithmWarning();
                });
            }
            // No eye-toggle setup needed — Zotero/Firefox provides a native password reveal control on type=password inputs.
            // Algorithm radio change listeners
            var algRadios = document.querySelectorAll('input[name="alg"]');
            algRadios.forEach(function(radio) {
                radio.addEventListener('change', function() {
                    self.saveLlmConfig();
                    self._updateAlgorithmWarning();
                });
            });
            
            var languageSelect = document.getElementById('language-select');
            if (languageSelect) {
                languageSelect.addEventListener('command', function() {
                    self.saveLanguage();
                });
            }
            
            this.log('Init complete');
            return true;
        } catch (e) {
            this.log('Init error: ' + e.message);
            return false;
        }
    }
};

var PaperRouterPrefs = TidyUpPrefs;

PaperRouterPrefs.log('preferences.js loaded');

function initWhenReady() {
    var providerEl = document.getElementById('embedding-provider');
    if (providerEl) {
        PaperRouterPrefs.log('DOM ready, initializing...');
        PaperRouterPrefs.init();
    } else {
        PaperRouterPrefs.log('DOM not ready, waiting...');
        setTimeout(initWhenReady, 100);
    }
}

if (window) {
    window.addEventListener('load', function() {
        PaperRouterPrefs.log('window load event fired');
        initWhenReady();
    });
}

initWhenReady();
