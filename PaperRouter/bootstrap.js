/* This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0.
 * If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * PaperRouter — Zotero collection router
 * Copyright (c) Mike Zhou (Keshen Zhou)
 * Copyright (c) Wight
 * 2026 PaperRouter rewrite based on the original Tidy Up plugin.
 */
var PaperRouter;
var TidyUp;
var chromeHandle;

function getRouterModule() {
	return PaperRouter || TidyUp;
}

function log(msg) {
	Zotero.debug("PaperRouter: " + msg);
	try {
		console.log("PaperRouter: " + msg);
	} catch (e) {
	}
}

function install() {
	log("Installed 2.9.1");
}

// One-time migration: legacy single-key apiKey -> per-provider apiKey.
// Old keys are KEPT (back-compat / rollback safety).
// Note: model is intentionally NOT migrated — the legacy single `<side>.model` pref was decoupled
// from the active provider at the time of writing (it tracked whatever was last in the input field),
// so copying it to `<side>.<provider>.model` produced cross-provider leaks. preferences.js's
// onProviderChange falls back to defaultModel when the per-provider slot is empty, which is correct.
function migratePerProviderPrefs() {
	try {
		['llm', 'embedding'].forEach(function(side) {
			var provider = Zotero.Prefs.get('extensions.tidy-up.' + side + '.provider', true);
			if (!provider) return;
			var oldKey = Zotero.Prefs.get('extensions.tidy-up.' + side + '.apiKey', true);
			var newKeyPath = 'extensions.tidy-up.' + side + '.' + provider + '.apiKey';
			if (oldKey && !Zotero.Prefs.get(newKeyPath, true)) {
				Zotero.Prefs.set(newKeyPath, oldKey, true);
				log('migrated ' + side + ' apiKey to ' + provider);
			}
		});
	} catch (e) {
		log('migratePerProviderPrefs error: ' + e.message);
	}
}

async function startup({ id, version, rootURI }) {
	log("Starting 2.9.1");
	migratePerProviderPrefs();

	// Register chrome content for dialog
	var aomStartup = Cc["@mozilla.org/addons/addon-manager-startup;1"].getService(Ci.amIAddonManagerStartup);
	var manifestURI = Services.io.newURI(rootURI + "manifest.json");
	chromeHandle = aomStartup.registerChrome(manifestURI, [
		["content", "tidy-up-trae", "chrome/content/"]
	]);
	log("Chrome content registered");
	
	Zotero.PreferencePanes.register({
		pluginID: 'paperrouter@keshen-zhou.github.io',
		src: rootURI + 'preferences.xhtml',
		scripts: [rootURI + 'chrome/content/l10n.js', rootURI + 'chrome/content/providers.js', rootURI + 'preferences.js']
	});

	Services.scriptloader.loadSubScript(rootURI + 'chrome/content/l10n.js');
	Services.scriptloader.loadSubScript(rootURI + 'chrome/content/providers.js');
	Services.scriptloader.loadSubScript(rootURI + 'tidy-up.js');
	PaperRouter = PaperRouter || TidyUp;
	TidyUp = TidyUp || PaperRouter;
	log("Script loaded, about to initialize...");
	const router = getRouterModule();
	await router.init({ id, version, rootURI });
	Zotero.PaperRouter = router;
	Zotero.TidyUp = router;
	log("PaperRouter initialized");
	
	// Wait a bit for UI to be ready before adding menus
	setTimeout(() => {
		const activeRouter = getRouterModule();
		if (activeRouter && typeof activeRouter.addToOneWindows === 'function') {
			activeRouter.addToOneWindows();
			activeRouter.main();
		} else {
			log("ERROR: PaperRouter.addToOneWindows is not a function");
		}
	}, 2000);
}

function onMainWindowLoad({ window }) {
	const router = getRouterModule();
	if (router) {
		router.addToWindow(window);
	}
}

function onMainWindowUnload({ window }) {
	const router = getRouterModule();
	if (router) {
		router.removeFromWindow(window);
	}
}

function shutdown() {
	log("Shutting down 2.9.1");
	const router = getRouterModule();
	if (router) {
		router.removeFromAllWindows();
	}
	Zotero.PaperRouter = undefined;
	Zotero.TidyUp = undefined;
	PaperRouter = undefined;
	TidyUp = undefined;
	
	// Unregister chrome content
	if (chromeHandle) {
		chromeHandle.destruct();
		chromeHandle = null;
	}
}

function uninstall() {
	log("Uninstalled 2.9.1");
}
