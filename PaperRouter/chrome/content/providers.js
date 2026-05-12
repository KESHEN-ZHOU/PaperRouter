/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * PaperRouter — Zotero collection router
 * Copyright (c) Mike Zhou (Keshen Zhou) and Wight, 2026.
 *
 * Shared LLM / Embedding provider capability table + request builders + response/error parsers.
 * Loaded by bootstrap.js after l10n.js. Consumed by tidy-up.js (runtime) and preferences.js (settings test).
 */
var TidyUpProviders = (function() {
    'use strict';

    var LLM = {
        openai: {
            displayName: 'OpenAI',
            defaultBaseUrl: 'https://api.openai.com/v1',
            defaultModel: 'gpt-4.1',
            recommendedModels: [
                { name: 'gpt-4.1',      tier: 'recommended' },
                { name: 'gpt-4o-mini',  tier: 'cheaper' },
                { name: 'gpt-4.1-mini', tier: 'cheaper' },
                { name: 'gpt-5-mini',   tier: 'top' },
                { name: 'gpt-5',        tier: 'top' }
            ],
            modelClasses: [
                { match: /^gpt-5/, kind: 'reasoning_openai' },
                { match: /.*/,     kind: 'plain_openai' }
            ]
        },
        anthropic: {
            displayName: 'Claude',
            defaultBaseUrl: 'https://api.anthropic.com/v1',
            defaultModel: 'claude-3-5-sonnet-latest',
            recommendedModels: [
                { name: 'claude-3-5-sonnet-latest', tier: 'recommended' },
                { name: 'claude-3-5-haiku-latest',  tier: 'cheaper' },
                { name: 'claude-sonnet-4-6',        tier: 'top' }
            ],
            modelClasses: [
                { match: /claude-(sonnet-4|opus-4)/, kind: 'reasoning_anthropic' },
                { match: /.*/,                       kind: 'plain_anthropic' }
            ]
        },
        gemini: {
            displayName: 'Gemini',
            defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            defaultModel: 'gemini-2.5-flash-lite',
            recommendedModels: [
                { name: 'gemini-2.5-flash-lite', tier: 'recommended' },
                { name: 'gemini-2.5-flash',      tier: 'top' }
            ],
            modelClasses: [
                { match: /^gemini-2\.5/, kind: 'reasoning_gemini' },
                { match: /.*/,           kind: 'plain_gemini' }
            ]
        },
        openrouter: {
            displayName: 'OpenRouter',
            defaultBaseUrl: 'https://openrouter.ai/api/v1',
            defaultModel: 'deepseek/deepseek-v4-flash',
            // Cheap non-thinking open / Chinese models. Avoid thinking variants
            // (deepseek-r1, kimi-k2-thinking) — task is binary classification, so the
            // 20-token test budget would be eaten by reasoning tokens.
            recommendedModels: [
                { name: 'deepseek/deepseek-v4-flash',  tier: 'recommended' },
                { name: 'qwen/qwen3.6-35b-a3b',        tier: 'cheaper' },
                { name: 'minimax/minimax-m2.5',        tier: 'opensource' },
                { name: 'moonshotai/kimi-k2.5',        tier: 'top' },
                { name: 'x-ai/grok-4-fast',            tier: 'top' }
            ],
            modelClasses: [
                { match: /^openai\/gpt-5/,                       kind: 'reasoning_openai' },
                { match: /^anthropic\/claude-(sonnet-4|opus-4)/, kind: 'reasoning_anthropic' },
                { match: /.*/,                                   kind: 'plain_openai' }
            ]
        },
        cohere: {
            displayName: 'Cohere',
            defaultBaseUrl: 'https://api.cohere.ai/v1',
            defaultModel: 'command-r-plus',
            recommendedModels: [
                { name: 'command-r-plus', tier: 'recommended' },
                { name: 'command-r',      tier: 'cheaper' },
                { name: 'command-light',  tier: 'older' }
            ],
            modelClasses: [
                { match: /.*/, kind: 'plain_cohere' }
            ]
        },
        custom: {
            displayName: 'Custom (OpenAI-compatible)',
            defaultBaseUrl: '',
            defaultModel: '',
            recommendedModels: [],
            modelClasses: [
                { match: /.*/, kind: 'plain_openai' }
            ]
        }
        // Ollama (local) intentionally commented out; default flow assumes an API.
        // ollama: {
        //     displayName: 'Ollama (local)',
        //     defaultBaseUrl: 'http://localhost:11434/v1',
        //     defaultModel: 'llama3.2',
        //     recommendedModels: [
        //         { name: 'llama3.2',    tier: 'common' },
        //         { name: 'qwen2.5:14b', tier: 'common' },
        //         { name: 'mistral',     tier: 'common' }
        //     ],
        //     modelClasses: [{ match: /.*/, kind: 'plain_openai' }]
        // }
    };

    var EMBEDDING = {
        openai: {
            displayName: 'OpenAI',
            defaultBaseUrl: 'https://api.openai.com/v1',
            defaultModel: 'text-embedding-3-small',
            recommendedModels: ['text-embedding-3-small', 'text-embedding-3-large']
        },
        cohere: {
            displayName: 'Cohere',
            defaultBaseUrl: 'https://api.cohere.ai/v1',
            defaultModel: 'embed-multilingual-v3.0',
            recommendedModels: ['embed-multilingual-v3.0', 'embed-english-v3.0']
        },
        // Gemini embedding removed (text-embedding-004 deprecated). Use Custom
        // / OpenAI-compatible to reach Google embeddings via a proxy.
        custom: {
            displayName: 'Custom (OpenAI-compatible)',
            defaultBaseUrl: '',
            defaultModel: '',
            recommendedModels: []
        }
        // ollama: { displayName: 'Ollama (local)', ... }  // commented out — see LLM block above
    };

    var BUDGETS = {
        plain_openai:        { runtime: 200,  test: 20 },
        reasoning_openai:    { runtime: 4000, test: 2000 },
        plain_anthropic:     { runtime: 300,  test: 20 },
        reasoning_anthropic: { runtime: 4000, test: 2000 },
        plain_gemini:        { runtime: 200,  test: 20 },
        reasoning_gemini:    { runtime: 4000, test: 2000 },
        plain_cohere:        { runtime: 200,  test: 20 }
    };

    function _s(key, params) {
        if (typeof TidyUpL10n !== 'undefined') return TidyUpL10n.getString(key, params || {});
        return key;
    }

    // ---- Stubs (Tasks 3-9 fill these in) -------------------------------------

    function classify(provider, model) {
        var table = LLM[provider];
        if (!table) return null;
        if (typeof model !== 'string') model = '';
        for (var i = 0; i < table.modelClasses.length; i++) {
            if (table.modelClasses[i].match.test(model)) return table.modelClasses[i].kind;
        }
        return null;
    }
    function _normalizeOpenAIBaseUrl(baseUrl, provider) {
        if (!baseUrl) baseUrl = (LLM[provider] && LLM[provider].defaultBaseUrl) || '';
        if (baseUrl && baseUrl.indexOf('/v1') === -1 && provider !== 'ollama') {
            baseUrl = baseUrl.replace(/\/$/, '') + '/v1';
        }
        return baseUrl.replace(/\/$/, '');
    }

    function buildOpenAIRequest(config, prompt, isTest) {
        var kind = classify(config.provider, config.model) || 'plain_openai';
        var bucket = BUDGETS[kind] || BUDGETS.plain_openai;
        var budget = bucket[isTest ? 'test' : 'runtime'];
        var body = { model: config.model, messages: [{ role: 'user', content: prompt }] };
        if (kind === 'reasoning_openai') {
            body.max_completion_tokens = budget;
            body.reasoning_effort = 'minimal';
        } else {
            body.max_tokens = budget;
            body.temperature = 0.3;
        }
        var baseUrl = _normalizeOpenAIBaseUrl(config.baseUrl, config.provider);
        var headers = {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': 'Bearer ' + config.apiKey
        };
        if (config.provider === 'openrouter') {
            headers['HTTP-Referer'] = 'https://github.com/KESHEN-ZHOU/PaperRouter';
        }
        return { url: baseUrl + '/chat/completions', headers: headers, body: body };
    }
    function buildAnthropicRequest(config, prompt, isTest) {
        var kind = classify('anthropic', config.model) || 'plain_anthropic';
        var bucket = BUDGETS[kind] || BUDGETS.plain_anthropic;
        var budget = bucket[isTest ? 'test' : 'runtime'];
        var body = {
            model: config.model,
            max_tokens: budget,
            messages: [{ role: 'user', content: prompt }]
        };
        if (kind === 'reasoning_anthropic') {
            body.thinking = { type: 'disabled' };
        }
        var baseUrl = (config.baseUrl || LLM.anthropic.defaultBaseUrl).replace(/\/$/, '');
        return {
            url: baseUrl + '/messages',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: body
        };
    }
    function _resolveGeminiEndpoint(apiKey, customBaseUrl) {
        var DEFAULT_AI_STUDIO = 'https://generativelanguage.googleapis.com/v1beta';
        var trimmed = (customBaseUrl || '').replace(/\/$/, '');
        if (trimmed && trimmed !== DEFAULT_AI_STUDIO) {
            return trimmed;
        }
        if (apiKey && apiKey.indexOf('AQ.') === 0) {
            return 'https://aiplatform.googleapis.com/v1/publishers/google';
        }
        return DEFAULT_AI_STUDIO;
    }

    function buildGeminiRequest(config, prompt, isTest) {
        var kind = classify('gemini', config.model) || 'plain_gemini';
        var bucket = BUDGETS[kind] || BUDGETS.plain_gemini;
        var budget = bucket[isTest ? 'test' : 'runtime'];
        var endpoint = _resolveGeminiEndpoint(config.apiKey, config.baseUrl);
        var body = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: budget, temperature: 0.3 }
        };
        if (kind === 'reasoning_gemini') {
            body.generationConfig.thinkingConfig = { thinkingBudget: 0 };
        }
        var url = endpoint + '/models/' + encodeURIComponent(config.model)
                  + ':generateContent?key=' + encodeURIComponent(config.apiKey);
        return { url: url, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: body };
    }
    function buildCohereRequest(config, prompt, isTest) {
        var bucket = BUDGETS.plain_cohere;
        var budget = bucket[isTest ? 'test' : 'runtime'];
        var baseUrl = config.baseUrl || LLM.cohere.defaultBaseUrl;
        if (baseUrl.indexOf('/v1') === -1) baseUrl = baseUrl.replace(/\/$/, '') + '/v1';
        baseUrl = baseUrl.replace(/\/$/, '');
        return {
            url: baseUrl + '/chat',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': 'Bearer ' + config.apiKey
            },
            body: {
                model: config.model,
                message: prompt,
                max_tokens: budget,
                temperature: 0.3
            }
        };
    }
    function parseChatResponse(provider, kind, data) {
        try {
            if (provider === 'openai' || provider === 'openrouter' || provider === 'custom') {
                var choice = data && data.choices && data.choices[0];
                if (!choice) return { content: null, error: 'Empty response (no choices)' };
                var content = choice.message && choice.message.content;
                if (content) return { content: content, error: null };
                if (choice.finish_reason === 'length') return { content: null, error: 'empty_truncated' };
                if (choice.finish_reason) return { content: null, error: 'Empty response (finish: ' + choice.finish_reason + ')' };
                return { content: null, error: 'Empty response (no content)' };
            }
            if (provider === 'anthropic') {
                var c = data && data.content && data.content[0];
                if (!c) return { content: null, error: 'Empty response (no content block)' };
                if (c.text) return { content: c.text, error: null };
                if (data.stop_reason === 'max_tokens') return { content: null, error: 'empty_truncated' };
                if (data.stop_reason) return { content: null, error: 'Empty response (stop: ' + data.stop_reason + ')' };
                return { content: null, error: 'Empty response (no text)' };
            }
            if (provider === 'gemini') {
                if (data && data.promptFeedback && data.promptFeedback.blockReason) {
                    return { content: null, error: 'Blocked by safety: ' + data.promptFeedback.blockReason };
                }
                var cand = data && data.candidates && data.candidates[0];
                if (!cand) return { content: null, error: 'Empty response (no candidates)' };
                var parts = cand.content && cand.content.parts;
                var text = (parts && parts[0]) ? parts[0].text : null;
                if (text) return { content: text, error: null };
                if (cand.finishReason === 'MAX_TOKENS') return { content: null, error: 'empty_truncated' };
                if (cand.finishReason) return { content: null, error: 'Empty response (finish: ' + cand.finishReason + ')' };
                return { content: null, error: 'Empty response (no text)' };
            }
            if (provider === 'cohere') {
                if (data && data.text) return { content: data.text, error: null };
                return { content: null, error: 'Empty response (no text)' };
            }
        } catch (e) { /* fallthrough */ }
        return { content: null, error: 'Empty response (parse failed)' };
    }
    function parseErrorBody(provider, status, errorText) {
        if (status === 401 || status === 403) return _s('err-invalid-key');
        if (status === 429) return _s('err-rate-limited');

        var code = '';
        try {
            var j = JSON.parse(errorText);
            if (provider === 'openai' || provider === 'openrouter' || provider === 'custom') {
                if (j && j.error && j.error.code) code = String(j.error.code);
            } else if (provider === 'anthropic') {
                if (j && j.error && j.error.type) code = String(j.error.type);
            } else if (provider === 'gemini') {
                if (j && j.error && j.error.status) code = String(j.error.status);
            } else if (provider === 'cohere') {
                if (j && j.message) code = String(j.message).substring(0, 30);
            }
        } catch (_) {}

        if (code === 'model_not_found' || code === 'not_found_error' || code === 'NOT_FOUND') {
            return _s('err-model-unavailable');
        }
        if (code === 'invalid_api_key' || code === 'authentication_error' || code === 'UNAUTHENTICATED') {
            return _s('err-invalid-key');
        }
        if (status === 404) return _s('err-model-unavailable');

        var base = _s('err-http-generic', { status: status });
        return code ? (base + ' (' + code + ')') : base;
    }

    return {
        LLM_PROVIDERS:         LLM,
        EMBEDDING_PROVIDERS:   EMBEDDING,
        classify:              classify,
        buildOpenAIRequest:    buildOpenAIRequest,
        buildAnthropicRequest: buildAnthropicRequest,
        buildGeminiRequest:    buildGeminiRequest,
        buildCohereRequest:    buildCohereRequest,
        parseChatResponse:     parseChatResponse,
        parseErrorBody:        parseErrorBody
    };
})();
