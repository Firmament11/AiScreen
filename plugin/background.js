chrome.commands.onCommand.addListener((command) => {
  if (command === "take-screenshot") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          files: ["content.js"],
        });
      }
    });
  }
});

// Listen for a message from the content script to take a screenshot
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "takeScreenshot") {
    chrome.tabs.captureVisibleTab(
      null, // Captures the currently active tab in the current window
      { format: "png", quality: 100 }, // 提高截图质量
      (dataUrl) => {
        // Check for errors
        if (chrome.runtime.lastError) {
          console.error("Screenshot failed:", chrome.runtime.lastError.message);
          sendResponse(null);
          return;
        }
        sendResponse(dataUrl);
      }
    );
    return true; // Required for async sendResponse
  }
});
