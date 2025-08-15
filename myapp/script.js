document.addEventListener('DOMContentLoaded', () => {
    const placeholder = document.getElementById('placeholder');
    const answerEl = document.getElementById('answer');
    const loader = document.querySelector('.loader');

    function connectWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws`;

        console.log(`正在连接到 WebSocket: ${wsUrl}`);
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('WebSocket 连接成功！');
            placeholder.querySelector('p').textContent = '已连接，等待电脑端复制题目...';
            loader.classList.add('hidden');
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('收到新消息:', data);

                if (data.status === 'processing') {
                    placeholder.querySelector('p').textContent = '📝 检测到新题目，AI正在分析中...';
                    loader.classList.remove('hidden');
                    placeholder.classList.remove('hidden');
                    answerEl.classList.add('hidden');
                } else if (data.status === 'success') {
                    loader.classList.add('hidden');
                    placeholder.classList.add('hidden');
                    answerEl.classList.remove('hidden');
                    // Use marked.js to render the markdown content
                    answerEl.innerHTML = marked.parse(data.content);
                    // 滚动到顶部，确保用户看到完整答案
                    answerEl.scrollTop = 0;
                }
            } catch (error) {
                // Fallback for non-JSON messages
                console.log('收到纯文本消息:', event.data);
                loader.classList.add('hidden');
                placeholder.classList.add('hidden');
                answerEl.classList.remove('hidden');
                answerEl.textContent = event.data;
            }
        };

        ws.onclose = () => {
            console.log('WebSocket 连接已断开，尝试在3秒后重连...');
            placeholder.querySelector('p').textContent = '连接已断开，正在尝试重连...';
            loader.classList.remove('hidden');
            placeholder.classList.remove('hidden');
            answerEl.classList.add('hidden');
            setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = (error) => {
            console.error('WebSocket 发生错误:', error);
            ws.close();
        };
    }

    connectWebSocket();
});