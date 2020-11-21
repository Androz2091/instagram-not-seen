'use strict';

const viewedStories = [];

const blockRequest = (details) => {
    if(details.url === "https://www.instagram.com/stories/reel/seen"){
        const storyID = details.requestBody.formData.reelMediaId[0];
        viewedStories.push(storyID);
        console.log(`Blocking call to ${details.url}...`);
        return {
            cancel: true
        };
    };
};

if (chrome.webRequest.onBeforeRequest.hasListener(blockRequest)) {
    chrome.webRequest.onBeforeRequest.removeListener(blockRequest);
}

chrome.webRequest.onBeforeRequest.addListener(blockRequest, {
    urls: [ '<all_urls>' ]
}, ['blocking', 'requestBody']);
