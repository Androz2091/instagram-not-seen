// Runs in the extension's isolated world. Scripts in the page's MAIN world
// can't read chrome.storage, so this mirrors the popup toggle onto an
// attribute that inject.js checks before each request.
'use strict';

const apply = (enabled) => {
    document.documentElement.dataset.instagramNotSeen = enabled ? 'on' : 'off';
};

chrome.storage.sync.get({ enabled: true }, ({ enabled }) => apply(enabled));

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.enabled) apply(changes.enabled.newValue);
});
