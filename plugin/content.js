// 简化的全屏截图插件
class SimpleScreenCapture {
    constructor() {
        this.isProcessing = false;
        this.hiddenElements = [];
        this.setupMessageListener();
        console.log('SimpleScreenCapture initialized');
    }

    // 设置消息监听
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === "captureScreen") {
                this.takeScreenshot();
                sendResponse({success: true});
            }
        });
    }

    // 主截图方法
    async takeScreenshot() {
        if (this.isProcessing) {
            console.log('Already processing, skipping...');
            return;
        }
        
        this.isProcessing = true;
        console.log('Starting full screen capture...');

        try {
            // 简单的无用信息筛选
            this.hideUselessElements();
            
            // 等待DOM更新
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 执行全屏截图
            await this.captureFullScreen();
            
        } catch (error) {
            console.error('Screen capture failed:', error);
        } finally {
            // 恢复隐藏的元素
            this.restoreHiddenElements();
            this.isProcessing = false;
        }
    }

    // 隐藏无用元素
    hideUselessElements() {
        this.hiddenElements = [];
        
        // 隐藏常见的无用元素
        const uselessSelectors = [
            'nav', 'header', 'footer', '.navbar', '.header', '.footer',
            '.advertisement', '.ad', '.ads', '[class*="ad-"]',
            '.sidebar', '.menu', '.navigation', '.breadcrumb',
            '.popup', '.modal', '.overlay', '.tooltip',
            '.social-share', '.comment', '.comments',
            'script', 'noscript', 'style'
        ];
        
        for (const selector of uselessSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                if (element.style.display !== 'none') {
                    this.hiddenElements.push({
                        element: element,
                        originalDisplay: element.style.display
                    });
                    element.style.display = 'none';
                }
            }
        }
        
        console.log(`Hidden ${this.hiddenElements.length} useless elements`);
    }
    
    // 恢复隐藏的元素
    restoreHiddenElements() {
        if (this.hiddenElements) {
            for (const item of this.hiddenElements) {
                item.element.style.display = item.originalDisplay;
            }
            this.hiddenElements = [];
        }
    }

    // 全屏截图
    async captureFullScreen() {
        console.log('Executing full screen capture');
        await this.requestScreenshot();
    }

    // 请求截图
    async requestScreenshot() {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { action: "takeScreenshot" },
                async (dataUrl) => {
                    if (dataUrl) {
                        try {
                            await this.copyToClipboard(dataUrl);
                            console.log('Screenshot copied to clipboard successfully');
                            resolve();
                        } catch (error) {
                            console.error('Failed to copy to clipboard:', error);
                            reject(error);
                        }
                    } else {
                        reject(new Error('Screenshot failed'));
                    }
                }
            );
        });
    }

    // 复制到剪切板
    async copyToClipboard(dataUrl) {
        try {
            // 转换为 Blob
            const response = await fetch(dataUrl);
            const blob = await response.blob();

            // 复制到剪切板
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);

        } catch (error) {
            console.error('Clipboard operation failed:', error);
            throw error;
        }
    }
}

// 创建实例
const screenCapture = new SimpleScreenCapture();