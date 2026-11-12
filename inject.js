// Runs in the page's own JavaScript world (MAIN) at document_start, so it can
// wrap XMLHttpRequest and fetch before Instagram's code grabs them.
//
// Instagram marks a story item as seen with a GraphQL mutation sent to
// POST /api/graphql, form-encoded, with
//   fb_api_req_friendly_name=PolarisStoriesV3SeenMutation
//   variables={"reelId","reelMediaId","reelMediaOwnerId","reelMediaTakenAt","viewSeenAt"}
// /api/graphql carries every other mutation too, so the request is matched on
// its operation name rather than its URL. The doc_id changes with each
// Instagram web build; the operation name has been stable, so it is used instead.
(() => {
    'use strict';

    const BLOCKED_OPERATIONS = new Set([
        'PolarisStoriesV3SeenMutation'
    ]);
    // Pre-GraphQL endpoints, kept in case Instagram falls back to them.
    const LEGACY_PATHS = [
        '/stories/reel/seen',
        '/api/v1/stories/reel/seen'
    ];
    const FAKE_BODY = '{"data":{},"extensions":{"is_final":true}}';
    const LOG_PREFIX = '[instagram-not-seen]';

    // bridge.js mirrors the popup toggle onto this attribute. Missing means on.
    const isEnabled = () => document.documentElement.dataset.instagramNotSeen !== 'off';

    const bodyToString = (body) => {
        if (typeof body === 'string') return body;
        if (body instanceof URLSearchParams) return body.toString();
        if (body instanceof FormData) {
            return new URLSearchParams(
                [...body].filter(([, value]) => typeof value === 'string')
            ).toString();
        }
        return '';
    };

    // Returns the operation name to block, or null to let the request through.
    const matchSeenRequest = (url, body, friendlyNameHeader) => {
        if (!isEnabled()) return null;
        let path;
        try {
            path = new URL(url, location.href).pathname;
        } catch {
            return null;
        }
        if (LEGACY_PATHS.some((p) => path.startsWith(p))) return path;
        if (!path.includes('graphql')) return null;
        if (friendlyNameHeader && BLOCKED_OPERATIONS.has(friendlyNameHeader)) {
            return friendlyNameHeader;
        }
        const name = new URLSearchParams(bodyToString(body)).get('fb_api_req_friendly_name');
        return BLOCKED_OPERATIONS.has(name) ? name : null;
    };

    // --- XMLHttpRequest ---------------------------------------------------

    const xhrProto = XMLHttpRequest.prototype;
    const originalOpen = xhrProto.open;
    const originalSetRequestHeader = xhrProto.setRequestHeader;
    const originalSend = xhrProto.send;

    xhrProto.open = function (method, url) {
        this.__insUrl = String(url);
        this.__insFriendlyName = null;
        return originalOpen.apply(this, arguments);
    };

    xhrProto.setRequestHeader = function (name, value) {
        if (String(name).toLowerCase() === 'x-fb-friendly-name') {
            this.__insFriendlyName = String(value);
        }
        return originalSetRequestHeader.apply(this, arguments);
    };

    const fakeXhrSuccess = (xhr) => {
        const define = (key, value) =>
            Object.defineProperty(xhr, key, { configurable: true, get: () => value });
        setTimeout(() => {
            define('readyState', 4);
            define('status', 200);
            define('statusText', 'OK');
            define('responseURL', new URL(xhr.__insUrl, location.href).href);
            define('responseText', FAKE_BODY);
            define('response', xhr.responseType === 'json' ? JSON.parse(FAKE_BODY) : FAKE_BODY);
            xhr.dispatchEvent(new Event('readystatechange'));
            xhr.dispatchEvent(new ProgressEvent('load'));
            xhr.dispatchEvent(new ProgressEvent('loadend'));
        }, 0);
    };

    xhrProto.send = function (body) {
        const blocked = this.__insUrl && matchSeenRequest(this.__insUrl, body, this.__insFriendlyName);
        if (blocked) {
            console.debug(LOG_PREFIX, 'blocked', blocked);
            fakeXhrSuccess(this);
            return;
        }
        return originalSend.apply(this, arguments);
    };

    // --- fetch ------------------------------------------------------------

    const originalFetch = window.fetch;

    window.fetch = function (input, init) {
        const url = input instanceof Request ? input.url : String(input);
        const headers = new Headers((init && init.headers) || (input instanceof Request ? input.headers : undefined));
        const blocked = matchSeenRequest(url, init && init.body, headers.get('x-fb-friendly-name'));
        if (blocked) {
            console.debug(LOG_PREFIX, 'blocked', blocked);
            return Promise.resolve(new Response(FAKE_BODY, {
                status: 200,
                headers: { 'content-type': 'application/json' }
            }));
        }
        return originalFetch.apply(this, arguments);
    };
})();
