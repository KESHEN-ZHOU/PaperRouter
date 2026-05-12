/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * PaperRouter — Smart Zotero collection router
 * Copyright (c) Mike Zhou (Keshen Zhou)
 * Copyright (c) Wight
 * 2026 PaperRouter rewrite based on the original Tidy Up plugin.
 */

// Mirror of preferences.js (until extracted to chrome/content/providers.js).
// Runtime only reads `defaultBaseUrl` / `defaultModel` here — `recommendedModels` is just listed for parity.
var LLM_PROVIDERS = {
	openai:     { displayName: 'OpenAI',                     defaultBaseUrl: 'https://api.openai.com/v1',                         defaultModel: 'gpt-4.1' },
	anthropic:  { displayName: 'Claude',                     defaultBaseUrl: 'https://api.anthropic.com/v1',                      defaultModel: 'claude-3-5-sonnet-latest' },
	gemini:     { displayName: 'Gemini',                     defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-2.0-flash' },
	openrouter: { displayName: 'OpenRouter',                 defaultBaseUrl: 'https://openrouter.ai/api/v1',                      defaultModel: 'anthropic/claude-3.5-sonnet' },
	ollama:     { displayName: 'Ollama (local)',             defaultBaseUrl: 'http://localhost:11434/v1',                         defaultModel: 'llama3.2' },
	custom:     { displayName: 'Custom (OpenAI-compatible)', defaultBaseUrl: '',                                                  defaultModel: '' }
};

var EMBEDDING_PROVIDERS = {
	openai:     { displayName: 'OpenAI',                     defaultBaseUrl: 'https://api.openai.com/v1',                         defaultModel: 'text-embedding-3-small',   recommendedModels: ['text-embedding-3-small', 'text-embedding-3-large'] },
	cohere:     { displayName: 'Cohere',                     defaultBaseUrl: 'https://api.cohere.ai/v1',                          defaultModel: 'embed-multilingual-v3.0',  recommendedModels: ['embed-multilingual-v3.0', 'embed-english-v3.0'] },
	gemini:     { displayName: 'Gemini',                     defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'text-embedding-004',       recommendedModels: ['text-embedding-004'] },
	ollama:     { displayName: 'Ollama (local)',             defaultBaseUrl: 'http://localhost:11434/v1',                         defaultModel: 'nomic-embed-text',         recommendedModels: ['nomic-embed-text', 'mxbai-embed-large'] },
	custom:     { displayName: 'Custom (OpenAI-compatible)', defaultBaseUrl: '',                                                  defaultModel: '',                         recommendedModels: [] }
};

TidyUp = {
	id: null,
	version: null,
	rootURI: null,
	initialized: false,
	addedElementIDs: [],
	menuID: null,
	dialogOpen: false,  // Prevent opening dialog repeatedly

	// Test mode config (for development)
	testMode: {
		enabled: true,              // Enable test mode
		maxCollections: 3,          // Max Collections to process
		logApiCalls: true,          // Log API call details
		mockApiResponses: false,    // Use mock responses (offline test)
		mockEmbedding: null         // Mock response data (lazy init)
	},

	// Collection count limit config
	maxCollectionNum: 4,  // Max Collections per Item

	// Collection embedding source config
	embeddingSourceConfig: {
		includeCollectionName: true,    // Include Collection name
		includeItemTitles: true,        // Include Item titles
		includeItemAbstracts: true,     // Include Item abstracts
		maxItems: 10,                   // Max Item count
		maxAbstractLength: 100,         // Max abstract length (chars)
		maxTotalLength: 8000            // Max total text length (avoid API limit)
	},
	
	// LLM API config
	llmConfig: {
		provider: null,
		model: null,
		baseUrl: null,
		apiKey: null
	},
	
	// Classification algorithm config
	classificationConfig: {
		algorithm: 'vector' // vector: vector angle algorithm, zeroshot: LLM zero-shot classification
	},

	// Collection type cache
	collectionTypeCache: {
		cache: new Map(),
		initialized: false,
		filePath: null,

		// Get cache size
		get size() {
			return this.cache.size;
		},

		// Initialize
		async init(rootURI) {
			if (this.initialized) return;

			try {
				// Set cache file path (PathUtils.join for Mac/Windows compatibility)
				this.filePath = PathUtils.join(Zotero.Profile.dir, 'tidyup-collection-type-cache.json');

				TidyUp.log(`Collection type cache file path: ${this.filePath}`);

				// Load cache
				await this.load();

				this.initialized = true;
				TidyUp.log(`Collection type cache initialized with ${this.cache.size} collections`);
			} catch (e) {
				TidyUp.log(`Error initializing collection type cache: ${e.message}`);
			}
		},

		// Load cache
		async load() {
			try {
				const fileExists = await IOUtils.exists(this.filePath);
				if (!fileExists) {
					TidyUp.log('No existing collection type cache file found');
					return;
				}

				const content = await IOUtils.readUTF8(this.filePath);
				const data = JSON.parse(content);
				this.cache = new Map(Object.entries(data));
				TidyUp.log(`Loaded collection type cache: ${this.cache.size} entries`);
			} catch (e) {
				TidyUp.log(`Error loading collection type cache: ${e.message}`);
			}
		},

		// Save cache
		async save() {
			try {
				const data = JSON.stringify(Object.fromEntries(this.cache));
				await IOUtils.writeUTF8(this.filePath, data);
				TidyUp.log(`Saved collection type cache: ${this.cache.size} entries`);
			} catch (e) {
				TidyUp.log(`Error saving collection type cache: ${e.message}`);
			}
		},

		// Get Collection type
		get(collectionId) {
			return this.cache.get(collectionId);
		},

		// Set Collection type
		set(collectionId, type) {
			this.cache.set(collectionId, type);
		},

		// Clear cache
		clear() {
			this.cache.clear();
		}
	},

	// Embedding cache management
	embeddingsCache: {
		model: null,
		dimensions: 0,
		cache: new Map(),
		itemCache: new Map(),
		filePath: null,
		initialized: false,
		
		// Get cache size
		get size() {
			return this.cache.size;
		},
		
		// Get Item cache size
		get itemCacheSize() {
			return this.itemCache.size;
		},
		
		// Initialize cache
		async init(rootURI) {
			if (this.initialized) return;
			
			// Set cache file path (PathUtils.join for Mac/Windows compatibility)
			this.filePath = PathUtils.join(Zotero.Profile.dir, 'tidy-up-embeddings.json');
			
			TidyUp.log(`Cache file path: ${this.filePath}`);
			
			// Try to load cache from file
			await this.load();
			this.initialized = true;
			TidyUp.log(`Embeddings cache initialized with ${this.cache.size} collections, ${this.itemCache.size} items`);
		},
		
		// Load cache from JSON file
		async load() {
			try {
				// Check if file exists
				const fileExists = await IOUtils.exists(this.filePath);
				if (!fileExists) {
					TidyUp.log('No existing embeddings cache file found');
					return;
				}
				
				const content = await IOUtils.readUTF8(this.filePath);
				const data = JSON.parse(content);
				
				this.model = data.model || null;
				this.dimensions = data.dimensions || 0;
				
				// Convert array back to Map (Collection cache)
				if (data.collections) {
					for (const [key, value] of Object.entries(data.collections)) {
						// Convert array back to Float32Array
						if (value.embedding && Array.isArray(value.embedding)) {
							value.embedding = new Float32Array(value.embedding);
						}
						this.cache.set(key, value);
					}
				}
				
				// Load Item cache
				if (data.items) {
					for (const [textHash, value] of Object.entries(data.items)) {
						if (value.embedding && Array.isArray(value.embedding)) {
							value.embedding = new Float32Array(value.embedding);
						}
						this.itemCache.set(textHash, value);
					}
				}
				
				TidyUp.log(`Loaded ${this.cache.size} collections, ${this.itemCache.size} items from cache file`);
			} catch (e) {
				TidyUp.log(`Error loading embeddings cache: ${e.message}`);
			}
		},
		
		// Save cache to JSON file
		async save() {
			try {
				// Convert Map to serializable object (Collection cache)
				const collections = {};
				for (const [key, value] of this.cache) {
					// Float32Array to array for JSON serialization
					collections[key] = {
						id: value.id,
						name: value.name,
						embedding: value.embedding ? Array.from(value.embedding) : null,
						itemFingerprint: value.itemFingerprint || null,
						itemCount: value.itemCount || 0,
						updatedAt: value.updatedAt
					};
				}
				
				// Convert Item cache to serializable object
				const items = {};
				for (const [textHash, value] of this.itemCache) {
					items[textHash] = {
						text: value.text,
						embedding: value.embedding ? Array.from(value.embedding) : null,
						updatedAt: value.updatedAt
					};
				}
				
				const data = {
					version: 1,
					model: this.model,
					dimensions: this.dimensions,
					collections: collections,
					items: items,
					savedAt: new Date().toISOString()
				};
				
				const jsonStr = JSON.stringify(data, null, 2);
				
				// Write file using IOUtils
				await IOUtils.writeUTF8(this.filePath, jsonStr);
				
				TidyUp.log(`Saved ${this.cache.size} collections, ${this.itemCache.size} items to cache file`);
			} catch (e) {
				TidyUp.log(`Error saving embeddings cache: ${e.message}`);
			}
		},
		
		// Get Collection embedding
		get(collectionKey) {
			return this.cache.get(collectionKey);
		},
		
		// Set Collection embedding
		set(collectionKey, data) {
			this.cache.set(collectionKey, {
				id: data.id,
				name: data.name,
				embedding: data.embedding,
				itemFingerprint: data.itemFingerprint || null,
				itemCount: data.itemCount || 0,
				updatedAt: new Date().toISOString()
			});
		},
		
		// Delete Collection embedding
		delete(collectionKey) {
			this.cache.delete(collectionKey);
		},
		
		// Check if exists
		has(collectionKey) {
			return this.cache.has(collectionKey);
		},
		
		// Get all cache keys
		keys() {
			return this.cache.keys();
		},
		
		// Generate text hash (for Item cache key)
		hashText(text) {
			let hash = 0;
			for (let i = 0; i < text.length; i++) {
				const char = text.charCodeAt(i);
				hash = ((hash << 5) - hash) + char;
				hash = hash & hash;
			}
			return 'item_' + Math.abs(hash).toString(16);
		},
		
		// Get Item text embedding
		getItemEmbedding(text) {
			const hash = this.hashText(text);
			const cached = this.itemCache.get(hash);
			if (cached && cached.embedding) {
				TidyUp.log(`Item embedding cache hit for "${text.substring(0, 30)}..."`);
				return cached.embedding;
			}
			return null;
		},
		
		// Set Item text embedding
		setItemEmbedding(text, embedding) {
			const hash = this.hashText(text);
			this.itemCache.set(hash, {
				text: text,
				embedding: embedding,
				updatedAt: new Date().toISOString()
			});
			TidyUp.log(`Cached item embedding for "${text.substring(0, 30)}..."`);
		},
		
		// Get cache size
		get size() {
			return this.cache.size;
		},
		
		// Clear cache
		clear() {
			this.cache.clear();
			this.model = null;
			this.dimensions = 0;
		},
		
		// Check if needs update (name change, Item change, or not exists)
		needsUpdate(collectionKey, collectionName, itemFingerprint = null) {
			const cached = this.get(collectionKey);
			if (!cached) return true;
			if (cached.name !== collectionName) return true;
			if (!cached.embedding) return true;
			// Check if Item composition changed
			if (itemFingerprint && cached.itemFingerprint && cached.itemFingerprint !== itemFingerprint) {
				return true;
			}
			return false;
		},
		
		// Generate Item fingerprint (for detecting Item composition change)
		generateItemFingerprint(items) {
			if (!items || items.length === 0) return '';
			const ids = items.map(item => item.id).sort((a, b) => a - b);
			return ids.join(',');
		}
	},
	
	// Load LLM API config from preferences
	loadLlmConfig() {
		try {
			let provider = Zotero.Prefs.get('extensions.tidy-up.llm.provider', true) || null;
			let apiKey = Zotero.Prefs.get('extensions.tidy-up.llm.apiKey', true) || null;
			let model = Zotero.Prefs.get('extensions.tidy-up.llm.model', true) || null;
			let baseUrl = Zotero.Prefs.get('extensions.tidy-up.llm.baseUrl', true) || null;
			
			// Always update config even when provider is empty
			this.llmConfig.provider = provider;
			this.llmConfig.model = model;
			this.llmConfig.baseUrl = baseUrl;
			this.llmConfig.apiKey = apiKey;
			
			// Load classification algorithm config
			let algorithm = Zotero.Prefs.get('extensions.tidy-up.classification.algorithm', true) || 'vector';
			this.classificationConfig.algorithm = algorithm;
			
			this.log(`LLM config loaded: provider=${this.llmConfig.provider || 'none'}, apiKey=${this.llmConfig.apiKey ? 'set' : 'not set'}, algorithm=${this.classificationConfig.algorithm}`);
		} catch (e) {
			this.log(`Error loading LLM config: ${e.message}`);
		}
	},
	
	// Classify Collection type (external vs internal)
	async classifyCollectionType(collectionName, collectionDescription, collectionItems = []) {
		// Log algorithm selection and execution
		this.log(`Classifying collection "${collectionName}": algorithm=${this.classificationConfig.algorithm}`);
		
		// Use vector angle algorithm (no LLM API call)
		this.log(`Using vector algorithm for collection "${collectionName}"`);
		return this.classifyCollectionTypeVector(collectionName, collectionDescription);
	},
	
	// Vector angle algorithm (legacy, no LLM API)
	async classifyCollectionTypeVector(collectionName, collectionDescription) {
		// Vector algorithm uses simple rules, no LLM API
		this.log(`Vector algorithm: classifying collection "${collectionName}" without LLM API`);
		
		try {
			// Use simple rules to classify Collection type
			// External-type features: "--", descriptive words
			const externalKeywords = ['--', 'top', 'personal', 'document', 'classification', 'collection', 'papers', 'learning'];
			// Internal-type features: domain terms, technical terms
			const internalKeywords = ['multimodal', 'multimedia', 'contrastive', 'learning', 'transformer', 'architecture', 'semantic', 'enhanced', 'detection', 'generation', 'reasoning'];

			const nameLower = collectionName.toLowerCase();
			const hasExternalKeywords = externalKeywords.some(keyword => nameLower.includes(keyword));
			const hasInternalKeywords = internalKeywords.some(keyword => nameLower.includes(keyword));
			
			// Classify Collection type
			if (hasExternalKeywords && !hasInternalKeywords) {
				this.log(`Collection "${collectionName}" classified as external (vector algorithm, rule-based)`);
				return 'external';
			} else if (hasInternalKeywords && !hasExternalKeywords) {
				this.log(`Collection "${collectionName}" classified as internal (vector algorithm, rule-based)`);
				return 'internal';
			} else if (hasInternalKeywords && hasExternalKeywords) {
				// If both types present, use priority
				this.log(`Collection "${collectionName}" has both types, using default (vector algorithm, rule-based)`);
				return 'default';
			} else {
				// If neither present, use default
				this.log(`Collection "${collectionName}" no clear type, using default (vector algorithm, rule-based)`);
				return 'default';
			}
		} catch (e) {
			this.log(`Error classifying collection: ${e.message} (vector algorithm, rule-based)`);
			return 'default';
		}
	},
	
	// LLM zero-shot classification (direct LLM for Item classification)
	async classifyItemWithZeroShot(itemName, itemAbstract, collections, maxCollections = 3) {
		if (!this.llmConfig.provider || !this.llmConfig.apiKey) {
			this.log('No LLM API configured for zero-shot classification');
			return null;
		}
		
		try {
			this.log(`Starting zero-shot classification for item: "${itemName}"`);
			
			// Collect Collection info
			const collectionList = collections.map(c => {
				const type = c.collectionType || 'default';
				const typeLabel = type === 'external' ? '[External]' : (type === 'internal' ? '[Internal]' : '');
				return `${typeLabel} ${c.name}`;
			}).join('\n');

			// Build zero-shot classification prompt
			const prompt = `Classify the following reference into the most suitable Collection(s). Select at most ${maxCollections} Collection(s).

Reference:
- Title: ${itemName}
- Abstract: ${itemAbstract || 'N/A'}

Available Collections:
${collectionList}

Requirements:
1. Analyze the reference's topic, domain and content
2. Rank by semantic match with each Collection
3. Prefer Internal-type Collections
4. Select at most ${maxCollections} Collection(s)
5. Sort by relevance from high to low

Output format (strictly follow):
Collection name | confidence(0-1)
xxx | 0.95
xxx | 0.87
xxx | 0.76

Output strictly in the above format with no additional content.`;
			
			const result = await this.callLlmApi(prompt, 'Zero-Shot');
			this.log(`Zero-shot classification API response: ${result}`);
			
			if (!result) {
				this.log('Zero-shot classification failed');
				return null;
			}
			
			// Parse result
			const lines = result.split('\n');
			const classifications = [];
			
			for (const line of lines) {
				if (line.includes('|')) {
					const parts = line.split('|').map(p => p.trim());
					if (parts.length >= 2) {
						const collectionName = parts[0].replace(/\[.*?\]\s*/g, '');
						const confidence = parseFloat(parts[1]);
						
						if (!isNaN(confidence) && collectionName) {
							// Find matching Collection
							const matchedCollection = collections.find(c => c.name === collectionName);
							if (matchedCollection) {
								classifications.push({
									collection: matchedCollection,
									confidence: confidence,
									originalName: collectionName
								});
							}
						}
					}
				}
			}
			
			this.log(`Zero-shot classification result: ${classifications.length} collections matched`);
			for (const cls of classifications) {
				this.log(`  - ${cls.originalName}: ${cls.confidence.toFixed(4)}`);
			}
			
			// Parent-child dedup: if both recommended, keep only child
			const filteredClassifications = this.filterParentChildRelationships(classifications);
			
			this.log(`After parent-child filtering: ${filteredClassifications.length} collections`);
			for (const cls of filteredClassifications) {
				this.log(`  - ${cls.originalName}: ${cls.confidence.toFixed(4)}`);
			}
			
			return filteredClassifications;
		} catch (e) {
			this.log(`Error in zero-shot classification: ${e.message}`);
			return null;
		}
	},
	
	// Parent-child dedup: if both recommended, keep only child
	filterParentChildRelationships(classifications) {
		if (!classifications || classifications.length === 0) {
			return classifications;
		}
		
		// Build parent-child map: childId -> parentId
		const childToParentMap = new Map();
		
		// Collect all recommended Collection IDs
		const recommendedIds = new Set(classifications.map(cls => cls.collection.id));
		
		// Build parent-child relations
		for (const cls of classifications) {
			const collection = cls.collection;
			
			// Check if any child is also recommended
			if (collection.children && collection.children.length > 0) {
				for (const child of collection.children) {
					if (recommendedIds.has(child.id)) {
						// Child recommended, record relation
						childToParentMap.set(child.id, collection.id);
						this.log(`Parent-child relationship found: Parent="${collection.name}" (ID:${collection.id}), Child="${child.name}" (ID:${child.id})`);
					}
				}
			}
		}
		
		// Filter out parents that are recommended and have recommended children
		const filtered = classifications.filter(cls => {
			const collectionId = cls.collection.id;
			const hasRecommendedChild = Array.from(childToParentMap.values()).includes(collectionId);
			
			if (hasRecommendedChild) {
				this.log(`Filtering out parent collection: "${cls.originalName}" (has recommended child)`);
				return false;
			}
			
			return true;
		});
		
		return filtered;
	},
	
	// Call LLM API
	async callLlmApi(prompt, algorithm = 'unknown') {
		if (!this.llmConfig.provider || !this.llmConfig.apiKey) {
			return null;
		}
		
		// Show message to user (non-blocking)
		try {
			Zotero.debug(`Calling LLM API with algorithm: ${algorithm}, provider: ${this.llmConfig.provider}`);
			const popMsg = new Zotero.ProgressWindow({ closeOnClick: true });
			popMsg.changeHeadline('PaperRouter', '', ` Calling LLM API (${algorithm}, ${this.llmConfig.provider})`);
			
			const prog = new popMsg.ItemProgress(
				'chrome://zotero/skin/spinner-16px.png',
				`API Calling...`
			);
			prog.setProgress(50);
			
			popMsg.show();
			popMsg.startCloseTimer(2000);
		} catch (e) {
			// Ignore notification errors, continue
			this.log(`Error showing notification: ${e.message}`);
		}
		
		try {
			const cfg = Object.assign({}, this.llmConfig); // shallow copy
			let response;
			switch (cfg.provider) {
				case 'openai':
				case 'openrouter':
				case 'ollama':
				case 'custom':
					response = await this.callOpenAICompat(cfg, prompt);
					break;
				case 'anthropic':
					response = await this.callAnthropic(cfg, prompt);
					break;
				case 'gemini':
					response = await this.callGemini(cfg, prompt);
					break;
				case 'cohere':
					// legacy path preserved — Cohere LLM remains supported via its existing code
					response = await this._callCohereLlmLegacy(cfg, prompt);
					break;
				default:
					return null;
			}
			return response;
		} catch (e) {
			this.log(`Error calling LLM API: ${e.message}`);
			throw e;
		}
	},

	// 3.0.5: shared executor — request shape comes from TidyUpProviders, response/error parsed via shared helpers.
	async _executeChatRequest(provider, model, req) {
		const resp = await fetch(req.url, {
			method: 'POST', headers: req.headers, body: JSON.stringify(req.body)
		});
		if (!resp.ok) {
			const txt = await resp.text();
			const msg = TidyUpProviders.parseErrorBody(provider, resp.status, txt);
			this.log(`LLM error: ${provider}/${model} HTTP ${resp.status} ${txt.substring(0, 200)}`);
			throw new Error(msg);
		}
		const data = JSON.parse(await resp.text());
		const kind = TidyUpProviders.classify(provider, model);
		const parsed = TidyUpProviders.parseChatResponse(provider, kind, data);
		if (parsed.error === 'empty_truncated') {
			const empty = (typeof TidyUpL10n !== 'undefined') ? TidyUpL10n.getString('err-empty-budget') : 'Empty (raise budget)';
			throw new Error(empty);
		}
		if (parsed.error) {
			this.log(`LLM empty: ${provider}/${model} ${parsed.error}`);
			throw new Error(parsed.error);
		}
		return parsed.content;
	},

	// OpenAI-compatible LLM adapter (openai / openrouter / custom)
	async callOpenAICompat(config, prompt) {
		const req = TidyUpProviders.buildOpenAIRequest(config, prompt, false);
		return this._executeChatRequest(config.provider, config.model, req);
	},

	// Anthropic (Claude) LLM adapter
	async callAnthropic(config, prompt) {
		const req = TidyUpProviders.buildAnthropicRequest(config, prompt, false);
		return this._executeChatRequest('anthropic', config.model, req);
	},

	// Gemini LLM adapter (auto-routes AI Studio vs Vertex AI Express by API key prefix)
	async callGemini(config, prompt) {
		const req = TidyUpProviders.buildGeminiRequest(config, prompt, false);
		return this._executeChatRequest('gemini', config.model, req);
	},

	// Cohere LLM
	async _callCohereLlmLegacy(config, prompt) {
		const req = TidyUpProviders.buildCohereRequest(config, prompt, false);
		return this._executeChatRequest('cohere', config.model, req);
	},

	// Pre-classify all Collection types (called on plugin init)
	async preClassifyAllCollections() {
		try {
			this.log('Starting to pre-classify all collections...');

			// Get all Collections (recursive, including children)
			const libraries = Zotero.Libraries.getAll();
			this.log(`Found ${libraries.length} libraries`);
			let allCollections = [];
			for (let library of libraries) {
				this.log(`Getting collections for library ${library.libraryID}`);
				const rootCollections = await Zotero.Collections.getByLibrary(library.libraryID, false);
				this.log(`Library ${library.libraryID} has ${rootCollections.length} root collections`);
				
				// Recursively get all Collections (including children)
				for (const rootCol of rootCollections) {
					allCollections.push(rootCol);
					const childCollections = await this.getAllChildCollections(rootCol.id);
					allCollections = allCollections.concat(childCollections);
				}
			}
			this.log(`Found ${allCollections.length} collections to classify`);

			// Count Collections to classify
			let needClassify = 0;
			for (const collection of allCollections) {
				const collectionId = collection.id.toString();
				if (!this.collectionTypeCache.get(collectionId)) {
					needClassify++;
				}
			}

			if (needClassify === 0) {
				this.log(`All ${allCollections.length} collections already classified, skipping pre-classification`);
				return;
			}

			this.log(`Need to classify ${needClassify} collections`);

			// Classify each Collection
			for (const collection of allCollections) {
				const collectionId = collection.id.toString();
				const collectionName = collection.name;

				// Check if already classified
				if (this.collectionTypeCache.get(collectionId)) {
					this.log(`Collection "${collectionName}" already classified, skipping`);
					continue;
				}

				try {
					// Get Collection description
					const collectionDescription = collection.getField('abstract') || '';

					// Classify Collection type
					const collectionType = await this.classifyCollectionType(collectionName, collectionDescription, []);

					// Cache classification result
					this.collectionTypeCache.set(collectionId, collectionType);
					this.log(`Collection "${collectionName}" pre-classified as ${collectionType}`);
				} catch (e) {
					this.log(`Error pre-classifying collection "${collectionName}": ${e.message}`);
					// Set default type
					this.collectionTypeCache.set(collectionId, 'default');
				}
			}

			// Save cache
			await this.collectionTypeCache.save();
			this.log(`Pre-classification completed: ${this.collectionTypeCache.size} collections classified`);
		} catch (e) {
			this.log(`Error in preClassifyAllCollections: ${e.message}`);
			this.log(`Stack: ${e.stack}`);
		}
	},

	// Recursively get all child Collections
	async getAllChildCollections(parentId) {
		try {
			const childCollections = await Zotero.Collections.getByParent(parentId);
			let allChildren = [];
			
			for (const child of childCollections) {
				allChildren.push(child);
				// Recursively get children of children
				const grandChildren = await this.getAllChildCollections(child.id);
				allChildren = allChildren.concat(grandChildren);
			}
			
			return allChildren;
		} catch (e) {
			this.log(`Error getting child collections for parent ${parentId}: ${e.message}`);
			return [];
		}
	},

	// Collection blacklist cache (user feedback)
	// Records user-unchecked Collections to exclude irrelevant recommendations
	collectionBlacklist: {
		blacklist: new Map(),  // itemId -> Set of collectionIds
		recommendationStats: new Map(),  // collectionId -> { recommended: number, rejected: number }
		filePath: null,
		initialized: false,
		
		async init(rootURI) {
			if (this.initialized) return;
			
			this.filePath = PathUtils.join(Zotero.Profile.dir, 'tidy-up-blacklist.json');
			
			TidyUp.log(`Blacklist file path: ${this.filePath}`);
			
			await this.load();
			this.initialized = true;
			TidyUp.log(`Blacklist initialized with ${this.blacklist.size} items, ${this.recommendationStats.size} collection stats`);
		},
		
		async load() {
			try {
				const fileExists = await IOUtils.exists(this.filePath);
				if (!fileExists) {
					TidyUp.log('No existing blacklist file found');
					return;
				}
				
				const content = await IOUtils.readUTF8(this.filePath);
				const data = JSON.parse(content);
				
				if (data.blacklist) {
					for (const [itemId, collectionIds] of Object.entries(data.blacklist)) {
						this.blacklist.set(parseInt(itemId, 10), new Set(collectionIds));
					}
				}
				
				// Load recommendation stats
				if (data.recommendationStats) {
					for (const [collectionId, stats] of Object.entries(data.recommendationStats)) {
						this.recommendationStats.set(parseInt(collectionId, 10), stats);
					}
				}
				
				TidyUp.log(`Loaded blacklist for ${this.blacklist.size} items, ${this.recommendationStats.size} collection stats`);
			} catch (e) {
				TidyUp.log(`Error loading blacklist: ${e.message}`);
			}
		},
		
		async save() {
			try {
				const data = {
					version: 2,  // Version bump
					blacklist: {},
					recommendationStats: {},
					savedAt: new Date().toISOString()
				};
				
				for (const [itemId, collectionIds] of this.blacklist) {
					data.blacklist[itemId] = Array.from(collectionIds);
				}
				
				// Save recommendation stats
				for (const [collectionId, stats] of this.recommendationStats) {
					data.recommendationStats[collectionId] = stats;
				}
				
				const jsonStr = JSON.stringify(data, null, 2);
				await IOUtils.writeUTF8(this.filePath, jsonStr);
				
				TidyUp.log(`Saved blacklist for ${this.blacklist.size} items, ${this.recommendationStats.size} collection stats`);
			} catch (e) {
				TidyUp.log(`Error saving blacklist: ${e.message}`);
			}
		},
		
		getBlacklist(itemId) {
			if (!this.blacklist.has(itemId)) {
				this.blacklist.set(itemId, new Set());
			}
			return this.blacklist.get(itemId);
		},
		
		isBlacklisted(itemId, collectionId) {
			const itemBlacklist = this.blacklist.get(itemId);
			return itemBlacklist ? itemBlacklist.has(collectionId) : false;
		},
		
		addToBlacklist(itemId, collectionId) {
			if (!this.blacklist.has(itemId)) {
				this.blacklist.set(itemId, new Set());
			}
			this.blacklist.get(itemId).add(collectionId);
			
			// Update rejection stats
			this.recordRejection(collectionId);
			
			TidyUp.log(`Added collection ${collectionId} to blacklist for item ${itemId}`);
		},
		
		removeFromBlacklist(itemId, collectionId) {
			const itemBlacklist = this.blacklist.get(itemId);
			if (itemBlacklist) {
				itemBlacklist.delete(collectionId);
				
				// Update rejection stats (undo rejection)
				this.undoRejection(collectionId);
				
				TidyUp.log(`Removed collection ${collectionId} from blacklist for item ${itemId}`);
			}
		},
		
		async updateBlacklist(itemId, collectionId, isBlacklisted) {
			if (isBlacklisted) {
				this.addToBlacklist(itemId, collectionId);
			} else {
				this.removeFromBlacklist(itemId, collectionId);
			}
			await this.save();
		},
		
		// Record Collection as recommended
		recordRecommendation(collectionId) {
			if (!this.recommendationStats.has(collectionId)) {
				this.recommendationStats.set(collectionId, { recommended: 0, rejected: 0 });
			}
			const stats = this.recommendationStats.get(collectionId);
			stats.recommended++;
		},
		
		// Record Collection as rejected
		recordRejection(collectionId) {
			if (!this.recommendationStats.has(collectionId)) {
				this.recommendationStats.set(collectionId, { recommended: 0, rejected: 0 });
			}
			const stats = this.recommendationStats.get(collectionId);
			stats.rejected++;
		},
		
		// Undo rejection record
		undoRejection(collectionId) {
			const stats = this.recommendationStats.get(collectionId);
			if (stats && stats.rejected > 0) {
				stats.rejected--;
			}
		},
		
		// Get Collection rejection rate
		getRejectionRate(collectionId) {
			const stats = this.recommendationStats.get(collectionId);
			if (!stats || stats.recommended === 0) {
				return 0;  // No recommendation record, rejection rate 0
			}
			return stats.rejected / stats.recommended;
		},
		
		// Compute rejection rate penalty (0-1, higher = heavier penalty)
		// Penalty factor 0.8: at 50% rejection rate, penalty coefficient 0.4
		// Final score = raw score × (1 - penalty coefficient)
		getRejectionPenalty(collectionId, penaltyFactor = 0.8, maxPenalty = 0.5) {
			const rejectionRate = this.getRejectionRate(collectionId);
			// Penalty = rejection rate × penalty factor, capped at max
			return Math.min(rejectionRate * penaltyFactor, maxPenalty);
		},
		
		// Apply rejection rate penalty to similarity
		applyRejectionPenalty(collectionId, similarity) {
			const penalty = this.getRejectionPenalty(collectionId);
			const adjustedSimilarity = similarity * (1 - penalty);
			// Use Zotero.debug to avoid undefined console
			Zotero.debug(`PaperRouter: Collection ${collectionId}: rejection rate ${(this.getRejectionRate(collectionId) * 100).toFixed(1)}%, penalty ${(penalty * 100).toFixed(1)}%, similarity ${similarity.toFixed(4)} -> ${adjustedSimilarity.toFixed(4)}`);
			return adjustedSimilarity;
		}
	},

	// IDF weighting system
	// Reduces weight of common words/phrases, increases weight of rare ones
	idfWeighting: {
		// Term frequency: phrase -> number of Collections containing it
		phraseFrequency: new Map(),
		// Total Collection count
		totalCollections: 0,
		// Whether initialized
		initialized: false,
		// Cache file path
		filePath: null,
		
		// Config
		config: {
			// Min phrase length (chars)
			minPhraseLength: 2,
			// Max phrase length (words)
			maxPhraseWords: 4,
			// Min occurrence for IDF
			minOccurrence: 1,
			// IDF base (avoid div by zero)
			idfBase: 1.0,
			// IDF weight range
			minIdfWeight: 0.5,
			maxIdfWeight: 2.0
		},
		
		// Initialize IDF system
		async init(rootURI) {
			if (this.initialized) return;
			
			this.filePath = PathUtils.join(Zotero.Profile.dir, 'tidy-up-idf.json');
			
			TidyUp.log(`IDF file path: ${this.filePath}`);
			
			// Try to load existing data
			await this.load();
			
			// If no data, build IDF index
			if (this.phraseFrequency.size === 0) {
				TidyUp.log('No IDF data found, building index...');
				await this.buildIndex();
			}
			
			this.initialized = true;
			TidyUp.log(`IDF initialized with ${this.phraseFrequency.size} phrases from ${this.totalCollections} collections`);
		},
		
		// Load IDF data
		async load() {
			try {
				const fileExists = await IOUtils.exists(this.filePath);
				if (!fileExists) {
					TidyUp.log('No existing IDF file found');
					return;
				}
				
				const content = await IOUtils.readUTF8(this.filePath);
				const data = JSON.parse(content);
				
				if (data.phraseFrequency) {
					for (const [phrase, count] of Object.entries(data.phraseFrequency)) {
						this.phraseFrequency.set(phrase, count);
					}
				}
				
				this.totalCollections = data.totalCollections || 0;
				
				TidyUp.log(`Loaded IDF data: ${this.phraseFrequency.size} phrases, ${this.totalCollections} collections`);
			} catch (e) {
				TidyUp.log(`Error loading IDF data: ${e.message}`);
			}
		},
		
		// Save IDF data
		async save() {
			try {
				const data = {
					version: 1,
					phraseFrequency: {},
					totalCollections: this.totalCollections,
					savedAt: new Date().toISOString()
				};
				
				for (const [phrase, count] of this.phraseFrequency) {
					data.phraseFrequency[phrase] = count;
				}
				
				const jsonStr = JSON.stringify(data, null, 2);
				await IOUtils.writeUTF8(this.filePath, jsonStr);
				
				TidyUp.log(`Saved IDF data: ${this.phraseFrequency.size} phrases`);
			} catch (e) {
				TidyUp.log(`Error saving IDF data: ${e.message}`);
			}
		},
		
		// Extract phrases from Collection name
		// Supports multi-word phrases like "machine learning", "deep neural network"
		extractPhrases(text) {
			if (!text) return [];
			
			const phrases = new Set();
			const normalizedText = text.toLowerCase().trim();
			
			// Tokenize (Chinese and English)
			// Chinese: split by char, extract 2-4 char phrases
			// English: split by space, extract 1-4 word phrases
			
			// Detect if mostly Chinese
			const chineseChars = normalizedText.match(/[\u4e00-\u9fa5]/g);
			const isChinese = chineseChars && chineseChars.length > normalizedText.length * 0.3;
			
			if (isChinese) {
				// Chinese: extract n-gram phrases
				const chars = normalizedText.replace(/\s+/g, '');
				for (let len = 2; len <= Math.min(6, chars.length); len++) {
					for (let i = 0; i <= chars.length - len; i++) {
						const phrase = chars.substring(i, i + len);
						if (phrase.length >= this.config.minPhraseLength) {
							phrases.add(phrase);
						}
					}
				}
			} else {
				// English: extract phrases
				const words = normalizedText.split(/\s+/).filter(w => w.length >= 2);
				
				// Single word
				for (const word of words) {
					if (word.length >= this.config.minPhraseLength) {
						phrases.add(word);
					}
				}
				
				// Multi-word phrases (2-4 words)
				for (let n = 2; n <= this.config.maxPhraseWords; n++) {
					for (let i = 0; i <= words.length - n; i++) {
						const phrase = words.slice(i, i + n).join(' ');
						phrases.add(phrase);
					}
				}
			}
			
			return Array.from(phrases);
		},
		
		// Build IDF index
		async buildIndex() {
			TidyUp.log('Building IDF index...');
			
			// Clear existing data
			this.phraseFrequency.clear();
			this.totalCollections = 0;
			
			// Get all Collections
			const allCollections = await TidyUp.getAllCollections();
			this.totalCollections = allCollections.length;
			
			TidyUp.log(`Processing ${this.totalCollections} collections for IDF...`);
			
			// Count Collections containing each phrase
			const phraseCollections = new Map();  // phrase -> Set of collectionIds
			
			for (const collection of allCollections) {
				const phrases = this.extractPhrases(collection.name);
				for (const phrase of phrases) {
					if (!phraseCollections.has(phrase)) {
						phraseCollections.set(phrase, new Set());
					}
					phraseCollections.get(phrase).add(collection.id);
				}
			}
			
			// Convert to frequency stats
			for (const [phrase, collectionSet] of phraseCollections) {
				const count = collectionSet.size;
				if (count >= this.config.minOccurrence) {
					this.phraseFrequency.set(phrase, count);
				}
			}
			
			TidyUp.log(`IDF index built: ${this.phraseFrequency.size} unique phrases`);
			
			// Save to file
			await this.save();
		},
		
		// Compute phrase IDF value
		// IDF = log(N / df), N = total Collections, df = Collections containing phrase
		calculateIDF(phrase) {
			const df = this.phraseFrequency.get(phrase) || 1;
			const n = this.totalCollections || 1;
			
			// Standard IDF formula
			const idf = Math.log(n / df) + this.config.idfBase;
			
			// Normalize to [minIdfWeight, maxIdfWeight]
			// IDF range approx [0, log(N)]
			const maxIdf = Math.log(n) + this.config.idfBase;
			const normalizedIdf = idf / maxIdf;
			
			// Map to target range
			const weight = this.config.minIdfWeight + 
				normalizedIdf * (this.config.maxIdfWeight - this.config.minIdfWeight);
			
			return Math.max(this.config.minIdfWeight, 
				Math.min(this.config.maxIdfWeight, weight));
		},
		
		// Compute IDF weight for Collection name
		// Returns average IDF weight of all phrases in the name
		calculateCollectionIDFWeight(collectionName) {
			if (!this.initialized || this.totalCollections === 0) {
				return 1.0;  // Return neutral weight when not initialized
			}
			
			const phrases = this.extractPhrases(collectionName);
			if (phrases.length === 0) {
				return 1.0;
			}
			
			// Compute IDF weight for all phrases
			const weights = phrases.map(phrase => this.calculateIDF(phrase));
			
			// Return average weight
			const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
			
			TidyUp.log(`IDF weight for "${collectionName}": ${avgWeight.toFixed(3)} (from ${phrases.length} phrases)`);
			return avgWeight;
		},
		
		// Apply IDF weight to similarity
		applyIDFWeight(collectionId, collectionName, similarity) {
			const idfWeight = this.calculateCollectionIDFWeight(collectionName);
			const adjustedSimilarity = similarity * idfWeight;
			
			TidyUp.log(`Collection ${collectionId} "${collectionName}": IDF weight ${idfWeight.toFixed(3)}, similarity ${similarity.toFixed(4)} -> ${adjustedSimilarity.toFixed(4)}`);
			return adjustedSimilarity;
		},
		
		// Update phrase stats for single Collection (when name changes)
		async updateCollectionPhrases(oldName, newName) {
			// Simple: rebuild index
			// More efficient: incremental update (higher complexity)
			await this.buildIndex();
		},
		
		// Reset IDF index
		async reset() {
			this.phraseFrequency.clear();
			this.totalCollections = 0;
			await this.buildIndex();
		}
	},

	// Collection specificity evaluation
	// Evaluates internal topic consistency; "catch-all" Collections get lower weight
	collectionSpecificity: {
		// Specificity cache: collectionId -> specificity score (0-1)
		specificityCache: new Map(),
		// Whether initialized
		initialized: false,
		// Cache file path
		filePath: null,
		
		// Config
		config: {
			// Min Item count for specificity (too few = unreliable)
			minItemsForSpecificity: 3,
			// Specificity weight range
			minSpecificityWeight: 0.6,   // Min weight for low-specificity Collection
			maxSpecificityWeight: 1.2,   // Max weight for high-specificity Collection
			// Similarity threshold (for judging if Items share topic)
			similarityThreshold: 0.3,
			// Use embeddings for specificity (more accurate but needs API)
			useEmbeddingForSpecificity: true
		},
		
		// Initialize specificity system
		async init(rootURI) {
			if (this.initialized) return;
			
			this.filePath = PathUtils.join(Zotero.Profile.dir, 'tidy-up-specificity.json');
			
			TidyUp.log(`Specificity file path: ${this.filePath}`);
			
			// Try to load existing data
			await this.load();
			
			this.initialized = true;
			TidyUp.log(`Specificity initialized with ${this.specificityCache.size} collections`);
		},
		
		// Load specificity data
		async load() {
			try {
				const fileExists = await IOUtils.exists(this.filePath);
				if (!fileExists) {
					TidyUp.log('No existing specificity file found');
					return;
				}
				
				const content = await IOUtils.readUTF8(this.filePath);
				const data = JSON.parse(content);
				
				if (data.specificityCache) {
					for (const [collectionId, specificity] of Object.entries(data.specificityCache)) {
						this.specificityCache.set(parseInt(collectionId, 10), specificity);
					}
				}
				
				TidyUp.log(`Loaded specificity data: ${this.specificityCache.size} collections`);
			} catch (e) {
				TidyUp.log(`Error loading specificity data: ${e.message}`);
			}
		},
		
		// Save specificity data
		async save() {
			try {
				const data = {
					version: 1,
					specificityCache: {},
					savedAt: new Date().toISOString()
				};
				
				for (const [collectionId, specificity] of this.specificityCache) {
					data.specificityCache[collectionId] = specificity;
				}
				
				const jsonStr = JSON.stringify(data, null, 2);
				await IOUtils.writeUTF8(this.filePath, jsonStr);
				
				TidyUp.log(`Saved specificity data: ${this.specificityCache.size} collections`);
			} catch (e) {
				TidyUp.log(`Error saving specificity data: ${e.message}`);
			}
		},
		
		// Compute specificity for single Collection
		// Specificity = avg similarity among Items in Collection
		// High = Items theme concentrated, recommendations more reliable
		// Low = Items theme scattered, may be "catch-all" Collection
		async calculateSpecificity(collection) {
			try {
				// Get Items in Collection
				const itemIDs = await collection.getChildItems();
				const items = await Zotero.Items.getAsync(itemIDs);
				
				// Too few Items for reliable specificity
				if (items.length < this.config.minItemsForSpecificity) {
					TidyUp.log(`Collection "${collection.name}": too few items (${items.length}), default specificity`);
					return 0.5;  // Medium specificity
				}
				
				// Get all Item titles
				const titles = items
					.map(item => item.getDisplayTitle() || item.getField('title'))
					.filter(title => title && title.length > 0);
				
				if (titles.length < this.config.minItemsForSpecificity) {
					return 0.5;
				}
				
				// Choose calculation method
				let specificity = 0;
				
				if (this.config.useEmbeddingForSpecificity && 
					TidyUp.embeddingConfig.provider && 
					TidyUp.embeddingConfig.apiKey) {
					// Use embeddings (more accurate)
					specificity = await this.calculateSpecificityWithEmbedding(titles);
				} else {
					// Use local text similarity
					specificity = this.calculateSpecificityWithText(titles);
				}
				
				TidyUp.log(`Collection "${collection.name}": specificity = ${specificity.toFixed(3)} (${items.length} items)`);
				return specificity;
				
			} catch (e) {
				TidyUp.log(`Error calculating specificity for "${collection.name}": ${e.message}`);
				return 0.5;  // Return medium on error
			}
		},
		
		// Compute specificity using embeddings
		async calculateSpecificityWithEmbedding(titles) {
			const embeddings = [];
			
			// Get embeddings for all titles
			for (const title of titles) {
				const embedding = await TidyUp.getEmbedding(title);
				if (embedding) {
					embeddings.push(embedding);
				}
			}
			
			if (embeddings.length < 2) {
				return 0.5;
			}
			
			// Compute pairwise similarity of all embeddings
			let totalSimilarity = 0;
			let pairCount = 0;
			
			for (let i = 0; i < embeddings.length; i++) {
				for (let j = i + 1; j < embeddings.length; j++) {
					const similarity = TidyUp.embeddingSimilarity(embeddings[i], embeddings[j]);
					totalSimilarity += similarity;
					pairCount++;
				}
			}
			
			// Avg similarity = specificity
			return pairCount > 0 ? totalSimilarity / pairCount : 0.5;
		},
		
		// Compute specificity using local text similarity
		calculateSpecificityWithText(titles) {
			let totalSimilarity = 0;
			let pairCount = 0;
			
			for (let i = 0; i < titles.length; i++) {
				for (let j = i + 1; j < titles.length; j++) {
					const similarity = TidyUp.cosineSimilarity(titles[i], titles[j]);
					totalSimilarity += similarity;
					pairCount++;
				}
			}
			
			return pairCount > 0 ? totalSimilarity / pairCount : 0.5;
		},
		
		// Get Collection specificity (from cache or compute)
		async getSpecificity(collection) {
			const collectionId = collection.id;
			
			// Check cache
			if (this.specificityCache.has(collectionId)) {
				return this.specificityCache.get(collectionId);
			}
			
			// Compute and cache
			const specificity = await this.calculateSpecificity(collection);
			this.specificityCache.set(collectionId, specificity);
			
			return specificity;
		},
		
		// Get specificity weight (for adjusting similarity)
		// High specificity → high weight, low → low weight
		getSpecificityWeight(specificity) {
			// Map specificity (0-1) to weight range
			// specificity = 0 → minWeight
			// specificity = 1 → maxWeight
			const weight = this.config.minSpecificityWeight + 
				specificity * (this.config.maxSpecificityWeight - this.config.minSpecificityWeight);
			
			return weight;
		},
		
		// Apply specificity weight to similarity
		async applySpecificityWeight(collection, similarity) {
			const specificity = await this.getSpecificity(collection);
			const weight = this.getSpecificityWeight(specificity);
			const adjustedSimilarity = similarity * weight;
			
			TidyUp.log(`Collection "${collection.name}": specificity ${specificity.toFixed(3)}, weight ${weight.toFixed(3)}, similarity ${similarity.toFixed(4)} -> ${adjustedSimilarity.toFixed(4)}`);
			return adjustedSimilarity;
		},
		
		// Apply specificity weight by collectionId (for tree structure)
		// Sync function, reads from cache only
		applySpecificityWeightById(collectionId, collectionName, similarity) {
			// Get specificity from cache
			let specificity = this.specificityCache.get(collectionId);
			
			if (specificity === undefined) {
				// No cache, return raw similarity (computed later)
				return similarity;
			}
			
			const weight = this.getSpecificityWeight(specificity);
			return similarity * weight;
		},
		
		// Batch compute specificity for all Collections
		async calculateAllSpecificity() {
			TidyUp.log('Calculating specificity for all collections...');
			
			const allCollections = await TidyUp.getAllCollections();
			let calculated = 0;
			
			for (const collection of allCollections) {
				const specificity = await this.calculateSpecificity(collection);
				this.specificityCache.set(collection.id, specificity);
				calculated++;
				
				// Save every 10 (avoid data loss)
				if (calculated % 10 === 0) {
					await this.save();
				}
			}
			
			await this.save();
			TidyUp.log(`Calculated specificity for ${calculated} collections`);
		},
		
		// Update single Collection specificity
		async updateSpecificity(collection) {
			const specificity = await this.calculateSpecificity(collection);
			this.specificityCache.set(collection.id, specificity);
			await this.save();
		},
		
		// Delete Collection specificity cache
		removeSpecificity(collectionId) {
			this.specificityCache.delete(collectionId);
		},
		
		// Reset all specificity data
		async reset() {
			this.specificityCache.clear();
			await this.calculateAllSpecificity();
		}
	},

	// Background embedding precompute task
	backgroundEmbeddingTask: {
		initialized: false,
		running: false,
		paused: false,
		
		// Compute queue
		queue: [],
		
		// State tracking
		pendingKeys: new Set(),
		
		// Stats
		stats: {
			updatedCount: 0,      // Updated this session
			pendingCount: 0,      // Pending update
			apiTotalCount: 0,     // Total API calls
			apiSuccessCount: 0,   // Successful API calls
			apiFailCount: 0,      // Failed API calls
			lastApiError: null    // Last API error
		},
		
		// Config
		config: {
			batchSize: 5,
			batchDelay: 200,
			idleTimeout: 5000,
			maxRetries: 3
		},
		
		// Initialize background task
		async init() {
			if (this.initialized) return;
			this.initialized = true;
			
			TidyUp.log('Background embedding task initialized');
			
			// Check if API configured
			if (!TidyUp.embeddingConfig.provider || !TidyUp.embeddingConfig.apiKey) {
				TidyUp.log('No embedding API configured, background task disabled');
				return;
			}
			
			// Delay start, wait for Zotero to load
			setTimeout(() => {
				this.startBackgroundCheck();
			}, 3000);
		},
		
		// Start background check
		async startBackgroundCheck() {
			TidyUp.log('Starting background cache check...');
			
			// Get all Collections
			const allCollections = await TidyUp.getAllCollections();
			TidyUp.log(`Found ${allCollections.length} collections to check`);
			
			// Test mode limit
			let collections = allCollections;
			if (TidyUp.testMode.enabled) {
				collections = allCollections.slice(0, TidyUp.testMode.maxCollections);
				TidyUp.log(`[TEST MODE] Checking ${collections.length} collections`);
			}
			
			// Check which need update
			const needsUpdateList = [];
			for (const collection of collections) {
				if (TidyUp.embeddingsCache.needsUpdate(collection.key, collection.name)) {
					needsUpdateList.push({
						collectionKey: collection.key,
						collectionId: collection.id,
						collectionName: collection.name,
						priority: 4,
						reason: 'startup-check'
					});
				}
			}
			
			TidyUp.log(`Found ${needsUpdateList.length} collections needing embedding update`);
			
			// Update stats
			this.stats.pendingCount = needsUpdateList.length;
			
			// Add to queue
			if (needsUpdateList.length > 0) {
				this.addToQueue(needsUpdateList);
				this.processQueue();
			}
		},
		
		// Add task to queue
		addToQueue(tasks) {
			if (!Array.isArray(tasks)) {
				tasks = [tasks];
			}
			
			for (const task of tasks) {
				// If already in queue, update priority
				if (this.pendingKeys.has(task.collectionKey)) {
					const existingIndex = this.queue.findIndex(t => t.collectionKey === task.collectionKey);
					if (existingIndex >= 0 && task.priority > this.queue[existingIndex].priority) {
						this.queue[existingIndex].priority = task.priority;
					}
				} else {
					this.queue.push(task);
					this.pendingKeys.add(task.collectionKey);
				}
			}
			
			TidyUp.log(`Queue updated: ${this.queue.length} tasks pending`);
		},
		
		// Process queue
		async processQueue() {
			if (this.running) {
				TidyUp.log('Queue processing already running');
				return;
			}
			
			this.running = true;
			const startTime = new Date();
			const initialQueueSize = this.queue.length;
			
			TidyUp.log('Starting queue processing...');
			
			// Show start processing notification
			TidyUp.showQueueStartNotification(initialQueueSize, startTime);
			
			while (this.queue.length > 0 && !this.paused) {
				// Sort by priority
				this.queue.sort((a, b) => b.priority - a.priority);
				
				// Take a batch of tasks
				const batch = this.queue.splice(0, this.config.batchSize);
				
				TidyUp.log(`Processing batch of ${batch.length} tasks`);
				
				for (const task of batch) {
					try {
						// Get Collection
						const collection = await Zotero.Collections.getAsync(task.collectionId);
						if (!collection) {
							TidyUp.log(`Collection ${task.collectionKey} not found, skipping`);
							this.pendingKeys.delete(task.collectionKey);
							continue;
						}
						
						// Update embedding
						const embedding = await TidyUp.updateCollectionEmbedding(collection);
						
						if (embedding) {
							TidyUp.log(`Updated embedding for "${task.collectionName}" (${task.reason})`);
							// Update stats: updated count
							this.stats.updatedCount++;
						} else {
							TidyUp.log(`Failed to update embedding for "${task.collectionName}" - API call returned null`);
						}
						
						this.pendingKeys.delete(task.collectionKey);
						
					} catch (e) {
						TidyUp.log(`Error processing task for "${task.collectionName}": ${e.message}`);
					}
					
					// Update stats: pending count
					this.stats.pendingCount = this.queue.length;
					
					// Delay to avoid rate limit
					await new Promise(resolve => setTimeout(resolve, this.config.batchDelay));
				}
				
				// Save cache
				await TidyUp.embeddingsCache.save();
			}
			
			this.running = false;
			const endTime = new Date();
			const duration = Math.round((endTime - startTime) / 1000);
			
			TidyUp.log('Queue processing completed');
			
			// Show completion notification
			TidyUp.showQueueCompleteNotification(initialQueueSize, this.stats, duration, endTime);
		},
		
		// Pause processing
		pause() {
			this.paused = true;
			TidyUp.log('Background task paused');
		},
		
		// Resume processing
		resume() {
			this.paused = false;
			TidyUp.log('Background task resumed');
			if (this.queue.length > 0) {
				this.processQueue();
			}
		},
		
		// Handle Collection change event
		async onCollectionChanged(event, collection) {
			TidyUp.log(`Collection changed: ${event} - "${collection.name}"`);
			
			// Set priority by event type
			let priority = 5;
			let reason = 'collection-changed';
			
			if (event === 'add') {
				priority = 5;
				reason = 'collection-added';
				// Update IDF index when Collection added
				TidyUp.idfWeighting.buildIndex();
			} else if (event === 'modify') {
				priority = 7;
				reason = 'collection-renamed';
				// Update IDF index when Collection renamed
				TidyUp.idfWeighting.buildIndex();
				// Update specificity (name change may affect Items)
				TidyUp.collectionSpecificity.updateSpecificity(collection);
			} else if (event === 'delete') {
				// Delete cache
				TidyUp.embeddingsCache.delete(collection.key);
				TidyUp.embeddingsCache.save();
				// Update IDF index when Collection deleted
				TidyUp.idfWeighting.buildIndex();
				// Delete specificity cache
				TidyUp.collectionSpecificity.removeSpecificity(collection.id);
				TidyUp.log(`Removed embedding for deleted collection "${collection.name}"`);
				return;
			}
			
			// Add to queue
			this.addToQueue({
				collectionKey: collection.key,
				collectionId: collection.id,
				collectionName: collection.name,
				priority: priority,
				reason: reason
			});
			
			// Start processing
			this.processQueue();
		}
	},

	// Initialize plugin
	async init({ id, version, rootURI }) {
		// Init log file (called on plugin start)
		this.initLogFile();
		
		if (this.initialized) return;
		this.id = id;
		this.version = version;
		this.rootURI = rootURI;
		this.initialized = true;
		
		// Load embedding API config from preferences
		this.loadEmbeddingConfig();
		
		// Load test mode config from preferences
		this.loadTestModeConfig();
		
		// Load Collection limit config from preferences
		this.loadMaxCollectionNumConfig();
		
		// Load LLM API config from preferences
		this.loadLlmConfig();
		
		// Init Collection type cache
		await this.collectionTypeCache.init(rootURI);
		
		// Pre-classify all Collection types
		await this.preClassifyAllCollections();
		
		// Init embedding cache
		await this.embeddingsCache.init(rootURI);
		
		// Init background precompute task
		this.backgroundEmbeddingTask.init();
		
		// Init blacklist cache
		await this.collectionBlacklist.init(rootURI);
		
		// Init IDF weighting system
		await this.idfWeighting.init(rootURI);
		
		// Init Collection specificity system
		await this.collectionSpecificity.init(rootURI);
		
		// Register Collection change listener
		this.registerCollectionListener();
	},
	
	// Register Collection change listener
	registerCollectionListener() {
		try {
			// Use Zotero notifier to listen for Collection changes
			const callback = {
				notify: async (event, type, ids, extraData) => {
					if (type !== 'collection') return;
					
					for (const id of ids) {
						try {
							const collection = await Zotero.Collections.getAsync(id);
							if (collection) {
								await this.backgroundEmbeddingTask.onCollectionChanged(event, collection);
							}
						} catch (e) {
							this.log(`Error handling collection event: ${e.message}`);
						}
					}
				}
			};
			
			// Register listener
			this.notifierID = Zotero.Notifier.registerObserver(callback, ['collection']);
			this.log('Collection change listener registered');
		} catch (e) {
			this.log(`Error registering collection listener: ${e.message}`);
		}
	},

	// Load test mode config from preferences
	loadTestModeConfig() {
		try {
			const enabled = Zotero.Prefs.get('extensions.tidy-up.testMode.enabled', true);
			const maxCollections = Zotero.Prefs.get('extensions.tidy-up.testMode.maxCollections', true);
			const mockApiResponses = Zotero.Prefs.get('extensions.tidy-up.testMode.mockApiResponses', true);
			
			// Only override default when preference has value
			if (enabled !== undefined && enabled !== null) {
				this.testMode.enabled = enabled;
			}
			if (maxCollections) {
				this.testMode.maxCollections = parseInt(maxCollections, 10);
			}
			if (mockApiResponses !== undefined && mockApiResponses !== null) {
				this.testMode.mockApiResponses = mockApiResponses;
			}
			
			this.log(`Test mode config loaded: enabled=${this.testMode.enabled}, maxCollections=${this.testMode.maxCollections}, mockApi=${this.testMode.mockApiResponses}`);
		} catch (e) {
			this.log(`Error loading test mode config: ${e.message}`);
		}
	},
	
	// Load Collection limit config from preferences
	loadMaxCollectionNumConfig() {
		try {
			const maxNum = Zotero.Prefs.get('extensions.tidy-up.maxCollectionNum', true);
			
			if (maxNum) {
				this.maxCollectionNum = parseInt(maxNum, 10);
				// Ensure within valid range
				if (this.maxCollectionNum < 1) this.maxCollectionNum = 1;
				if (this.maxCollectionNum > 20) this.maxCollectionNum = 20;
			}
			
			this.log(`Max collection num config loaded: ${this.maxCollectionNum}`);
		} catch (e) {
			this.log(`Error loading max collection num config: ${e.message}`);
		}
	},

	// Load embedding API config from preferences
	// Can auto-read from Zotero GPT plugin
	loadEmbeddingConfig() {
		try {
			// First try PaperRouter's own preferences
			let provider = Zotero.Prefs.get('extensions.tidy-up.embedding.provider', true) || null;
			let apiKey = Zotero.Prefs.get('extensions.tidy-up.embedding.apiKey', true) || null;
			let model = Zotero.Prefs.get('extensions.tidy-up.embedding.model', true) || null;
			let baseUrl = Zotero.Prefs.get('extensions.tidy-up.embedding.baseUrl', true) || null;
			
			if (provider && apiKey) {
				this.embeddingConfig = {
					provider: provider,
					apiKey: apiKey,
					model: model,
					baseUrl: baseUrl
				};
				this.log(`Loaded embedding config from PaperRouter prefs: provider=${provider}, model=${model || 'default'}`);
				return;
			}
			
			// If PaperRouter not configured, try Zotero GPT plugin
			this.log('No PaperRouter embedding config, trying Zotero GPT...');
			
			// Preference keys Zotero GPT may use
			const gptPrefKeys = [
				'extensions.zotero-gpt.secretKey',
				'extensions.zotero-gpt.api',
				'extensions.zotero-gpt.model',
				'extensions.zotero-gpt.baseUrl',
				'extensions.zotero-gpt.baseURL',
				'extensions.zotero-gpt.endpoint'
			];
			
			// Try to read Zotero GPT API Key
			let gptApiKey = null;
			let gptBaseUrl = null;
			let gptModel = null;
			
			for (const key of gptPrefKeys) {
				try {
					const value = Zotero.Prefs.get(key, true);
					if (value) {
						this.log(`Found Zotero GPT pref: ${key} = ${key.includes('secret') || key.includes('Key') ? '***' : value}`);
						if (key.includes('secret') || key.includes('Key')) {
							gptApiKey = value;
						} else if (key.includes('api') || key.includes('base') || key.includes('endpoint')) {
							gptBaseUrl = value;
						} else if (key.includes('model')) {
							gptModel = value;
						}
					}
				} catch (e) {
					// Ignore non-existent keys
				}
			}
			
			if (gptApiKey) {
				// Detect API type
				let detectedProvider = 'openai';
				if (gptBaseUrl) {
					if (gptBaseUrl.includes('cohere')) {
						detectedProvider = 'cohere';
					} else if (gptBaseUrl.includes('openai') || gptBaseUrl.includes('api.openai')) {
						detectedProvider = 'openai';
					} else {
						// Other API endpoints, assume OpenAI-compatible
						detectedProvider = 'openai';
					}
				}
				
				this.embeddingConfig = {
					provider: detectedProvider,
					apiKey: gptApiKey,
					model: gptModel || (detectedProvider === 'openai' ? 'text-embedding-3-small' : 'embed-multilingual-v3.0'),
					baseUrl: gptBaseUrl || (detectedProvider === 'openai' ? 'https://bapi.huiyan-ai.cn' : 'https://api.cohere.ai/v1')
				};
				this.log(`Loaded embedding config from Zotero GPT: provider=${detectedProvider}, baseUrl=${gptBaseUrl || 'default'}`);
			} else {
				this.log('No embedding API configured (PaperRouter or Zotero GPT), will use local cosine similarity');
			}
		} catch (e) {
			this.log(`Error loading embedding config: ${e.message}`);
		}
	},

	// Log file path
	logFilePath: null,
	
	// Output log to console and file
	log(msg) {
		Zotero.debug("PaperRouter: " + msg);
		try {
			console.log("PaperRouter: " + msg);
		} catch (e) {
		}
		
		// Write to log file
		try {
			if (!this.logFilePath) {
				// If log path not init'd, use default
				const profileDir = Zotero.getProfileDirectory();
				const now = new Date();
				// Use timestamp as filename: YYYYMMDD HHmmss
				const timestamp = now.getFullYear() +
					String(now.getMonth() + 1).padStart(2, '0') +
					String(now.getDate()).padStart(2, '0') +
					String(now.getHours()).padStart(2, '0') +
					String(now.getMinutes()).padStart(2, '0') +
					String(now.getSeconds()).padStart(2, '0');
				this.logFilePath = profileDir.clone();
				this.logFilePath.append('tidyup-log');
				
				// Create tidyup-log dir if not exists
				if (!this.logFilePath.exists()) {
					this.logFilePath.create(Ci.nsIFile.DIRECTORY_TYPE, 0o755);
				}
				
				this.logFilePath.append('tidyup-' + timestamp + '.log');
				
				// Create log file
				if (!this.logFilePath.exists()) {
					this.logFilePath.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0o600);
				}
			}
			
			// Write log
			const now = new Date();
			const timestamp = now.toISOString();
			const logLine = `[${timestamp}] ${msg}\n`;
			
			// Use TextEncoder for UTF-8, then nsIBinaryOutputStream for bytes
			const encoder = new TextEncoder();
			const data = encoder.encode(logLine);
			
			const foStream = Components.classes['@mozilla.org/network/file-output-stream;1']
				.createInstance(Components.interfaces.nsIFileOutputStream);
			foStream.init(this.logFilePath, 0x02 | 0x08 | 0x10, 0o600, 0);
			
			// Use nsIBinaryOutputStream to write bytes
			const bos = Components.classes['@mozilla.org/binaryoutputstream;1']
				.createInstance(Components.interfaces.nsIBinaryOutputStream);
			bos.setOutputStream(foStream);
			
			// Convert Uint8Array to plain array
			const byteArray = Array.from(data);
			bos.writeByteArray(byteArray, byteArray.length);
			
			bos.close();
			foStream.close();
		} catch (e) {
			// File write failure does not affect main flow
			Zotero.debug("PaperRouter: Failed to write log file: " + e.message);
		}
	},
	
	// Init log file (called on plugin start)
	initLogFile() {
		try {
			// Clear log path to force new file
			this.logFilePath = null;
			this.log('=== PaperRouter Plugin Started ===');
		} catch (e) {
			Zotero.debug("PaperRouter: Failed to init log file: " + e.message);
		}
	},

	// Add plugin UI to Zotero main window
	// Includes: toolbar button, context menu
	addToWindow(window) {
		this.log('addToWindow() called');
		let doc = window.document;
		this.log(`Document: ${doc}`);

		// Use TidyUpL10n for localization (no Fluent)
		this.log('Localization via TidyUpL10n');

		// Add toolbar button
		this.addToolbarButton(window);

		// Register context menu using new MenuManager API
		this.registerContextMenu();
		
		// Show load success notification (delayed for stats)
		setTimeout(() => {
			this.showLoadSuccessNotification();
		}, 3500);
	},
	
	// Show load success notification (with stats)
	showLoadSuccessNotification() {
		try {
			const popMsg = new Zotero.ProgressWindow({ closeOnClick: true });
			popMsg.changeHeadline('PaperRouter', "", (typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('notif-load-success') : 'Plugin loaded successfully'));
			
			// Main message
			const mainProg = new popMsg.ItemProgress(
				'chrome://zotero/skin/tick.png',
				(typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('notif-load-success') : 'Plugin loaded successfully')
			);
			mainProg.setProgress(100);
			
			// Show stats
			const stats = this.backgroundEmbeddingTask.stats;
			const cacheSize = this.embeddingsCache.size;
			
			// Cache status
			const cacheProg = new popMsg.ItemProgress(
				'chrome://zotero/skin/tick.png',
				(typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('notif-cache-count', { count: cacheSize }) : `Cache: ${cacheSize} Collection(s)`)
			);
			cacheProg.setProgress(100);
			
			// Pending queue
			if (stats.pendingCount > 0) {
				const pendingProg = new popMsg.ItemProgress(
					'chrome://zotero/skin/spinner-16px.png',
					(typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('notif-pending-count', { count: stats.pendingCount }) : `Pending queue: ${stats.pendingCount}`)
				);
				pendingProg.setProgress(0);
			}
			
			// Updated count
			if (stats.updatedCount > 0) {
				const updatedProg = new popMsg.ItemProgress(
					'chrome://zotero/skin/tick.png',
					(typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('notif-updated-count', { count: stats.updatedCount }) : `Updated: ${stats.updatedCount}`)
				);
				updatedProg.setProgress(100);
			}
			
			// API call stats
			if (stats.apiTotalCount > 0) {
				if (stats.apiFailCount > 0) {
					// Some failures
					const apiProg = new popMsg.ItemProgress(
						'chrome://zotero/skin/cross.png',
						(typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('notif-api-status', { success: stats.apiSuccessCount, total: stats.apiTotalCount }) : `API calls: ${stats.apiSuccessCount}/${stats.apiTotalCount} success`)
					);
					apiProg.setProgress(Math.round(stats.apiSuccessCount / stats.apiTotalCount * 100));
					
					// Show error info
					if (stats.lastApiError) {
						const errorText = stats.lastApiError.length > 80 
							? stats.lastApiError.substring(0, 80) + '...' 
							: stats.lastApiError;
						const errorProg = new popMsg.ItemProgress(
							'chrome://zotero/skin/cross.png',
							(typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('notif-api-error', { msg: errorText }) : `Error: ${errorText}`)
						);
						errorProg.setProgress(0);
					}
				} else {
					// All success
					const apiProg = new popMsg.ItemProgress(
						'chrome://zotero/skin/tick.png',
						(typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('notif-api-all-ok', { count: stats.apiTotalCount }) : `All ${stats.apiTotalCount} API call(s) succeeded`)
					);
					apiProg.setProgress(100);
				}
			}
			
			popMsg.show();
			popMsg.startCloseTimer(8000);
			
			this.log(`Load success notification shown: cache=${cacheSize}, pending=${stats.pendingCount}, updated=${stats.updatedCount}, api=${stats.apiSuccessCount}/${stats.apiTotalCount}`);
		} catch (e) {
			this.log(`Error showing load success notification: ${e.message}`);
		}
	},
	
	// Show notification
	showNotification(title, message, type = 'info') {
		try {
			const popMsg = new Zotero.ProgressWindow({ closeOnClick: true });
			popMsg.changeHeadline(title, "", "PaperRouter");
			
			// Choose icon by type
			let icon;
			switch (type) {
				case 'success':
					icon = 'chrome://zotero/skin/tick.png';
					break;
				case 'error':
					icon = 'chrome://zotero/skin/cross.png';
					break;
				case 'warning':
					icon = 'chrome://zotero/skin/warning.png';
					break;
				default:
					icon = 'chrome://zotero/skin/spinner-16px.png';
			}
			
			const prog = new popMsg.ItemProgress(icon, message);
			prog.setProgress(100);
			
			popMsg.show();
			popMsg.startCloseTimer(3000);
			
			this.log(`Notification shown: [${type}] ${title} - ${message}`);
		} catch (e) {
			this.log(`Error showing notification: ${e.message}`);
		}
	},
	
	// Show queue start notification
	showQueueStartNotification(queueSize, startTime) {
		try {
			const popMsg = new Zotero.ProgressWindow({ closeOnClick: true });
			popMsg.changeHeadline('PaperRouter', "", (typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('notif-queue-start') : 'Background task started'));
			
			// Start time
			const timeStr = startTime.toLocaleTimeString();
			const startProg = new popMsg.ItemProgress(
				'chrome://zotero/skin/spinner-16px.png',
				`Start time: ${timeStr}`
			);
			startProg.setProgress(0);
			
			// Queue size
			const queueProg = new popMsg.ItemProgress(
				'chrome://zotero/skin/tick.png',
				`Pending queue: ${queueSize} Collection(s)`
			);
			queueProg.setProgress(0);
			
			popMsg.show();
			popMsg.startCloseTimer(3000);
			
			this.log(`Queue start notification shown: queueSize=${queueSize}, startTime=${timeStr}`);
		} catch (e) {
			this.log(`Error showing queue start notification: ${e.message}`);
		}
	},
	
	// Show queue complete notification
	showQueueCompleteNotification(initialQueueSize, stats, duration, endTime) {
		try {
			const popMsg = new Zotero.ProgressWindow({ closeOnClick: true });
			popMsg.changeHeadline('PaperRouter', "", 'Background task completed');
			
			// Completion time
			const timeStr = endTime.toLocaleTimeString();
			const endProg = new popMsg.ItemProgress(
				'chrome://zotero/skin/tick.png',
				`End time: ${timeStr} (duration ${duration}s)`
			);
			endProg.setProgress(100);
			
			// Processing result
			const resultProg = new popMsg.ItemProgress(
				'chrome://zotero/skin/tick.png',
				`Updated: ${stats.updatedCount}/${initialQueueSize} Collection(s)`
			);
			resultProg.setProgress(Math.round(stats.updatedCount / initialQueueSize * 100));
			
			// API call stats
			if (stats.apiTotalCount > 0) {
				if (stats.apiFailCount > 0) {
					// Some failures
					const apiProg = new popMsg.ItemProgress(
						'chrome://zotero/skin/cross.png',
						(typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('notif-api-status', { success: stats.apiSuccessCount, total: stats.apiTotalCount }) : `API calls: ${stats.apiSuccessCount}/${stats.apiTotalCount} success`)
					);
					apiProg.setProgress(Math.round(stats.apiSuccessCount / stats.apiTotalCount * 100));
					
					// Show error info
					if (stats.lastApiError) {
						const errorText = stats.lastApiError.length > 60 
							? stats.lastApiError.substring(0, 60) + '...' 
							: stats.lastApiError;
						const errorProg = new popMsg.ItemProgress(
							'chrome://zotero/skin/cross.png',
							`Error: ${errorText}`
						);
						errorProg.setProgress(0);
					}
				} else {
					// All success
					const apiProg = new popMsg.ItemProgress(
						'chrome://zotero/skin/tick.png',
						(typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('notif-api-all-ok', { count: stats.apiTotalCount }) : `All ${stats.apiTotalCount} API call(s) succeeded`)
					);
					apiProg.setProgress(100);
				}
			}
			
			// Cache status
			const cacheSize = this.embeddingsCache.size;
			const cacheProg = new popMsg.ItemProgress(
				'chrome://zotero/skin/tick.png',
				`Cache: ${cacheSize} Collection(s)`
			);
			cacheProg.setProgress(100);
			
			popMsg.show();
			popMsg.startCloseTimer(8000);
			
			this.log(`Queue complete notification shown: updated=${stats.updatedCount}/${initialQueueSize}, api=${stats.apiSuccessCount}/${stats.apiTotalCount}, duration=${duration}s, cache=${cacheSize}`);
		} catch (e) {
			this.log(`Error showing queue complete notification: ${e.message}`);
		}
	},

	// Add toolbar button
	addToolbarButton(window) {
		let doc = window.document;
		
		// Find toolbar container
		let toolbar = doc.getElementById('zotero-toolbar');
		if (!toolbar) {
			this.log('Toolbar not found, trying alternative...');
			toolbar = doc.getElementById('zotero-items-toolbar');
		}
		if (!toolbar) {
			this.log('ERROR: No toolbar found for button');
			return;
		}
		
		this.log(`Found toolbar: ${toolbar.id}`);
		
		// Create toolbar button
		let toolbarButton = doc.createXULElement('toolbarbutton');
		toolbarButton.id = 'tidy-up-toolbar-button';
		toolbarButton.setAttribute('tooltiptext', 'PaperRouter - Smart add to collections');
		toolbarButton.style.listStyleImage = `url('${this.rootURI}chrome/content/icon.svg')`;
		toolbarButton.style.width = '28px';
		toolbarButton.style.height = '28px';
		toolbarButton.style.padding = '2px';
		toolbarButton.style.cursor = 'pointer';
		
		// Add click handler
		toolbarButton.addEventListener('click', async () => {
			// Check if button disabled
			if (toolbarButton.disabled) {
				this.log('Toolbar button is disabled, ignoring click');
				return;
			}
			this.log('Toolbar button clicked');
			await this.showSimpleDialog();
		});
		
		// Add to toolbar
		toolbar.appendChild(toolbarButton);
		this.storeAddedElement(toolbarButton);
		this.log('Toolbar button added successfully');
		
		// Listen for Item selection changes, update button
		this.setupToolbarButtonStateListener(window);
		
		// Init button state
		this.updateToolbarButtonState(window);
	},

	// Set toolbar button state listener
	setupToolbarButtonStateListener(window) {
		// Use timer to check selection (most reliable)
		this.log('Setting up selection check interval');
		this._selectionCheckInterval = setInterval(() => {
			this.updateToolbarButtonState(window);
		}, 300);
		
		// Also try ZoteroPane selection events
		setTimeout(() => {
			try {
				if (window.ZoteroPane && window.ZoteroPane.itemsView) {
					this.log('Found ZoteroPane.itemsView, adding listener');
					window.ZoteroPane.itemsView.onSelect = () => {
						this.log('ZoteroPane.itemsView.onSelect fired');
						this.updateToolbarButtonState(window);
					};
				}
			} catch (e) {
				this.log(`Error setting up itemsView listener: ${e.message}`);
			}
		}, 1000);
	},

	// Update toolbar button state
	updateToolbarButtonState(window) {
		let doc = window.document;
		let toolbarButton = doc.getElementById('tidy-up-toolbar-button');
		
		if (!toolbarButton) {
			// Reduce log spam
			if (!this._toolbarButtonNotFoundLogged) {
				this.log('Toolbar button not found in updateToolbarButtonState');
				this._toolbarButtonNotFoundLogged = true;
			}
			return;
		}
		
		// Reset flag
		this._toolbarButtonNotFoundLogged = false;
		
		// Check if any Item selected
		let hasSelection = false;
		try {
			// Method 1: window.ZoteroPane
			if (window.ZoteroPane) {
				let selectedItems = window.ZoteroPane.getSelectedItems();
				// this.log(`Selected items count: ${selectedItems ? selectedItems.length : 0}`);
				hasSelection = selectedItems && selectedItems.length > 0;
			}
			
			// Method 2: fallback - Zotero.getActiveZoteroPane()
			if (!hasSelection) {
				let ZoteroPane = Zotero.getActiveZoteroPane();
				if (ZoteroPane) {
					let selectedItems = ZoteroPane.getSelectedItems();
					// this.log(`Active pane selected items count: ${selectedItems ? selectedItems.length : 0}`);
					hasSelection = selectedItems && selectedItems.length > 0;
				}
			}
		} catch (e) {
			this.log(`Error checking selection: ${e.message}`);
		}
		
		//this.log(`hasSelection: ${hasSelection}`);
		
		// Update button state
		if (hasSelection) {
			toolbarButton.disabled = false;
			toolbarButton.style.listStyleImage = `url('${this.rootURI}chrome/content/icon.svg')`;
			toolbarButton.style.cursor = 'pointer';
			toolbarButton.style.opacity = '1';
			// this.log('Button state: enabled');
		} else {
			toolbarButton.disabled = true;
			toolbarButton.style.listStyleImage = `url('${this.rootURI}chrome/content/icon-disabled.svg')`;
			toolbarButton.style.cursor = 'not-allowed';
			toolbarButton.style.opacity = '0.5';
			// this.log('Button state: disabled');
		}
	},

	// Add plugin to all main windows (first valid only)
	addToOneWindows() {
		this.log('Adding to all windows...');
		var windows = Zotero.getMainWindows();
		this.log(`Found ${windows.length} main windows`);
		for (let win of windows) {
			if (!win.ZoteroPane) {
				this.log('Skipping window without ZoteroPane');
				continue;
			}
			this.log(`Adding to window: ${win.location}`);
			this.addToWindow(win);
			break;
		}
	},

	// Store added DOM element IDs for cleanup on unload
	storeAddedElement(elem) {
		if (!elem.id) {
			throw new Error("Element must have an id");
		}
		this.addedElementIDs.push(elem.id);
	},

	// Remove plugin UI from window
	removeFromWindow(window) {
		var doc = window.document;

		// Unregister menu if using MenuManager API
		if (this.menuID && Zotero.MenuManager && Zotero.MenuManager.unregisterMenu) {
			try {
				Zotero.MenuManager.unregisterMenu(this.menuID);
				this.log('Unregistered context menu using MenuManager API');
			} catch (error) {
				this.log(`Failed to unregister menu: ${error}`);
			}
		}

		// Remove all elements added to DOM
		for (let id of this.addedElementIDs) {
			doc.getElementById(id)?.remove();
		}
		// Fluent deprecated
	},

	// Remove plugin UI from all windows
	removeFromAllWindows() {
		var windows = Zotero.getMainWindows();
		for (let win of windows) {
			if (!win.ZoteroPane) continue;
			this.removeFromWindow(win);
		}
	},

	// Get all Collections from all libraries (flat list)
	async getAllCollections() {
		try {
			const libraries = Zotero.Libraries.getAll();
			this.log(`getAllCollections: Found ${libraries.length} libraries`);
			let allCollections = [];
			for (let library of libraries) {
				this.log(`getAllCollections: Getting collections for library ${library.libraryID}`);
				const collections = await Zotero.Collections.getByLibrary(library.libraryID);
				this.log(`getAllCollections: Library ${library.libraryID} has ${collections ? collections.length : 0} collections`);
				if (collections && collections.length > 0) {
					allCollections = allCollections.concat(collections);
				}
			}
			this.log(`getAllCollections: Total ${allCollections.length} collections`);
			return allCollections;
		} catch (error) {
			this.log(`Error getting collections: ${error}`);
			this.log(`Stack: ${error.stack}`);
			return [];
		}
	},

	// Get Collections as tree
	async getAllCollectionsTree() {
		try {
			const libraries = Zotero.Libraries.getAll();
			this.log(`getAllCollectionsTree: Found ${libraries.length} libraries`);
			
			let allTrees = [];
			
			for (let library of libraries) {
				this.log(`getAllCollectionsTree: Processing library ${library.libraryID} (${library.name})`);
				
				// Get root-level Collections
				const rootCollections = await Zotero.Collections.getByLibrary(library.libraryID, false);
				this.log(`getAllCollectionsTree: Library ${library.libraryID} has ${rootCollections.length} root collections`);
				
				for (let rootCol of rootCollections) {
					const tree = await this.buildCollectionTree(rootCol);
					allTrees.push(tree);
				}
			}
			
			this.log(`getAllCollectionsTree: Returning ${allTrees.length} total root trees`);
			return allTrees;
		} catch (error) {
			this.log(`Error getting collections tree: ${error}`);
			this.log(`Stack: ${error.stack}`);
			return [];
		}
	},

	// Recursively build Collection tree
	async buildCollectionTree(collection, parentId = null, parentNode = null) {
		const node = {
			id: collection.id,
			key: collection.key,
			name: collection.name,
			libraryID: collection.libraryID,
			confidence: 0,
			parentId: parentId,  // Record parent node ID
			parent: parentNode,  // Record parent reference
			children: []
		};
		
		// Get child Collections
		const childCollections = await Zotero.Collections.getByParent(collection.id);
		
		for (let child of childCollections) {
			const childNode = await this.buildCollectionTree(child, collection.id, node);
			node.children.push(childNode);
		}
		
		return node;
	},

	// Compute similarity for tree Collections
	async calculateTreeSimilarity(trees, itemName, blacklist = new Set()) {
		for (let node of trees) {
			// Check if blacklisted
			if (blacklist.has(node.id)) {
				node.confidence = 0;  // Blacklisted = 0 similarity
			} else if (itemName) {
				const rawSimilarity = this.cosineSimilarity(itemName, node.name);
				// Apply rejection rate penalty
				let adjustedSimilarity = this.collectionBlacklist.applyRejectionPenalty(node.id, rawSimilarity);
				// Apply IDF weight
				adjustedSimilarity = this.idfWeighting.applyIDFWeight(node.id, node.name, adjustedSimilarity);
				// Apply specificity weight (from cache, sync)
				adjustedSimilarity = this.collectionSpecificity.applySpecificityWeightById(node.id, node.name, adjustedSimilarity);
				
				// Get Collection type (external vs internal)
				if (this.classificationConfig.algorithm === 'vector') {
					try {
						// Get Collection type from cache (ID to string)
						let collectionType = this.collectionTypeCache.get(node.id.toString());
						if (!collectionType) {
							// If not in cache, call LLM API to pre-classify
							this.log(`Collection "${node.name}" not in cache, classifying with LLM API`);
							try {
								// Get Collection object
								const collection = await Zotero.Collections.getAsync(node.id);
								if (collection) {
									// Get Collection description
									const collectionDescription = collection.getField('abstract') || '';
									// Get items in Collection
									const collectionItems = await collection.getChildItems();
									// Call classification function
									collectionType = await this.classifyCollectionType(node.name, collectionDescription, collectionItems);
									// Cache classification result
									this.collectionTypeCache.set(node.id.toString(), collectionType);
									this.log(`Collection "${node.name}" classified as ${collectionType}, saved to cache`);
								} else {
									// If cannot get Collection, use default type
									collectionType = 'default';
									this.log(`Collection "${node.name}" not found, using default type`);
								}
							} catch (e) {
								// If classification fails, use default type
								collectionType = 'default';
								this.log(`Error classifying collection "${node.name}": ${e.message}, using default type`);
							}
						} else {
							this.log(`Collection "${node.name}" type from cache: ${collectionType}`);
						}
						node.collectionType = collectionType;
						
						// Apply Collection type weight (priority 1: differentiated by type)
						// External-type: lower weight (0.7x)
						// Internal-type: higher weight (1.3x)
						if (collectionType === 'external') {
							adjustedSimilarity *= 0.7;
							this.log(`Collection "${node.name}" is external, weight adjusted: ${adjustedSimilarity.toFixed(4)}`);
						} else if (collectionType === 'internal') {
							adjustedSimilarity *= 1.3;
							this.log(`Collection "${node.name}" is internal, weight adjusted: ${adjustedSimilarity.toFixed(4)}`);
						}
					} catch (e) {
						this.log(`Error getting collection type for "${node.name}": ${e.message}`);
						node.collectionType = 'default';
					}
				}
				
				node.confidence = adjustedSimilarity;
			} else {
				node.confidence = 0;
			}
			
			if (node.children && node.children.length > 0) {
				this.calculateTreeSimilarity(node.children, itemName, blacklist);
			}
		}
	},

	// Sort tree Collections by similarity
	sortTreeBySimilarity(trees) {
		trees.sort((a, b) => b.confidence - a.confidence);
		
		for (let node of trees) {
			if (node.children && node.children.length > 0) {
				this.sortTreeBySimilarity(node.children);
			}
		}
	},

	// Extract all Collection IDs from tree
	getAllCollectionIdsFromTree(trees) {
		const ids = new Set();
		
		function collectIds(nodes) {
			for (const node of nodes) {
				if (node.key) {
					ids.add(parseInt(node.key, 10));
				}
				if (node.children && node.children.length > 0) {
					collectIds(node.children);
				}
			}
		}
		
		collectIds(trees);
		return ids;
	},

	// Sort Collections by semantic similarity to Item name (tree structure)
	// v2.6.2: use cache directly, no longer update on click
	async SortCollectionsByItemName(itemName, blacklist = new Set(), itemAbstract = '') {
		const t0 = Date.now();
		this.log(`SortCollectionsByItemName: Starting with item name "${itemName}", blacklist size: ${blacklist.size}`);
		
		const trees = await this.getAllCollectionsTree();
		this.log(`[TIMING] getAllCollectionsTree: ${(Date.now() - t0).toFixed(0)}ms (${trees.length} roots)`);
		
		let t1 = Date.now();
		// Check if using zero-shot classification
		if (this.classificationConfig.algorithm === 'zeroshot' && this.llmConfig.provider && this.llmConfig.apiKey) {
			this.log('Using zero-shot classification with LLM');
			
			// Collect all Collections (flatten)
			const allCollections = [];
			function collectCollections(nodes) {
				for (const node of nodes) {
					allCollections.push(node);
					if (node.children && node.children.length > 0) {
						collectCollections(node.children);
					}
				}
			}
			collectCollections(trees);
			
			// Call zero-shot classification
			const classifications = await this.classifyItemWithZeroShot(itemName, itemAbstract, allCollections, 3);
			this.log(`[TIMING] classifyItemWithZeroShot: ${(Date.now() - t1).toFixed(0)}ms`);
			
			if (classifications && classifications.length > 0) {
				// Apply zero-shot result
				for (const cls of classifications) {
					const collection = cls.collection;
					if (collection) {
						collection.confidence = cls.confidence;
						this.log(`Zero-shot: Collection "${collection.name}" confidence = ${cls.confidence.toFixed(4)}`);
					}
				}
				
				// Unclassified Collections = 0
				for (const collection of allCollections) {
					if (!classifications.find(c => c.collection.id === collection.id)) {
						collection.confidence = 0;
					}
				}
			} else {
				// Zero-shot failed, fallback to similarity
				this.log('Zero-shot classification failed, falling back to similarity calculation');
				t1 = Date.now();
				await this.calculateTreeSimilarity(trees, itemName, blacklist);
				this.log(`[TIMING] calculateTreeSimilarity: ${(Date.now() - t1).toFixed(0)}ms`);
			}
		} else {
			// Check if embedding API configured and cache has data
			const hasEmbeddingConfig = this.embeddingConfig.provider && this.embeddingConfig.apiKey;
			const cacheSize = this.embeddingsCache.size;
			
			if (hasEmbeddingConfig && cacheSize > 0) {
				this.log(`Using embedding-based similarity (cache: ${cacheSize} entries)`);
				// Use cached embeddings for similarity
				await this.calculateTreeSimilarityWithEmbedding(trees, itemName, blacklist);
				this.log(`[TIMING] calculateTreeSimilarityWithEmbedding: ${(Date.now() - t1).toFixed(0)}ms`);
			} else if (hasEmbeddingConfig) {
				this.log('Embedding API configured but cache is empty, using local cosine similarity');
				// Cache empty, use local cosine similarity
				await this.calculateTreeSimilarity(trees, itemName, blacklist);
				this.log(`[TIMING] calculateTreeSimilarity: ${(Date.now() - t1).toFixed(0)}ms`);
			} else {
				this.log('Using local cosine similarity');
				// Use local cosine similarity
				await this.calculateTreeSimilarity(trees, itemName, blacklist);
				this.log(`[TIMING] calculateTreeSimilarity: ${(Date.now() - t1).toFixed(0)}ms`);
			}
		}
		
		// Sort by similarity
		let t2 = Date.now();
		this.sortTreeBySimilarity(trees);
		this.log(`[TIMING] sortTreeBySimilarity: ${(Date.now() - t2).toFixed(0)}ms`);
		
		// Apply hierarchy optimization (incl. normalization)
		t2 = Date.now();
		this.applyHierarchyOptimization(trees);
		this.log(`[TIMING] applyHierarchyOptimization: ${(Date.now() - t2).toFixed(0)}ms`);
		
		// Filter concept hierarchy (keep only leaf Collections)
		t2 = Date.now();
		this.filterHierarchyRelationships(trees);
		this.log(`[TIMING] filterHierarchyRelationships: ${(Date.now() - t2).toFixed(0)}ms`);
		
		// Count total
		let count = 0;
		function countNodes(nodes) {
			for (let node of nodes) {
				count++;
				if (node.children && node.children.length > 0) {
					countNodes(node.children);
				}
			}
		}
		countNodes(trees);
		
		this.log(`[TIMING] SortCollectionsByItemName TOTAL: ${(Date.now() - t0).toFixed(0)}ms`);
		this.log(`SortCollectionsByItemName: Total ${count} collections in tree`);
		
		return trees;
	},

	// Normalize similarity scores to [0, 1]
	// Top5 rule: avg of top 5 as baseline, normalized Top5 avg ~0.8
	normalizeSimilarityScores(trees) {
		// Collect all scores
		function collectScores(nodes, scores) {
			for (const node of nodes) {
				if (node.confidence > 0) {
					scores.push(node.confidence);
				}
				if (node.children && node.children.length > 0) {
					collectScores(node.children, scores);
				}
			}
		}
		
		const allScores = [];
		collectScores(trees, allScores);
		
		if (allScores.length === 0) {
			return;
		}
		
		// Sort and get Top5
		const sortedScores = [...allScores].sort((a, b) => b - a);
		const top5 = sortedScores.slice(0, 5);
		const top5Avg = top5.length > 0 
			? top5.reduce((a, b) => a + b, 0) / top5.length 
			: 1;
		
		// Normalization factor: Top5 avg ~0.8 after norm
		// normalizationFactor = top5Avg / 0.8
		const normalizationFactor = top5Avg / 0.8;
		
		this.log(`Normalizing scores: top5Avg=${top5Avg.toFixed(4)}, factor=${normalizationFactor.toFixed(4)}`);
		
		// Apply normalization
		function normalizeNodes(nodes) {
			for (const node of nodes) {
				if (node.confidence > 0) {
					node.confidence = node.confidence / normalizationFactor;
					// Ensure not exceeding 1.0
					node.confidence = Math.min(node.confidence, 1.0);
				}
				if (node.children && node.children.length > 0) {
					normalizeNodes(node.children);
				}
			}
		}
		normalizeNodes(trees);
		
		// Record normalized Top5
		const normalizedScores = [];
		collectScores(trees, normalizedScores);
		const normalizedSorted = normalizedScores.sort((a, b) => b - a).slice(0, 5);
		this.log(`Normalized top5 scores: ${normalizedSorted.map(s => s.toFixed(4)).join(', ')}`);
	},

	// Hierarchy utilization
	// 1. Parent score inheritance: child's high score boosts parent
	// 2. Hierarchy diversity: avoid recommending multiple Collections on same branch
	applyHierarchyOptimization(trees) {
		const self = this;  // Save this reference
		
		// Build ID to node map
		const nodeMap = new Map();
		function buildNodeMap(nodes) {
			for (const node of nodes) {
				nodeMap.set(node.id, node);
				if (node.children && node.children.length > 0) {
					buildNodeMap(node.children);
				}
			}
		}
		buildNodeMap(trees);
		
		// Priority 3: hierarchy-aware classification (top-down)
		// Match parent first, then child
		// If parent matches well, reduce child score (avoid duplicate)
		function applyTopDownClassification(nodes, parentScore = 0) {
			for (const node of nodes) {
				if (node.confidence > 0) {
					// If parent score high, reduce child score
					if (parentScore > 0.5) {
						// Higher parent score = heavier child penalty
						const penaltyFactor = 1.0 - (parentScore * 0.5);
						const originalScore = node.confidence;
						node.confidence = node.confidence * penaltyFactor;
						self.log(`Top-Down: Child "${node.name}" penalized by parent (score: ${originalScore.toFixed(4)} -> ${node.confidence.toFixed(4)})`);
					}
					
					// Recursively process children
					if (node.children && node.children.length > 0) {
						applyTopDownClassification(node.children, node.confidence);
					}
				}
			}
		}
		
		for (const tree of trees) {
			applyTopDownClassification(tree.children, tree.confidence);
		}
		
		// 1. Parent score inheritance
		// Propagate score from leaves upward
		// Note: external-type Collections don't inherit child scores (preserve weight reduction)
		function propagateScoreToParent(node) {
			if (node.children && node.children.length > 0) {
				let maxChildScore = 0;
				let sumChildScore = 0;
				
				for (const child of node.children) {
					propagateScoreToParent(child);
					maxChildScore = Math.max(maxChildScore, child.confidence);
					sumChildScore += child.confidence;
				}
				
				// Parent score = max(self, childMax × inheritance factor)
				// Factor 0.7: 70% of child score to parent
				// External-type Collections don't inherit (preserve weight reduction)
				if (node.collectionType === 'external') {
					// External-type doesn't inherit child score
					self.log(`Hierarchy: Parent "${node.name}" is external, not inheriting score from children`);
				} else {
					const inheritedScore = maxChildScore * 0.7;
					const originalScore = node.confidence;
					
					// If child score higher, boost parent
					if (inheritedScore > originalScore) {
						node.confidence = inheritedScore;
						self.log(`Hierarchy: Parent "${node.name}" inherited score ${inheritedScore.toFixed(4)} from children (original: ${originalScore.toFixed(4)})`);
					}
				}
			}
		}
		
		for (const tree of trees) {
			propagateScoreToParent(tree);
		}
		
		// 2. Hierarchy diversity
		// Diversity among siblings under same parent
		// If one sibling scores high, reduce others
		function applyDiversityPenalty(nodes) {
			if (!nodes || nodes.length <= 1) return;
			
			// Find highest-scoring node
			let maxNode = nodes[0];
			for (const node of nodes) {
				if (node.confidence > maxNode.confidence) {
					maxNode = node;
				}
			}
			
			// Apply diversity penalty to siblings
			for (const node of nodes) {
				if (node.id !== maxNode.id && node.confidence > 0) {
					// Penalty: larger gap from top = heavier penalty
					const scoreRatio = node.confidence / maxNode.confidence;
					const penaltyFactor = 0.8;  // Sibling penalty factor
					node.confidence = node.confidence * (penaltyFactor + (1 - penaltyFactor) * scoreRatio);
				}
				
				// Recursively process children
				if (node.children && node.children.length > 0) {
					applyDiversityPenalty(node.children);
				}
			}
		}
		
		for (const tree of trees) {
			applyDiversityPenalty(tree.children);
		}
		
		// Re-normalize (hierarchy optimization may change score range)
		this.normalizeSimilarityScores(trees);
	},

	// Filter concept hierarchy
	// If parent-child exists, keep only leaf Collections
	// E.g. AI -> agent -> agentic, keep only agentic
	filterHierarchyRelationships(trees) {
		const self = this;
		
		// Collect all nodes and scores
		const allNodes = [];
		function collectNodes(nodes) {
			for (const node of nodes) {
				if (node.confidence > 0) {
					allNodes.push(node);
				}
				if (node.children && node.children.length > 0) {
					collectNodes(node.children);
				}
			}
		}
		collectNodes(trees);
		
		// Sort by score descending
		allNodes.sort((a, b) => b.confidence - a.confidence);
		
		// Collect node IDs to filter (ancestors)
		const filteredIds = new Set();
		
		// For each high-scoring node, check if ancestors in list
		for (const node of allNodes) {
			if (filteredIds.has(node.id)) {
				// Already filtered, skip
				continue;
			}
			
			// Check all ancestors of this node
			const ancestors = this.getAncestorNodes(node);
			for (const ancestor of ancestors) {
				if (ancestor.confidence > 0 && !filteredIds.has(ancestor.id)) {
					// Ancestor also recommended, filter ancestor
					filteredIds.add(ancestor.id);
					self.log(`Hierarchy filtering: Filtering out ancestor "${ancestor.name}" (score: ${ancestor.confidence.toFixed(4)}) in favor of descendant "${node.name}" (score: ${node.confidence.toFixed(4)})`);
				}
			}
		}
		
		// Set filtered nodes' score to 0
		function applyFilter(nodes) {
			for (const node of nodes) {
				if (filteredIds.has(node.id)) {
					self.log(`Hierarchy filtering: Setting score of "${node.name}" to 0 (has descendant with higher specificity)`);
					node.confidence = 0;
				}
				if (node.children && node.children.length > 0) {
					applyFilter(node.children);
				}
			}
		}
		applyFilter(trees);
		
		this.log(`Hierarchy filtering completed: ${filteredIds.size} ancestor collections filtered out`);
	},
	
	// Get all ancestors of node (parent to root)
	getAncestorNodes(node) {
		const ancestors = [];
		let current = node.parent;
		while (current) {
			ancestors.push(current);
			current = current.parent;
		}
		return ancestors;
	},

	// Register context menu
	registerContextMenu() {
		this.log('Starting context menu registration...');

		// Always use the fallback method since MenuManager API has issues in Zotero 8.0
		this.log('Using fallback XUL method for context menu');
		this.addItemContextMenuFallback();
	},

	// Add context menu item via XUL (Zotero 7/8 compatible)
	addItemContextMenuFallback() {
		this.log('Starting fallback context menu addition...');

		// Fallback method for Zotero 7.x or if MenuManager fails
		const window = Zotero.getMainWindow();
		const doc = window.document;

		this.log(`Current window: ${window}`);
		this.log(`Document: ${doc}`);

		// Find the item context menu - try multiple possible IDs
		let itemMenu = doc.getElementById('zotero-itemmenu');
		if (!itemMenu) {
			this.log('zotero-itemmenu not found, trying other IDs...');
			itemMenu = doc.getElementById('zotero-items-tree-context');
			if (!itemMenu) {
				this.log('zotero-items-tree-context not found, trying popup menu...');
				itemMenu = doc.querySelector('#zotero-items-tree menupopup');
				if (!itemMenu) {
					this.log('ERROR: Could not find any item context menu');
					return;
				}
			}
		}

		this.log(`Found context menu: ${itemMenu.tagName}#${itemMenu.id}`);

		// Check if our menu already exists
		if (doc.getElementById('tidy-up-context-menuitem')) {
			this.log('Menu item already exists, removing first...');
			doc.getElementById('tidy-up-context-menuitem').remove();
		}
		if (doc.getElementById('tidy-up-context-separator')) {
			doc.getElementById('tidy-up-context-separator').remove();
		}

		// Always append to end to avoid affecting Zotero's native menu items
		// (Inserting after "Add to collection" could interfere with Fluent/l10n in Zotero 8)
		this.log('Appending menu item to end');

		// Create separator
		let separator = doc.createXULElement('menuseparator');
		separator.id = 'tidy-up-context-separator';

		// Create menu item (use TidyUpL10n for user-selectable language)
		let contextMenuitem = doc.createXULElement('menuitem');
		contextMenuitem.id = 'tidy-up-context-menuitem';
		contextMenuitem.setAttribute('label', (typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getString('menu-send-to-collections') : 'Send to collections...'));

		// Use command event instead of click
		contextMenuitem.addEventListener('command', async () => {
			this.log('Context menu item clicked!');
			
			try {
				// Delay to allow menu to close first
				await Zotero.Promise.delay(50);
				this.log('About to call showSimpleDialog...');
				await this.showSimpleDialog();
				this.log('showSimpleDialog completed');
			} catch (e) {
				this.log(`Error in menu handler: ${e.message}`);
				this.log(`Stack: ${e.stack}`);
				
				// Show error to user
				try {
					const Services = window.Services;
					if (Services && Services.prompt) {
						Services.prompt.alert(window, 'PaperRouter Error', `Error: ${e.message}\n\nStack: ${e.stack}`);
					}
				} catch (alertErr) {
					this.log(`Alert failed: ${alertErr.message}`);
				}
			}
		});

		// Append to end
		itemMenu.appendChild(separator);
		itemMenu.appendChild(contextMenuitem);

		// Verify menu item was added
		const addedItem = doc.getElementById('tidy-up-context-menuitem');
		if (addedItem) {
			this.log(`Menu item verified in DOM: ${addedItem.tagName}#${addedItem.id}`);
			this.log(`Menu item label: ${addedItem.getAttribute('label')}`);
		} else {
			this.log('ERROR: Menu item not found in DOM after insertion!');
		}

		this.storeAddedElement(separator);
		this.storeAddedElement(contextMenuitem);
		this.log('Context menu item added successfully');
	},

	// Show Collections selection dialog
	async showSimpleDialog() {
		const tStart = Date.now();
		// Prevent duplicate open
		if (this.dialogOpen) {
			this.log('showSimpleDialog: Dialog already open, ignoring');
			return;
		}
		this.dialogOpen = true;
		
		this.log('showSimpleDialog: Starting...');
		
		try {
			// Get currently selected item
			var selectedItem = null;
			var selectedItemName = '';
			try {
				var ZoteroPane = Zotero.getActiveZoteroPane();
				if (ZoteroPane) {
					var selectedItems = ZoteroPane.getSelectedItems();
					if (selectedItems && selectedItems.length > 0) {
						selectedItem = selectedItems[0];
						selectedItemName = selectedItem.getDisplayTitle() || selectedItem.getField('title') || 'Untitled';
					}
				}
			} catch (e) {
				this.log('Error getting selected item: ' + e.message);
			}
			this.log(`[TIMING] getSelectedItem: ${(Date.now() - tStart).toFixed(0)}ms`);
		
		// Get Item abstract
		var selectedItemAbstract = '';
		if (selectedItem) {
			selectedItemAbstract = selectedItem.getField('abstractNote') || '';
		}
		
		// Get blacklist for current item
		const itemId = selectedItem ? selectedItem.id : null;
		const itemBlacklist = itemId ? this.collectionBlacklist.getBlacklist(itemId) : new Set();
		
		// Get Collection IDs Item belongs to
		const existingCollectionIds = selectedItem ? selectedItem.getCollections() : [];
		this.log(`showSimpleDialog: Item already belongs to ${existingCollectionIds.length} collections`);
		
		// Call sort function, get similarity-sorted collections tree
		let collectionData = [];
		try {
			const tBeforeSort = Date.now();
			this.log('showSimpleDialog: Calling SortCollectionsByItemName...');
			collectionData = await this.SortCollectionsByItemName(selectedItemName, itemBlacklist, selectedItemAbstract);
			this.log(`[TIMING] SortCollectionsByItemName: ${(Date.now() - tBeforeSort).toFixed(0)}ms`);
			this.log(`showSimpleDialog: Got ${collectionData.length} root collections`);
		} catch (e) {
			this.log(`showSimpleDialog: Error in SortCollectionsByItemName: ${e.message}`);
			this.log(`showSimpleDialog: Stack: ${e.stack}`);
		}
		
		this.log(`[TIMING] totalBeforeOpenDialog: ${(Date.now() - tStart).toFixed(0)}ms`);
			
			// Prepare dialog arguments
			var effectiveLang = (typeof TidyUpL10n !== 'undefined' ? TidyUpL10n.getEffectiveLanguage() : 'zh-CN');
			var dialogArgs = {
				collections: collectionData,
				selectedCollections: null,
				sendToCollections: false,
				itemName: selectedItemName,
				itemId: itemId,
				blacklist: Array.from(itemBlacklist),
				existingCollections: existingCollectionIds,  // Collection IDs Item belongs to
				maxCollectionNum: this.maxCollectionNum,  // Max Collections per Item
				language: effectiveLang  // Pass language for dialog i18n
			};
			
			this.log('showSimpleDialog: Opening dialog...');
			
			// Open dialog
			try {
				var mainWindow = Zotero.getMainWindow();
				if (!mainWindow) {
					this.log('showSimpleDialog: Main window is null, cannot open dialog');
					return;
				}
				// Use empty string as window name to avoid duplicate open
				mainWindow.openDialog(
					'chrome://tidy-up-trae/content/collectionsDialog.xhtml',
					'',  // Empty string avoids window name conflict
					'chrome,centerscreen,modal,resizable',
					dialogArgs
				);
			} catch (e) {
				this.log(`showSimpleDialog: Error opening dialog: ${e.message}`);
				this.log(`showSimpleDialog: Stack: ${e.stack}`);
				return;
			}
			
			this.log('showSimpleDialog: Dialog closed');
			
			// Record all recommended Collections (for rejection rate)
			const allRecommendedCollections = this.getAllCollectionIdsFromTree(collectionData);
			for (const collectionId of allRecommendedCollections) {
				this.collectionBlacklist.recordRecommendation(collectionId);
			}
			
			// Save blacklist changes
			if (dialogArgs.blacklistChanges && selectedItem) {
				this.log(`Saving blacklist changes for item ${selectedItem.id}`);
				for (let change of dialogArgs.blacklistChanges) {
					await this.collectionBlacklist.updateBlacklist(
						selectedItem.id,
						change.collectionId,
						change.isBlacklisted
					);
				}
			}
			
			// Save recommendation stats
			await this.collectionBlacklist.save();
			
			// Handle result
			if (dialogArgs.sendToCollections && dialogArgs.selectedCollections) {
				this.log(`User clicked "Send to ..." with ${dialogArgs.selectedCollections.length} collections`);
				if (selectedItem) {
					await this.sendItemToCollections(selectedItem, dialogArgs.selectedCollections);
				}
			} else if (dialogArgs.selectedCollections) {
				this.log(`User selected ${dialogArgs.selectedCollections.length} collections`);
				for (let col of dialogArgs.selectedCollections) {
					this.log(`  - ${col.name} (confidence: ${col.confidence.toFixed(4)})`);
				}
			} else {
				this.log('User cancelled the dialog');
			}
		} finally {
			// Ensure progress dialog closed
			this.closeProgressDialog();
			// Reset flag
			this.dialogOpen = false;
			this.log('showSimpleDialog: Completed');
		}
	},

	// Reset Item's Collections to user-selected ones
	async sendItemToCollections(item, collections) {
		this.log(`sendItemToCollections: Resetting item "${item.getDisplayTitle()}" to ${collections.length} collections`);
		
		try {
			// Get all Collections Item currently belongs to
			let currentCollections = item.getCollections();
			this.log(`  Current collections: ${currentCollections.length}`);
			
			// User-selected new Collection IDs
			let newCollectionIds = new Set(collections.map(c => parseInt(c.id, 10)));
			
			// Execute DB ops in transaction
			await Zotero.DB.executeTransaction(async () => {
				// 1. Remove Item from old Collections (not in new selection)
				for (let oldColId of currentCollections) {
					if (!newCollectionIds.has(oldColId)) {
						let oldCollection = await Zotero.Collections.getAsync(oldColId);
						if (oldCollection) {
							await oldCollection.removeItem(item.id);
							this.log(`  - Removed from "${oldCollection.name}"`);
						}
					}
				}
				
				// 2. Add Item to new Collections
				for (let colData of collections) {
					let collectionId = parseInt(colData.id, 10);
					this.log(`  - Looking for collection with ID: ${collectionId}`);
					let collection = await Zotero.Collections.getAsync(collectionId);
					if (collection) {
						// Check if already in Collection
						let itemCollections = item.getCollections();
						if (!itemCollections.includes(collectionId)) {
							await collection.addItem(item.id);
							this.log(`  - Added to "${collection.name}"`);
						} else {
							this.log(`  - Already in "${collection.name}", skipping`);
						}
					} else {
						this.log(`  - Collection "${colData.name}" not found (id: ${colData.id})`);
					}
				}
			});
			
			// Show success prompt
			var mainWindow = Zotero.getMainWindow();
			var Services = mainWindow.Services;
			Services.prompt.alert(
				mainWindow,
				'Success',
				`Item collections have been updated. Total: ${collections.length} collection(s).`
			);
			
			this.log('sendItemToCollections: Completed successfully');
		} catch (e) {
			this.log(`sendItemToCollections: Error - ${e.message}`);
			
			var mainWindow = Zotero.getMainWindow();
			var Services = mainWindow.Services;
			Services.prompt.alert(
				mainWindow,
				'Error',
				`Failed to update item collections: ${e.message}`
			);
		}
	},

	// Plugin main function (for testing)
	async main() {
		// Global properties are included automatically in Zotero 7
		var host = new URL('https://foo.com/path').host;
		this.log(`Host is ${host}`);

		// Retrieve a global pref
		this.log(`Intensity is ${Zotero.Prefs.get('extensions.tidy-up.intensity', true)}`);
	},

	// Compute cosine similarity between two strings (Chinese and English)
	cosineSimilarity(str1, str2) {
		if (!str1 || !str2) return 0;
		
		// Convert string to char array (Chinese-aware)
		// Chinese: split by char; English: also by char
		const chars1 = str1.toLowerCase().split('');
		const chars2 = str2.toLowerCase().split('');
		
		// Filter spaces and punctuation
		const filterRegex = /[\s\p{P}]/u;
		const filtered1 = chars1.filter(c => !filterRegex.test(c));
		const filtered2 = chars2.filter(c => !filterRegex.test(c));
		
		if (filtered1.length === 0 || filtered2.length === 0) return 0;
		
		// Build character frequency vector
		const allChars = new Set([...filtered1, ...filtered2]);
		const vec1 = [];
		const vec2 = [];
		
		for (const char of allChars) {
			vec1.push(filtered1.filter(c => c === char).length);
			vec2.push(filtered2.filter(c => c === char).length);
		}
		
		// Compute dot product
		let dotProduct = 0;
		let norm1 = 0;
		let norm2 = 0;
		
		for (let i = 0; i < vec1.length; i++) {
			dotProduct += vec1[i] * vec2[i];
			norm1 += vec1[i] * vec1[i];
			norm2 += vec2[i] * vec2[i];
		}
		
		// Compute cosine similarity
		if (norm1 === 0 || norm2 === 0) return 0;
		return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
	},

	// Compute cosine similarity between two embeddings
	embeddingSimilarity(embedding1, embedding2) {
		if (!embedding1 || !embedding2) return 0;
		if (embedding1.length !== embedding2.length) {
			this.log(`Embedding dimension mismatch: ${embedding1.length} vs ${embedding2.length}`);
			return 0;
		}
		
		let dotProduct = 0;
		let norm1 = 0;
		let norm2 = 0;
		
		for (let i = 0; i < embedding1.length; i++) {
			dotProduct += embedding1[i] * embedding2[i];
			norm1 += embedding1[i] * embedding1[i];
			norm2 += embedding2[i] * embedding2[i];
		}
		
		if (norm1 === 0 || norm2 === 0) return 0;
		return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
	},

	// Embedding API config
	embeddingConfig: {
		provider: null,  // 'openai', 'cohere', or null (use local cosine)
		apiKey: null,
		model: null,
		baseUrl: null
	},

	// Set embedding API config
	setEmbeddingConfig(config) {
		this.embeddingConfig = { ...this.embeddingConfig, ...config };
		this.log(`Embedding config updated: provider=${config.provider || 'local'}`);
		
		// Also save to preferences
		try {
			Zotero.Prefs.set('extensions.tidy-up.embedding.provider', config.provider || '', true);
			Zotero.Prefs.set('extensions.tidy-up.embedding.apiKey', config.apiKey || '', true);
			Zotero.Prefs.set('extensions.tidy-up.embedding.model', config.model || '', true);
			Zotero.Prefs.set('extensions.tidy-up.embedding.baseUrl', config.baseUrl || '', true);
		} catch (e) {
			this.log(`Error saving embedding config to prefs: ${e.message}`);
		}
	},
	
	setLlmConfig(config) {
		this.llmConfig = { ...this.llmConfig, ...config };
		this.log(`LLM config updated: provider=${config.provider || 'none'}`);
		
		// Also save to preferences
		try {
			Zotero.Prefs.set('extensions.tidy-up.llm.provider', config.provider || '', true);
			Zotero.Prefs.set('extensions.tidy-up.llm.apiKey', config.apiKey || '', true);
			Zotero.Prefs.set('extensions.tidy-up.llm.model', config.model || '', true);
			Zotero.Prefs.set('extensions.tidy-up.llm.baseUrl', config.baseUrl || '', true);
		} catch (e) {
			this.log(`Error saving LLM config to prefs: ${e.message}`);
		}
	},
	
	// Set classification algorithm
	setClassificationAlgorithm(algorithm) {
		this.classificationConfig.algorithm = algorithm;
		this.log(`Classification algorithm updated: ${algorithm}`);
		
		// Also save to preferences
		try {
			Zotero.Prefs.set('extensions.tidy-up.classification.algorithm', algorithm, true);
		} catch (e) {
			this.log(`Error saving classification algorithm to prefs: ${e.message}`);
		}
	},

	// Get text embedding (via API)
	async getEmbedding(text) {
		if (!text) return null;
		
		// Test mode: use mock response
		if (this.testMode.enabled && this.testMode.mockApiResponses) {
			// Lazy init mock embedding
			if (!this.testMode.mockEmbedding) {
				this.testMode.mockEmbedding = new Float32Array(1536).fill(0.1);
			}
			this.log(`[TEST MODE] Using mock embedding for "${text.substring(0, 30)}..."`);
			return this.testMode.mockEmbedding;
		}
		
		// If no API configured, return null (use local cosine)
		if (!this.embeddingConfig.provider || !this.embeddingConfig.apiKey) {
			this.log('No embedding API configured, will use local cosine similarity');
			return null;
		}
		
		// Check Item cache
		const cachedEmbedding = this.embeddingsCache.getItemEmbedding(text);
		if (cachedEmbedding) {
			return cachedEmbedding;
		}
		
		// Log API call
		this.backgroundEmbeddingTask.stats.apiTotalCount++;
		
		try {
			let embedding = null;
			const startTime = Date.now();
			
			switch (this.embeddingConfig.provider) {
				case 'openai':
				case 'ollama':
				case 'custom':
					embedding = await this.getEmbeddingViaOpenAICompat(text);
					break;
				case 'cohere':
					embedding = await this.getCohereEmbedding(text);
					break;
				default:
					this.log(`Unsupported embedding provider: ${this.embeddingConfig.provider}`);
					this.backgroundEmbeddingTask.stats.apiFailCount++;
					this.backgroundEmbeddingTask.stats.lastApiError = `Unsupported embedding provider: ${this.embeddingConfig.provider}`;
					return null;
			}
			
			if (embedding) {
				// API call success
				this.backgroundEmbeddingTask.stats.apiSuccessCount++;
				// Clear prior error
				this.backgroundEmbeddingTask.stats.lastApiError = null;
				
				// Cache Item embedding
				this.embeddingsCache.setItemEmbedding(text, embedding);
				
				// Test mode: log API call details
				if (this.testMode.enabled && this.testMode.logApiCalls) {
					const elapsed = Date.now() - startTime;
					this.log(`[TEST MODE] API call: ${embedding.length} dimensions, ${elapsed}ms`);
				}
			} else {
				this.backgroundEmbeddingTask.stats.apiFailCount++;
				this.backgroundEmbeddingTask.stats.lastApiError = 'API returned null embedding';
			}
			
			return embedding;
		} catch (e) {
			this.backgroundEmbeddingTask.stats.apiFailCount++;
			this.backgroundEmbeddingTask.stats.lastApiError = e.message;
			this.log(`Error getting embedding: ${e.message}`);
			return null;
		}
	},

	// OpenAI Embedding API
	async getOpenAIEmbedding(text) {
		const model = this.embeddingConfig.model || 'text-embedding-3-small';
		let baseUrl = this.embeddingConfig.baseUrl || 'https://bapi.huiyan-ai.cn/v1';
		
		// Ensure URL includes /v1 path
		if (baseUrl.indexOf('/v1') === -1) {
			baseUrl = baseUrl.replace(/\/$/, '') + '/v1';
		}
		
		this.log(`Calling OpenAI API: ${baseUrl}/embeddings`);
		
		const response = await fetch(`${baseUrl}/embeddings`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.embeddingConfig.apiKey}`
			},
			body: JSON.stringify({
				model: model,
				input: text
			})
		});
		
		if (!response.ok) {
			const error = await response.text();
			throw new Error(`OpenAI API error: ${response.status} - ${error}`);
		}
		
		const data = await response.json();
		const embedding = new Float32Array(data.data[0].embedding);
		
		// Update cache config
		this.embeddingsCache.model = model;
		this.embeddingsCache.dimensions = embedding.length;
		
		this.log(`Got OpenAI embedding for "${text.substring(0, 30)}..." (${embedding.length} dimensions)`);
		return embedding;
	},

	// Cohere Embedding API
	async getCohereEmbedding(text) {
		const model = this.embeddingConfig.model || 'embed-multilingual-v3.0';
		const baseUrl = this.embeddingConfig.baseUrl || 'https://api.cohere.ai/v1';
		
		const response = await fetch(`${baseUrl}/embed`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.embeddingConfig.apiKey}`
			},
			body: JSON.stringify({
				model: model,
				texts: [text],
				input_type: 'search_document'
			})
		});
		
		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Cohere API error: ${response.status} - ${error}`);
		}
		
		const data = await response.json();
		const embedding = new Float32Array(data.embeddings[0]);
		
		// Update cache config
		this.embeddingsCache.model = model;
		this.embeddingsCache.dimensions = embedding.length;
		
		this.log(`Got Cohere embedding for "${text.substring(0, 30)}..." (${embedding.length} dimensions)`);
		return embedding;
	},

	// 3.0.6: getGeminiEmbedding removed — text-embedding-004 deprecated.
	// Users wanting Google embeddings can use Custom provider with an OpenAI-compatible proxy.

	// OpenAI-compatible Embedding API (shared by openai / ollama / custom)
	async getEmbeddingViaOpenAICompat(text) {
		const cfg = this.embeddingConfig;
		let baseUrl = cfg.baseUrl;
		if (baseUrl.indexOf('/v1') === -1 && cfg.provider !== 'ollama') {
			baseUrl = baseUrl.replace(/\/$/, '') + '/v1';
		}
		const model = cfg.model || 'text-embedding-3-small';
		const headers = { 'Content-Type': 'application/json' };
		if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;
		const resp = await fetch(`${baseUrl}/embeddings`, {
			method: 'POST', headers,
			body: JSON.stringify({ model, input: text })
		});
		if (!resp.ok) throw new Error(`Embedding API error: ${resp.status} - ${await resp.text()}`);
		const data = await resp.json();
		const embedding = new Float32Array(data.data[0].embedding);
		this.embeddingsCache.model = model;
		this.embeddingsCache.dimensions = embedding.length;
		return embedding;
	},

	// Build enhanced text for Collection (for embedding)
	// Includes: name + Item titles + Item abstracts
	async buildCollectionText(collection) {
		const config = this.embeddingSourceConfig;
		const parts = [];
		let limitedItems = [];
		
		// 1. Collection name (highest weight)
		if (config.includeCollectionName && collection.name) {
			parts.push(collection.name);
		}
		
		// 2. Get Items in Collection
		try {
			const itemIDs = await collection.getChildItems();
			const items = await Zotero.Items.getAsync(itemIDs);
			
			// Limit Item count
			limitedItems = items.slice(0, config.maxItems);
			
			// 3. Item titles aggregation
			if (config.includeItemTitles) {
				const titles = [];
				for (const item of limitedItems) {
					const title = item.getDisplayTitle() || item.getField('title');
					if (title) {
						titles.push(title);
					}
				}
				if (titles.length > 0) {
					parts.push(titles.join(' '));
				}
			}
			
			// 4. Item abstracts aggregation
			if (config.includeItemAbstracts) {
				const abstracts = [];
				for (const item of limitedItems) {
					const abstract = item.getField('abstractNote');
					if (abstract) {
						// Truncate abstract
						const truncated = abstract.substring(0, config.maxAbstractLength);
						abstracts.push(truncated);
					}
				}
				if (abstracts.length > 0) {
					parts.push(abstracts.join(' '));
				}
			}
		} catch (e) {
			this.log(`Error getting items for collection "${collection.name}": ${e.message}`);
		}
		
		// 5. Concatenate all parts
		let fullText = parts.join(' ');
		
		// 6. Limit total length
		if (fullText.length > config.maxTotalLength) {
			fullText = fullText.substring(0, config.maxTotalLength);
		}
		
		this.log(`Built collection text for "${collection.name}": ${fullText.length} chars, ${parts.length} parts`);
		return { text: fullText, items: limitedItems };
	},

	// Update Collection embedding (using enhanced text)
	async updateCollectionEmbedding(collection) {
		const key = collection.key;
		const name = collection.name;
		
		// Get Items and generate fingerprint
		let items = [];
		try {
			const itemIDs = await collection.getChildItems();
			items = await Zotero.Items.getAsync(itemIDs);
		} catch (e) {
			this.log(`Error getting items for collection "${name}": ${e.message}`);
		}
		const itemFingerprint = this.embeddingsCache.generateItemFingerprint(items);
		
		// Check if needs update (incl. Item fingerprint)
		if (!this.embeddingsCache.needsUpdate(key, name, itemFingerprint)) {
			this.log(`Embedding for "${name}" is up to date`);
			return this.embeddingsCache.get(key).embedding;
		}
		
		this.log(`Updating embedding for "${name}"...`);
		
		// Build enhanced text
		const buildResult = await this.buildCollectionText(collection);
		const text = buildResult.text;
		
		// Get embedding
		const embedding = await this.getEmbedding(text);
		
		if (embedding) {
			// Save to cache (incl. Item fingerprint)
			this.embeddingsCache.set(key, {
				id: collection.id,
				name: name,
				embedding: embedding,
				itemFingerprint: itemFingerprint,
				itemCount: items.length
			});
			
			// Async save to file
			this.embeddingsCache.save();
			
			return embedding;
		}
		
		// Log failure reason
		if (!this.embeddingConfig.provider || !this.embeddingConfig.apiKey) {
			this.log(`Failed to get embedding for "${name}": API not configured (provider=${this.embeddingConfig.provider || 'none'})`);
		} else {
			this.log(`Failed to get embedding for "${name}": API call failed`);
		}
		
		return null;
	},

	// Show progress dialog
	showProgressDialog(title, message) {
		const mainWindow = Zotero.getMainWindow();
		const doc = mainWindow.document;
		
		// Check if progress dialog exists
		let existingDialog = doc.getElementById('tidy-up-progress-dialog');
		if (existingDialog) {
			let label = doc.getElementById('tidy-up-progress-label');
			if (label) {
				label.setAttribute('value', message);
			}
			return existingDialog;
		}
		
		// Create progress container (vbox not dialog)
		let dialog = doc.createXULElement('vbox');
		dialog.id = 'tidy-up-progress-dialog';
		dialog.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; border: 2px solid #ccc; border-radius: 8px; padding: 20px; z-index: 9999; min-width: 300px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);';
		
		// Title
		let titleLabel = doc.createXULElement('label');
		titleLabel.setAttribute('value', title);
		titleLabel.style.cssText = 'font-weight: bold; font-size: 16px; margin-bottom: 10px;';
		dialog.appendChild(titleLabel);
		
		// Message
		let label = doc.createXULElement('label');
		label.id = 'tidy-up-progress-label';
		label.setAttribute('value', message);
		label.style.fontSize = '14px';
		dialog.appendChild(label);
		
		// Progress bar
		let progress = doc.createXULElement('progressmeter');
		progress.id = 'tidy-up-progress-meter';
		progress.setAttribute('mode', 'undetermined');
		progress.style.marginTop = '10px';
		dialog.appendChild(progress);
		
		// Add to main window
		let deck = doc.getElementById('zotero-collections-splitter')?.parentElement;
		if (!deck) {
			deck = doc.body || doc.documentElement;
		}
		deck.appendChild(dialog);
		
		return dialog;
	},
	
	// Update progress dialog
	updateProgressDialog(message, progress = null) {
		const mainWindow = Zotero.getMainWindow();
		const doc = mainWindow.document;
		
		let label = doc.getElementById('tidy-up-progress-label');
		if (label) {
			label.setAttribute('value', message);
		}
		
		let meter = doc.getElementById('tidy-up-progress-meter');
		if (meter && progress !== null) {
			meter.setAttribute('mode', 'determined');
			meter.setAttribute('value', progress);
		}
	},

	// Close progress dialog
	closeProgressDialog() {
		const mainWindow = Zotero.getMainWindow();
		const doc = mainWindow.document;
		
		let dialog = doc.getElementById('tidy-up-progress-dialog');
		if (dialog) {
			// XUL dialog has no close(), remove directly
			try {
				// Try to hide
				dialog.style.display = 'none';
			} catch (e) {}
			// Remove element
			dialog.remove();
		}
	},

	// Batch update all Collection embeddings
	async updateAllCollectionEmbeddings() {
		this.log('Starting to update all collection embeddings...');
		
		const allCollections = await this.getAllCollections();
		const totalCount = allCollections.length;
		
		// Test mode: process first N Collections only
		let collections = allCollections;
		if (this.testMode.enabled) {
			collections = allCollections.slice(0, this.testMode.maxCollections);
			this.log(`[TEST MODE] Processing ${collections.length} of ${totalCount} collections`);
		}
		
		const total = collections.length;
		let updated = 0;
		let skipped = 0;
		
		// Show progress dialog
		const progressTitle = this.testMode.enabled 
			? `PaperRouter - TEST MODE (${collections.length}/${totalCount})` 
			: 'PaperRouter - Updating Embeddings';
		this.showProgressDialog(progressTitle, `Preparing to update ${total} collections...`);
		
		for (let i = 0; i < collections.length; i++) {
			const collection = collections[i];
			
			// Update progress
			const progress = Math.round((i / total) * 100);
			this.updateProgressDialog(`Processing ${i + 1}/${total}: ${collection.name}`, progress);
			
			try {
				const embedding = await this.updateCollectionEmbedding(collection);
				if (embedding) {
					updated++;
					if (this.testMode.enabled && this.testMode.logApiCalls) {
						this.log(`[TEST MODE] Updated embedding for "${collection.name}" (${embedding.length} dimensions)`);
					}
				} else {
					skipped++;
				}
			} catch (e) {
				this.log(`Error updating embedding for "${collection.name}": ${e.message}`);
				skipped++;
			}
			
			// Add delay to avoid API rate limit
			if (this.embeddingConfig.provider) {
				await new Promise(resolve => setTimeout(resolve, 100));
			}
			
			// Check if cancelled
			const dialog = Zotero.getMainWindow().document.getElementById('tidy-up-progress-dialog');
			if (!dialog) {
				this.log('Progress dialog closed, cancelling...');
				break;
			}
		}
		
		// Close progress dialog
		this.closeProgressDialog();
		
		if (this.testMode.enabled) {
			this.log(`[TEST MODE] Completed: Updated ${updated} embeddings, skipped ${skipped}`);
		} else {
			this.log(`Updated ${updated} embeddings, skipped ${skipped}`);
		}
		
		// Save cache
		await this.embeddingsCache.save();
		
		return { updated, skipped };
	},

	// Compute tree Collections similarity using embeddings
	async calculateTreeSimilarityWithEmbedding(trees, itemName, blacklist = new Set()) {
		// Get embedding for Item name
		const tEmb = Date.now();
		const itemEmbedding = await this.getEmbedding(itemName);
		this.log(`[TIMING] getEmbedding(itemName): ${(Date.now() - tEmb).toFixed(0)}ms`);
		
		if (!itemEmbedding) {
			// If cannot get embedding, fallback to local cosine
			this.log('Falling back to local cosine similarity');
			await this.calculateTreeSimilarity(trees, itemName, blacklist);
			return;
		}
		
		// Save Item cache (if just got new embedding)
		await this.embeddingsCache.save();
		
		// Compute similarity using embeddings
		for (let node of trees) {
			// Check if blacklisted
			if (blacklist.has(node.id)) {
				node.confidence = 0;  // Blacklisted = 0 similarity
			} else {
				let rawSimilarity = 0;
				const cached = this.embeddingsCache.get(node.key);
				
				if (cached && cached.embedding) {
					rawSimilarity = this.embeddingSimilarity(itemEmbedding, cached.embedding);
				} else {
					// If not in cache, use local cosine as fallback
					rawSimilarity = this.cosineSimilarity(itemName, node.name);
				}
				
				// Apply rejection rate penalty
				let adjustedSimilarity = this.collectionBlacklist.applyRejectionPenalty(node.id, rawSimilarity);
				// Apply IDF weight
				adjustedSimilarity = this.idfWeighting.applyIDFWeight(node.id, node.name, adjustedSimilarity);
				// Apply specificity weight (from cache, sync)
				adjustedSimilarity = this.collectionSpecificity.applySpecificityWeightById(node.id, node.name, adjustedSimilarity);
				
				// Get Collection type (external vs internal)
				if (this.classificationConfig.algorithm === 'vector') {
					try {
						// Get Collection type from cache (ID to string)
						let collectionType = this.collectionTypeCache.get(node.id.toString());
						if (!collectionType) {
							// If not in cache, call LLM API to pre-classify
							this.log(`Collection "${node.name}" not in cache, classifying with LLM API`);
							try {
								// Get Collection object
								const collection = await Zotero.Collections.getAsync(node.id);
								if (collection) {
									// Get Collection description
									const collectionDescription = collection.getField('abstract') || '';
									// Get items in Collection
									const collectionItems = await collection.getChildItems();
									// Call classification function
									collectionType = await this.classifyCollectionType(node.name, collectionDescription, collectionItems);
									// Cache classification result
									this.collectionTypeCache.set(node.id.toString(), collectionType);
									this.log(`Collection "${node.name}" classified as ${collectionType}, saved to cache`);
								} else {
									// If cannot get Collection, use default type
									collectionType = 'default';
									this.log(`Collection "${node.name}" not found, using default type`);
								}
							} catch (e) {
								// If classification fails, use default type
								collectionType = 'default';
								this.log(`Error classifying collection "${node.name}": ${e.message}, using default type`);
							}
						} else {
							this.log(`Collection "${node.name}" type from cache: ${collectionType}`);
						}
						node.collectionType = collectionType;
						
						// Apply Collection type weight (priority 1: differentiated by type)
						// External-type: lower weight (0.7x)
						// Internal-type: higher weight (1.3x)
						if (collectionType === 'external') {
							adjustedSimilarity *= 0.7;
							this.log(`Collection "${node.name}" is external, weight adjusted: ${adjustedSimilarity.toFixed(4)}`);
						} else if (collectionType === 'internal') {
							adjustedSimilarity *= 1.3;
							this.log(`Collection "${node.name}" is internal, weight adjusted: ${adjustedSimilarity.toFixed(4)}`);
						}
					} catch (e) {
						this.log(`Error getting collection type for "${node.name}": ${e.message}`);
						node.collectionType = 'default';
					}
				}
				
				node.confidence = adjustedSimilarity;
			}
			
			if (node.children && node.children.length > 0) {
				await this.calculateTreeSimilarityWithEmbedding(node.children, itemName, blacklist);
			}
		}
	},
};

var PaperRouter = TidyUp;
