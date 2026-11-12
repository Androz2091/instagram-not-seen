# Instagram Not Seen

A Chrome extension. Watch Instagram stories on the web without showing up in the viewer list.

## Install

1. Clone or download this repository.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and pick this folder.

Click the extension icon to turn it on or off. It's on by default.

## How it works

Instagram marks a story as seen with a GraphQL mutation, `PolarisStoriesV3SeenMutation`, sent to `POST /api/graphql`. That endpoint also carries every other action (likes, comments, follows), so the extension can't block it by URL.

Instead, `inject.js` runs in the page before Instagram's code and wraps `XMLHttpRequest` and `fetch`. When a request's `fb_api_req_friendly_name` (or `X-FB-Friendly-Name` header) is `PolarisStoriesV3SeenMutation`, it is never sent, and the page gets a fake successful reply so the story viewer keeps working. All other requests go through untouched.

Stories still look "seen" in your own tray until you reload the page. That's only local; the owner doesn't see you.

If Instagram renames the mutation, update `BLOCKED_OPERATIONS` in `inject.js`.
