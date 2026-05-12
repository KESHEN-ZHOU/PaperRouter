/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * PaperRouter — Zotero collection router
 * Copyright (c) Mike Zhou (Keshen Zhou)
 * Copyright (c) Wight
 * 2026 PaperRouter rewrite based on the original Tidy Up plugin.
 */
/**
 * PaperRouter localization module
 * Supports en-US, zh-CN, zh-TW
 * User can select language in preferences
 */
var TidyUpL10n = (function() {
    'use strict';

    const PREF_LANGUAGE = 'extensions.tidy-up.language';
    const DEFAULT_LANG = 'zh-CN'; // Default Simplified Chinese
    let _forcedLanguage = null;  // Forced language for current window (e.g. passed via dialog args)

    /** Set forced language for current context (used when dialog passes via window.arguments) */
    function setForcedLanguage(lang) { _forcedLanguage = lang || null; }

    /** Resolve Zotero object (child windows like dialog may need to get from opener) */
    function getZotero() {
        try {
            if (typeof Zotero !== 'undefined' && Zotero.Prefs) return Zotero;
            if (typeof window !== 'undefined') {
                if (window.Zotero && window.Zotero.Prefs) return window.Zotero;
                if (window.opener && window.opener.Zotero && window.opener.Zotero.Prefs) return window.opener.Zotero;
                if (window.parent && window.parent !== window && window.parent.Zotero && window.parent.Zotero.Prefs) return window.parent.Zotero;
            }
        } catch (e) {}
        return null;
    }

    const STRINGS = {
        'en-US': {
            // Language options
            'language': 'Language',
            'language-auto': 'Auto (follow system)',
            'language-en-US': 'English',
            'language-zh-CN': '简体中文',
            'language-zh-TW': '繁體中文',

            'prefs-language-desc': 'Choose the UI language. Reopen this preferences page for changes to take effect.',
            'prefs-language-label': 'Language:',

            // Context menu
            'menu-send-to-collections': 'Send to Collections...',

            // Preferences - API
            'prefs-api-settings': 'API Settings',
            'prefs-api-intro': 'Configure Embedding API (for vector similarity) and LLM API (for zero-shot classification). They can be configured independently.',
            'prefs-embedding': 'Embedding API',
            'prefs-embedding-desc': 'Configure embedding API for better collection matching. If not configured, local algorithm will be used.',
            'prefs-provider': 'Provider:',
            'prefs-none': 'None (use local algorithm)',
            'prefs-base-api': 'Base API:',
            'prefs-base-api-placeholder': 'Auto-filled when you pick a provider',
            'prefs-api-key': 'API Key:',
            'prefs-api-key-placeholder': 'Enter API Key',
            'prefs-model': 'Model:',
            'prefs-model-placeholder': 'Enter a model name or pick a recommendation',
            'prefs-llm': 'LLM API',
            'prefs-llm-desc': 'Use LLM API for zero-shot classification and collection type detection.',
            'prefs-algorithm': 'Classification:',
            'prefs-alg-vector': 'Vector',
            'prefs-alg-vector-hint': '(local cosine similarity, no API needed)',
            'prefs-alg-zeroshot': 'Zero-shot',
            'prefs-alg-zeroshot-hint': '(LLM semantic understanding, requires LLM API)',
            'prefs-alg-warning': 'Zero-shot selected but LLM API is not configured — configure it in the LLM API section below.',
            'prefs-llm-provider': 'LLM Provider:',
            'prefs-no-llm': 'Do not use LLM',
            'prefs-status-configured': '● Configured',
            'prefs-status-not-configured': '○ Not configured',
            'prefs-hint-ollama': 'Requires Ollama running locally (default: http://localhost:11434/v1)',
            'prefs-hint-openrouter': 'Model names follow vendor/model-id format (e.g., anthropic/claude-3.5-sonnet)',
            'prefs-hint-custom': 'Any OpenAI-compatible /v1/chat/completions endpoint',
            'prefs-model-tier-recommended': '★ Recommended',
            'prefs-model-tier-cheaper': 'Cheaper / faster',
            'prefs-model-tier-top': 'Top tier',
            'prefs-model-tier-reasoning': 'Reasoning',
            'prefs-model-tier-older': 'Older / stable',
            'prefs-model-tier-opensource': 'Open source',
            'prefs-model-tier-common': 'Common (local — depends on what you have pulled)',
            'prefs-model-custom-option': 'Custom (type your own)…',
            'prefs-model-custom-label': 'Custom name:',
            'prefs-model-custom-placeholder': 'Type any model name supported by your provider',
            'prefs-eye-show': 'Show key',
            'prefs-eye-hide': 'Hide key',
            'prefs-key-empty-hint': 'No saved key for this provider — enter one and it will be remembered.',
            'prefs-btn-test-llm': 'Test LLM API',
            'prefs-btn-save': 'Save',
            'prefs-btn-test': 'Test Connection',
            'prefs-btn-clear-cache': 'Clear Embedding Cache',
            'prefs-cached-count': 'Cached embeddings:',
            'prefs-btn-refresh': 'Refresh',
            'prefs-test-mode': 'Test Mode (Debug)',
            'prefs-test-mode-desc': 'In test mode only a few collections are processed for quick verification. Disable for production use.',
            'prefs-test-mode-enable': 'Enable test mode',
            'prefs-test-mode-warning': '⚠ Test mode',
            'prefs-normal-mode': '✓ Normal mode',
            'prefs-max-process': 'Max collections:',
            'prefs-collections-unit': 'collections',
            'prefs-mock-api': 'Use mock responses (offline test)',
            'prefs-collection-limit': 'Collection Limit',
            'prefs-collection-limit-desc': 'Maximum collections per item. Recommendations will not exceed this limit.',
            'prefs-max-collections': 'Max collections:',
            'prefs-max-collections-unit': '',
            'prefs-max-collections-hint': 'Recommended limit: {count} collections',

            // Preferences - status messages
            'msg-settings-saved': 'Settings saved',
            'msg-save-failed': 'Save failed: {msg}',
            'msg-select-provider': 'Please select a provider',
            'msg-enter-api-key': 'Please enter API Key',
            'msg-enter-base-api': 'Please enter Base API',
            'msg-testing': 'Testing...',
            'msg-connect-ok':         '✓ Connected',
            'msg-llm-connect-ok':     '✓ Connected · {model}',
            'msg-connect-fail':       '✗ Connection failed',
            'err-invalid-key':        '✗ Invalid API key',
            'err-model-unavailable':  '✗ Model unavailable',
            'err-rate-limited':       '✗ Rate limited',
            'err-empty-budget':       '✗ Empty (raise budget)',
            'err-network':            '✗ Network error',
            'err-http-generic':       '✗ HTTP {status}',
            'msg-cache-cleared': 'Cache cleared',
            'msg-cache-unavailable': 'Cannot access cache',
            'msg-clear-failed': 'Clear failed: {msg}',
            'msg-llm-available': 'Available',
            'msg-llm-unavailable': 'Unavailable',

            // Dialog
            'dialog-title': 'Select Collections',
            'dialog-select-prompt': 'Select collections to include:',
            'dialog-select-all': 'Select All',
            'dialog-deselect-all': 'Deselect All',
            'dialog-expand-all': 'Expand All',
            'dialog-collapse-all': 'Collapse All',
            'dialog-retry': 'Retry',
            'dialog-threshold': 'Thrd.:',
            'dialog-search-label': 'Quick search:',
            'dialog-search-placeholder': 'Search...',
            'dialog-search-btn': 'Search',
            'dialog-clear-btn': 'Clear',
            'dialog-tips': 'Tips:',
            'dialog-ok': 'OK',
            'dialog-cancel': 'Cancel',

            // Dialog - messages
            'dialog-error-no-args': 'Error: No arguments passed',
            'dialog-selected-item': 'Selected Item:',
            'dialog-no-collections': 'No collections found',
            'dialog-recalculating': 'Recalculating...',
            'dialog-error': 'Error: {msg}',
            'dialog-tip-limit-reached': 'Collection limit reached ({max}), cannot add more. Please deselect some existing collections first.',
            'dialog-tip-has-existing': 'Already in {existing} collections, can add {allowed} more.',
            'dialog-tip-max-select': 'You can select up to {max} collections.',
            'dialog-search-found': 'Found {count} matches',
            'dialog-search-not-found': 'No matches found',
            'dialog-conf-label': 'Conf:',
            'dialog-type-external': '[External]',
            'dialog-type-internal': '[Internal]',
            'dialog-hide-zero': 'Hide Conf=0',
            'dialog-legend-existing': 'Already in collection',
            'dialog-legend-blacklisted': 'Blacklisted',

            // Notifications
            'notif-load-success': 'Plugin loaded successfully',
            'notif-queue-start': 'Background task started',
            'notif-cache-count': 'Cache: {count} collections',
            'notif-pending-count': 'Pending: {count}',
            'notif-updated-count': 'Updated: {count}',
            'notif-api-status': 'API: {success}/{total} succeeded',
            'notif-api-all-ok': 'All {count} API calls succeeded',
            'notif-api-error': 'Error: {msg}'
        },
        'zh-CN': {
            'language': '语言',
            'language-auto': '自动（跟随系统）',
            'language-en-US': 'English',
            'language-zh-CN': '简体中文',
            'language-zh-TW': '繁體中文',

            'prefs-language-desc': '选择界面显示语言。更改后请重新打开本设置页以生效。',
            'prefs-language-label': '界面语言:',

            'menu-send-to-collections': '发送到分类...',

            'prefs-api-settings': 'API 设置',
            'prefs-api-intro': '这里包含两部分：嵌入向量 API（用于向量相似度）与大模型 API（用于零样本分类/Collection 类型判断）。两者可独立配置。',
            'prefs-embedding': '嵌入向量 API（Embedding）',
            'prefs-embedding-desc': '配置嵌入向量 API 以提高 Collection 匹配精度。如不配置，将使用本地算法。',
            'prefs-provider': '提供商:',
            'prefs-none': '无 (使用本地算法)',
            'prefs-base-api': 'Base API:',
            'prefs-base-api-placeholder': '选择提供商后自动填充',
            'prefs-api-key': 'API Key:',
            'prefs-api-key-placeholder': '输入 API Key',
            'prefs-model': '模型:',
            'prefs-model-placeholder': '输入模型名，或从推荐列表选择',
            'prefs-llm': '大模型 API（LLM）',
            'prefs-llm-desc': '使用大模型 API 支持"零样本分类"与 Collection 类型判断，从而提高分类准确性。',
            'prefs-algorithm': '分类算法:',
            'prefs-alg-vector': '向量夹角',
            'prefs-alg-vector-hint': '（本地余弦相似度，无需 API）',
            'prefs-alg-zeroshot': '零样本分类',
            'prefs-alg-zeroshot-hint': '（大模型语义理解，需要 LLM API）',
            'prefs-alg-warning': '已选零样本分类，但尚未配置大模型 API —— 请在下方 LLM API 段完成配置。',
            'prefs-llm-provider': '大模型提供商:',
            'prefs-no-llm': '不使用大模型分类',
            'prefs-status-configured': '● 已配置',
            'prefs-status-not-configured': '○ 未配置',
            'prefs-hint-ollama': '需要本地运行 Ollama（默认 http://localhost:11434/v1）',
            'prefs-hint-openrouter': '模型名使用 vendor/model-id 格式（如 anthropic/claude-3.5-sonnet）',
            'prefs-hint-custom': '任意兼容 OpenAI 的 /v1/chat/completions 端点',
            'prefs-model-tier-recommended': '★ 推荐',
            'prefs-model-tier-cheaper': '经济 / 更快',
            'prefs-model-tier-top': '顶级',
            'prefs-model-tier-reasoning': '推理',
            'prefs-model-tier-older': '旧版 / 稳定',
            'prefs-model-tier-opensource': '开源',
            'prefs-model-tier-common': '常用（本地 — 取决于已 pull 的模型）',
            'prefs-model-custom-option': '自定义（手动输入）…',
            'prefs-model-custom-label': '自定义名称:',
            'prefs-model-custom-placeholder': '输入该 provider 支持的任意模型名',
            'prefs-eye-show': '显示密钥',
            'prefs-eye-hide': '隐藏密钥',
            'prefs-key-empty-hint': '该 provider 还没保存过 API Key — 输入后会自动记住。',
            'prefs-btn-test-llm': '测试大模型API',
            'prefs-btn-save': '保存设置',
            'prefs-btn-test': '测试连接',
            'prefs-btn-clear-cache': '清除嵌入缓存',
            'prefs-cached-count': '已缓存嵌入向量:',
            'prefs-btn-refresh': '刷新',
            'prefs-test-mode': '测试模式 (开发调试)',
            'prefs-test-mode-desc': '测试模式下只处理少量 Collection，便于快速验证功能。正式使用时请关闭。',
            'prefs-test-mode-enable': '启用测试模式',
            'prefs-test-mode-warning': '⚠ 测试模式',
            'prefs-normal-mode': '✓ 正常模式',
            'prefs-max-process': '最大处理数量:',
            'prefs-collections-unit': '个 Collection',
            'prefs-mock-api': '使用模拟响应 (离线测试)',
            'prefs-collection-limit': 'Collection 数量限制',
            'prefs-collection-limit-desc': '设置每个 Item 最多可以拥有的 Collection 数量。推荐时不会超过此限制。',
            'prefs-max-collections': '最大 Collection 数量:',
            'prefs-max-collections-unit': '个',
            'prefs-max-collections-hint': '推荐时最多选择 {count} 个 Collection',

            'msg-settings-saved': '设置已保存',
            'msg-save-failed': '保存失败: {msg}',
            'msg-select-provider': '请先选择提供商',
            'msg-enter-api-key': '请先输入 API Key',
            'msg-enter-base-api': '请先输入 Base API',
            'msg-testing': '测试中...',
            'msg-connect-ok':         '✓ 已连接',
            'msg-llm-connect-ok':     '✓ 已连接 · {model}',
            'msg-connect-fail':       '✗ 连接失败',
            'err-invalid-key':        '✗ API Key 无效',
            'err-model-unavailable':  '✗ 模型不可用',
            'err-rate-limited':       '✗ 已被限流',
            'err-empty-budget':       '✗ 空响应（提高预算）',
            'err-network':            '✗ 网络错误',
            'err-http-generic':       '✗ HTTP {status}',
            'msg-cache-cleared': '缓存已清除',
            'msg-cache-unavailable': '无法访问缓存',
            'msg-clear-failed': '清除失败: {msg}',
            'msg-llm-available': '可用',
            'msg-llm-unavailable': '不可用',

            'dialog-title': '选择 Collection',
            'dialog-select-prompt': '选择要加入的 Collection:',
            'dialog-select-all': '全选',
            'dialog-deselect-all': '取消全选',
            'dialog-expand-all': '全部展开',
            'dialog-collapse-all': '全部折叠',
            'dialog-retry': '重新计算',
            'dialog-threshold': '阈值:',
            'dialog-search-label': '快速定位:',
            'dialog-search-placeholder': '输入关键词搜索...',
            'dialog-search-btn': '确定',
            'dialog-clear-btn': '清空',
            'dialog-tips': 'Tips:',
            'dialog-ok': '确定',
            'dialog-cancel': '取消',

            'dialog-error-no-args': '错误: 未传递参数',
            'dialog-selected-item': '已选文献:',
            'dialog-no-collections': '未找到 Collection',
            'dialog-recalculating': '重新计算中...',
            'dialog-error': '错误: {msg}',
            'dialog-tip-limit-reached': '已达到 Collection 上限 ({max} 个)，无法添加新 Collection。请先取消选择已有的 Collection。',
            'dialog-tip-has-existing': '已有 {existing} 个 Collection，还可添加 {allowed} 个新 Collection。',
            'dialog-tip-max-select': '最多可选择 {max} 个 Collection。',
            'dialog-search-found': '找到 {count} 个匹配项',
            'dialog-search-not-found': '未找到匹配项',
            'dialog-conf-label': '置信度:',
            'dialog-type-external': '[外在描述]',
            'dialog-type-internal': '[内在含义]',
            'dialog-hide-zero': '隐藏 Conf=0',
            'dialog-legend-existing': '已在此 Collection',
            'dialog-legend-blacklisted': '已屏蔽',

            'notif-load-success': '插件加载成功',
            'notif-queue-start': '后台任务开始',
            'notif-cache-count': '缓存: {count} 个 Collection',
            'notif-pending-count': '待更新队列: {count} 个',
            'notif-updated-count': '本次已更新: {count} 个',
            'notif-api-status': 'API调用: {success}/{total} 成功',
            'notif-api-all-ok': '{count} 条API调用皆成功',
            'notif-api-error': '错误: {msg}'
        },
        'zh-TW': {
            'language': '語言',
            'language-auto': '自動（跟隨系統）',
            'language-en-US': 'English',
            'language-zh-CN': '简体中文',
            'language-zh-TW': '繁體中文',

            'prefs-language-desc': '選擇介面顯示語言。變更後請重新開啟本設定頁以生效。',
            'prefs-language-label': '介面語言:',

            'menu-send-to-collections': '發送到分類...',

            'prefs-api-settings': 'API 設定',
            'prefs-api-intro': '這裡包含兩部分：嵌入向量 API（用於向量相似度）與大模型 API（用於零樣本分類/Collection 類型判斷）。兩者可獨立設定。',
            'prefs-embedding': '嵌入向量 API（Embedding）',
            'prefs-embedding-desc': '設定嵌入向量 API 以提高 Collection 匹配精度。如不設定，將使用本地演算法。',
            'prefs-provider': '提供商:',
            'prefs-none': '無 (使用本地演算法)',
            'prefs-base-api': 'Base API:',
            'prefs-base-api-placeholder': '選擇提供商後自動填入',
            'prefs-api-key': 'API Key:',
            'prefs-api-key-placeholder': '輸入 API Key',
            'prefs-model': '模型:',
            'prefs-model-placeholder': '輸入模型名，或從推薦清單選擇',
            'prefs-llm': '大模型 API（LLM）',
            'prefs-llm-desc': '使用大模型 API 支援「零樣本分類」與 Collection 類型判斷，從而提高分類準確性。',
            'prefs-algorithm': '分類演算法:',
            'prefs-alg-vector': '向量夾角',
            'prefs-alg-vector-hint': '（本地餘弦相似度，無需 API）',
            'prefs-alg-zeroshot': '零樣本分類',
            'prefs-alg-zeroshot-hint': '（大模型語意理解，需要 LLM API）',
            'prefs-alg-warning': '已選零樣本分類，但尚未設定大模型 API —— 請在下方 LLM API 段完成設定。',
            'prefs-llm-provider': '大模型提供商:',
            'prefs-no-llm': '不使用大模型分類',
            'prefs-status-configured': '● 已設定',
            'prefs-status-not-configured': '○ 未設定',
            'prefs-hint-ollama': '需要本機執行 Ollama（預設 http://localhost:11434/v1）',
            'prefs-hint-openrouter': '模型名使用 vendor/model-id 格式（如 anthropic/claude-3.5-sonnet）',
            'prefs-hint-custom': '任意相容 OpenAI 的 /v1/chat/completions 端點',
            'prefs-model-tier-recommended': '★ 推薦',
            'prefs-model-tier-cheaper': '經濟 / 更快',
            'prefs-model-tier-top': '頂級',
            'prefs-model-tier-reasoning': '推理',
            'prefs-model-tier-older': '舊版 / 穩定',
            'prefs-model-tier-opensource': '開源',
            'prefs-model-tier-common': '常用（本機 — 取決於已 pull 的模型）',
            'prefs-model-custom-option': '自訂（手動輸入）…',
            'prefs-model-custom-label': '自訂名稱:',
            'prefs-model-custom-placeholder': '輸入該 provider 支援的任意模型名',
            'prefs-eye-show': '顯示金鑰',
            'prefs-eye-hide': '隱藏金鑰',
            'prefs-key-empty-hint': '該 provider 還沒儲存過 API Key — 輸入後會自動記住。',
            'prefs-btn-test-llm': '測試大模型API',
            'prefs-btn-save': '儲存設定',
            'prefs-btn-test': '測試連線',
            'prefs-btn-clear-cache': '清除嵌入快取',
            'prefs-cached-count': '已快取嵌入向量:',
            'prefs-btn-refresh': '重新整理',
            'prefs-test-mode': '測試模式 (開發除錯)',
            'prefs-test-mode-desc': '測試模式下只處理少量 Collection，便於快速驗證功能。正式使用時請關閉。',
            'prefs-test-mode-enable': '啟用測試模式',
            'prefs-test-mode-warning': '⚠ 測試模式',
            'prefs-normal-mode': '✓ 正常模式',
            'prefs-max-process': '最大處理數量:',
            'prefs-collections-unit': '個 Collection',
            'prefs-mock-api': '使用模擬回應 (離線測試)',
            'prefs-collection-limit': 'Collection 數量限制',
            'prefs-collection-limit-desc': '設定每個 Item 最多可擁有的 Collection 數量。推薦時不會超過此限制。',
            'prefs-max-collections': '最大 Collection 數量:',
            'prefs-max-collections-unit': '個',
            'prefs-max-collections-hint': '推薦時最多選擇 {count} 個 Collection',

            'msg-settings-saved': '設定已儲存',
            'msg-save-failed': '儲存失敗: {msg}',
            'msg-select-provider': '請先選擇提供商',
            'msg-enter-api-key': '請先輸入 API Key',
            'msg-enter-base-api': '請先輸入 Base API',
            'msg-testing': '測試中...',
            'msg-connect-ok':         '✓ 已連線',
            'msg-llm-connect-ok':     '✓ 已連線 · {model}',
            'msg-connect-fail':       '✗ 連線失敗',
            'err-invalid-key':        '✗ API Key 無效',
            'err-model-unavailable':  '✗ 模型不可用',
            'err-rate-limited':       '✗ 已被限流',
            'err-empty-budget':       '✗ 空回應（提高預算）',
            'err-network':            '✗ 網路錯誤',
            'err-http-generic':       '✗ HTTP {status}',
            'msg-cache-cleared': '快取已清除',
            'msg-cache-unavailable': '無法存取快取',
            'msg-clear-failed': '清除失敗: {msg}',
            'msg-llm-available': '可用',
            'msg-llm-unavailable': '不可用',

            'dialog-title': '選擇 Collection',
            'dialog-select-prompt': '選擇要加入的 Collection:',
            'dialog-select-all': '全選',
            'dialog-deselect-all': '取消全選',
            'dialog-expand-all': '全部展開',
            'dialog-collapse-all': '全部摺疊',
            'dialog-retry': '重新計算',
            'dialog-threshold': '閾值:',
            'dialog-search-label': '快速定位:',
            'dialog-search-placeholder': '輸入關鍵詞搜尋...',
            'dialog-search-btn': '確定',
            'dialog-clear-btn': '清空',
            'dialog-tips': 'Tips:',
            'dialog-ok': '確定',
            'dialog-cancel': '取消',

            'dialog-error-no-args': '錯誤: 未傳遞參數',
            'dialog-selected-item': '已選文獻:',
            'dialog-no-collections': '未找到 Collection',
            'dialog-recalculating': '重新計算中...',
            'dialog-error': '錯誤: {msg}',
            'dialog-tip-limit-reached': '已達到 Collection 上限 ({max} 個)，無法新增 Collection。請先取消選擇已有的 Collection。',
            'dialog-tip-has-existing': '已有 {existing} 個 Collection，還可新增 {allowed} 個新 Collection。',
            'dialog-tip-max-select': '最多可選擇 {max} 個 Collection。',
            'dialog-search-found': '找到 {count} 個符合項目',
            'dialog-search-not-found': '未找到符合項目',
            'dialog-conf-label': '置信度:',
            'dialog-type-external': '[外在描述]',
            'dialog-type-internal': '[內在含義]',
            'dialog-hide-zero': '隱藏 Conf=0',
            'dialog-legend-existing': '已在此 Collection',
            'dialog-legend-blacklisted': '已遮蔽',

            'notif-load-success': '插件載入成功',
            'notif-queue-start': '背景任務開始',
            'notif-cache-count': '快取: {count} 個 Collection',
            'notif-pending-count': '待更新佇列: {count} 個',
            'notif-updated-count': '本次已更新: {count} 個',
            'notif-api-status': 'API呼叫: {success}/{total} 成功',
            'notif-api-all-ok': '{count} 條API呼叫皆成功',
            'notif-api-error': '錯誤: {msg}'
        }
    };

    function getEffectiveLanguage() {
        try {
            if (_forcedLanguage) return _forcedLanguage;
            const Z = getZotero();
            let lang = 'auto';
            if (Z && Z.Prefs && Z.Prefs.get) {
                lang = Z.Prefs.get(PREF_LANGUAGE, true);
            }
            if (!lang || lang === 'auto') {
                if (Z && Z.locale) {
                    const z = Z.locale;
                    if (z && z.startsWith('zh')) return (z.includes('TW') || z.includes('HK')) ? 'zh-TW' : 'zh-CN';
                    if (z && z.startsWith('en')) return 'en-US';
                }
                return DEFAULT_LANG;
            }
            return lang;
        } catch (e) {
            return DEFAULT_LANG;
        }
    }

    function getString(key, params) {
        const lang = getEffectiveLanguage();
        const dict = STRINGS[lang] || STRINGS['zh-CN'];
        let str = dict[key] || STRINGS['en-US'][key] || STRINGS['zh-CN'][key] || key;
        if (params) {
            for (const k in params) {
                str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]);
            }
        }
        return str;
    }

    function getLanguage() {
        try {
            const Z = getZotero();
            if (Z && Z.Prefs && Z.Prefs.get) {
                return Z.Prefs.get(PREF_LANGUAGE, true) || 'auto';
            }
        } catch (e) {}
        return 'auto';
    }

    function setLanguage(lang) {
        try {
            const Z = getZotero();
            if (Z && Z.Prefs && Z.Prefs.set) {
                Z.Prefs.set(PREF_LANGUAGE, lang, true);
                return true;
            }
        } catch (e) {}
        return false;
    }

    return {
        getString: getString,
        getLanguage: getLanguage,
        setLanguage: setLanguage,
        setForcedLanguage: setForcedLanguage,
        getEffectiveLanguage: getEffectiveLanguage,
        PREF_LANGUAGE: PREF_LANGUAGE
    };
})();

var PaperRouterL10n = TidyUpL10n;
