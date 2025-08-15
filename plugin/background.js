// 监听快捷键
chrome.commands.onCommand.addListener((command) => {
    if (command === "take-screenshot") {
        // 获取当前活动标签页
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                // 注入content script
                chrome.scripting.executeScript({
                    target: {tabId: tabs[0].id},
                    files: ['content.js']
                }, () => {
                    // 发送截图消息到content script
                    chrome.tabs.sendMessage(tabs[0].id, {action: "captureScreen"});
                });
            }
        });
    }
});

// Listen for a message from the content script to take a screenshot
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "takeScreenshot") {
    // 支持区域截图和全屏截图
    chrome.tabs.captureVisibleTab(
      null, // Captures the currently active tab in the current window
      { format: "png", quality: 100 }, // 高质量截图
      (dataUrl) => {
        // Check for errors
        if (chrome.runtime.lastError) {
          console.error("Screenshot failed:", chrome.runtime.lastError.message);
          sendResponse(null);
          return;
        }
        
        // 返回完整截图数据，区域裁剪在content script中处理
        sendResponse(dataUrl);
      }
    );
    return true; // Required for async sendResponse
  }
});

// 添加错误处理和调试信息
chrome.runtime.onInstalled.addListener(() => {
  console.log('Smart Screenshot Extension installed');
});

// 监听扩展错误
chrome.runtime.onStartup.addListener(() => {
  console.log('Smart Screenshot Extension started');
});
