// 智能静默截图插件 - Content Script
// 功能：智能识别问题区域，基于鼠标位置优化截图，静默复制到剪切板

class SmartScreenshot {
    constructor() {
        this.mouseX = 0;
        this.mouseY = 0;
        this.isProcessing = false;
        this.fallbackTimeout = null;
        
        // 监听鼠标移动以记录位置
        this.trackMousePosition();
    }

    // 跟踪鼠标位置
    trackMousePosition() {
        document.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        });
    }

    // 主要截图逻辑
    async takeSmartScreenshot() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            // 设置保底机制：3秒后如果没有成功截图，执行全屏截图
            this.setFallbackMechanism();

            // 1. 智能识别问题区域
            const targetElement = this.identifyQuestionArea();
            
            if (targetElement) {
                // 2. 基于识别的元素进行优化截图
                await this.captureOptimizedArea(targetElement);
            } else {
                // 3. 如果无法识别，基于鼠标位置截图
                await this.captureMouseBasedArea();
            }
        } catch (error) {
            console.error('Smart screenshot failed:', error);
            // 出错时执行保底全屏截图
            await this.captureFullScreen();
        } finally {
            this.isProcessing = false;
            this.clearFallbackTimeout();
        }
    }

    // 智能识别问题区域
    identifyQuestionArea() {
        const questionSelectors = [
            // 常见的问题容器选择器
            '.question', '.problem', '.quiz-item', '.test-item',
            '.question-container', '.question-wrapper', '.question-box',
            '.exercise', '.homework', '.assignment', '.exam-item',
            '[class*="question"]', '[class*="problem"]', '[class*="quiz"]',
            '[id*="question"]', '[id*="problem"]', '[id*="quiz"]',
            
            // 选择题特征
            '.multiple-choice', '.choice-question', '.radio-group',
            '[class*="choice"]', '[class*="option"]', '.options',
            'input[type="radio"]', 'input[type="checkbox"]',
            
            // 简答题特征
            '.essay-question', '.text-question', '.answer-area',
            'textarea[class*="answer"]', 'input[class*="answer"]',
            'textarea', '.input-area', '.text-input',
            
            // 学习平台特定选择器
            '.ques', '.topic', '.subject', '.item', '.card',
            '.question-wrap', '.problem-wrap', '.quiz-wrap',
            
            // 通用容器
            '.content', '.main-content', '.question-content',
            'article', 'section[class*="question"]', '.container',
            
            // 数学和科学题目
            '.math-question', '.formula', '.equation',
            '[class*="math"]', '[class*="formula"]'
        ];

        // 首先尝试找到鼠标附近的问题元素
        const nearbyElement = this.findNearbyQuestionElement(questionSelectors);
        if (nearbyElement) return nearbyElement;

        // 如果没找到，尝试找到页面中最相关的问题元素
        for (const selector of questionSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                // 返回最大的或最相关的元素
                return this.selectBestQuestionElement(elements);
            }
        }

        return null;
    }

    // 查找鼠标附近的问题元素
    findNearbyQuestionElement(selectors) {
        const searchRadius = 200; // 搜索半径
        let bestElement = null;
        let minDistance = Infinity;

        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            
            for (const element of elements) {
                const rect = element.getBoundingClientRect();
                const distance = this.calculateDistance(
                    this.mouseX, this.mouseY,
                    rect.left + rect.width / 2,
                    rect.top + rect.height / 2
                );

                if (distance < searchRadius && distance < minDistance) {
                    minDistance = distance;
                    bestElement = element;
                }
            }
        }

        return bestElement;
    }

    // 计算两点间距离
    calculateDistance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    }

    // 选择最佳问题元素
    selectBestQuestionElement(elements) {
        let bestElement = elements[0];
        let maxScore = 0;

        for (const element of elements) {
            const rect = element.getBoundingClientRect();
            const area = rect.width * rect.height;
            const isVisible = rect.width > 0 && rect.height > 0 && 
                            rect.top >= 0 && rect.left >= 0;
            
            // 评分：面积 + 可见性 + 文本内容相关性
            let score = isVisible ? area : 0;
            
            // 检查是否包含问题相关文本
            const text = element.textContent.toLowerCase();
            const questionKeywords = [
                // 中文关键词
                '问题', '题目', '选择', '判断', '填空', '简答', '计算', '分析',
                '下列', '以下', '关于', '根据', '如果', '假设', '已知',
                '第', '题', '（', '）', 'a.', 'b.', 'c.', 'd.',
                
                // 英文关键词
                'question', 'problem', 'choose', 'select', 'answer',
                'which', 'what', 'how', 'why', 'when', 'where',
                'true', 'false', 'correct', 'incorrect',
                'a)', 'b)', 'c)', 'd)', 'option'
            ];
            
            let keywordMatches = 0;
            for (const keyword of questionKeywords) {
                if (text.includes(keyword)) {
                    keywordMatches++;
                }
            }
            
            // 根据关键词匹配数量给分
            score += keywordMatches * 500;
            
            // 检查是否有选项结构（A、B、C、D或1、2、3、4）
            const optionPattern = /[A-D]\.|[1-4]\.|[A-D]）|[1-4]）/g;
            const optionMatches = text.match(optionPattern);
            if (optionMatches && optionMatches.length >= 2) {
                score += 1500; // 选项结构加分
            }
            
            // 检查是否包含数学公式或特殊符号
            const mathPattern = /[∑∫∂√π≤≥≠±×÷]/g;
            if (mathPattern.test(text)) {
                score += 800; // 数学内容加分
            }

            if (score > maxScore) {
                maxScore = score;
                bestElement = element;
            }
        }

        return bestElement;
    }

    // 优化区域截图
    async captureOptimizedArea(element) {
        const rect = element.getBoundingClientRect();
        
        // 智能扩展截图区域
        const expandedArea = this.expandCaptureArea(element, rect);
        
        // 确保区域在视窗范围内
        const captureArea = {
            x: Math.max(0, expandedArea.x),
            y: Math.max(0, expandedArea.y),
            width: Math.min(window.innerWidth - expandedArea.x, expandedArea.width),
            height: Math.min(window.innerHeight - expandedArea.y, expandedArea.height)
        };

        // 高亮目标区域（可选，用于调试）
        // this.highlightArea(captureArea);

        // 请求截图
        await this.requestScreenshot(captureArea);
    }

    // 智能扩展截图区域
    expandCaptureArea(element, rect) {
        let padding = 20;
        let expandedRect = {
            x: rect.left - padding,
            y: rect.top - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2
        };

        // 查找相关的选项、图片和其他内容
        const relatedElements = this.findRelatedElements(element);
        
        // 扩展区域以包含相关元素
        for (const relatedElement of relatedElements) {
            const relatedRect = relatedElement.getBoundingClientRect();
            
            // 扩展边界
            expandedRect.x = Math.min(expandedRect.x, relatedRect.left - padding);
            expandedRect.y = Math.min(expandedRect.y, relatedRect.top - padding);
            
            const rightEdge = Math.max(
                expandedRect.x + expandedRect.width,
                relatedRect.right + padding
            );
            const bottomEdge = Math.max(
                expandedRect.y + expandedRect.height,
                relatedRect.bottom + padding
            );
            
            expandedRect.width = rightEdge - expandedRect.x;
            expandedRect.height = bottomEdge - expandedRect.y;
        }

        return expandedRect;
    }

    // 查找相关元素（选项、图片等）
    findRelatedElements(element) {
        const relatedElements = [];
        const searchRadius = 300;
        const elementRect = element.getBoundingClientRect();
        
        // 查找附近的选项元素
        const optionSelectors = [
            'input[type="radio"]', 'input[type="checkbox"]',
            '.option', '.choice', '[class*="option"]', '[class*="choice"]',
            'li', 'div[class*="item"]'
        ];
        
        for (const selector of optionSelectors) {
            const options = document.querySelectorAll(selector);
            for (const option of options) {
                const optionRect = option.getBoundingClientRect();
                const distance = this.calculateDistance(
                    elementRect.left + elementRect.width / 2,
                    elementRect.top + elementRect.height / 2,
                    optionRect.left + optionRect.width / 2,
                    optionRect.top + optionRect.height / 2
                );
                
                if (distance < searchRadius) {
                    relatedElements.push(option);
                }
            }
        }
        
        // 查找附近的图片
        const images = document.querySelectorAll('img, canvas, svg');
        for (const img of images) {
            const imgRect = img.getBoundingClientRect();
            const distance = this.calculateDistance(
                elementRect.left + elementRect.width / 2,
                elementRect.top + elementRect.height / 2,
                imgRect.left + imgRect.width / 2,
                imgRect.top + imgRect.height / 2
            );
            
            if (distance < searchRadius && imgRect.width > 50 && imgRect.height > 50) {
                relatedElements.push(img);
            }
        }
        
        return relatedElements;
    }

    // 基于鼠标位置的截图
    async captureMouseBasedArea() {
        // 以鼠标为中心的智能区域
        const areaSize = 400; // 截图区域大小
        const captureArea = {
            x: Math.max(0, this.mouseX - areaSize / 2),
            y: Math.max(0, this.mouseY - areaSize / 2),
            width: Math.min(window.innerWidth, areaSize),
            height: Math.min(window.innerHeight, areaSize)
        };

        await this.requestScreenshot(captureArea);
    }

    // 保底全屏截图
    async captureFullScreen() {
        console.log('Executing fallback full screen capture');
        await this.requestScreenshot(null); // null 表示全屏
    }

    // 请求截图
    async requestScreenshot(area = null) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { action: "takeScreenshot", area: area },
                async (dataUrl) => {
                    if (dataUrl) {
                        try {
                            await this.copyToClipboard(dataUrl, area);
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
    async copyToClipboard(dataUrl, area) {
        try {
            // 如果是区域截图，需要裁剪图片
            let finalDataUrl = dataUrl;
            
            if (area) {
                finalDataUrl = await this.cropImage(dataUrl, area);
            }

            // 转换为 Blob
            const response = await fetch(finalDataUrl);
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

    // 裁剪图片
    async cropImage(dataUrl, area) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                // 计算设备像素比
                const dpr = window.devicePixelRatio || 1;
                
                canvas.width = area.width * dpr;
                canvas.height = area.height * dpr;
                
                ctx.drawImage(
                    img,
                    area.x * dpr, area.y * dpr, area.width * dpr, area.height * dpr,
                    0, 0, area.width * dpr, area.height * dpr
                );
                
                resolve(canvas.toDataURL('image/png'));
            };

            img.src = dataUrl;
        });
    }

    // 设置保底机制
    setFallbackMechanism() {
        this.fallbackTimeout = setTimeout(async () => {
            if (this.isProcessing) {
                console.log('Fallback mechanism triggered - executing full screen capture');
                await this.captureFullScreen();
                this.isProcessing = false;
            }
        }, 3000); // 3秒超时
    }

    // 清除保底超时
    clearFallbackTimeout() {
        if (this.fallbackTimeout) {
            clearTimeout(this.fallbackTimeout);
            this.fallbackTimeout = null;
        }
    }

    // 调试用：高亮区域
    highlightArea(area) {
        const highlight = document.createElement('div');
        highlight.style.cssText = `
            position: fixed;
            left: ${area.x}px;
            top: ${area.y}px;
            width: ${area.width}px;
            height: ${area.height}px;
            border: 2px solid red;
            background: rgba(255, 0, 0, 0.1);
            z-index: 10000;
            pointer-events: none;
        `;
        
        document.body.appendChild(highlight);
        
        setTimeout(() => {
            document.body.removeChild(highlight);
        }, 1000);
    }
}

// 创建智能截图实例
const smartScreenshot = new SmartScreenshot();

// 执行截图
smartScreenshot.takeSmartScreenshot();