import asyncio
import io
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from starlette.responses import FileResponse, Response
from PIL import ImageGrab, Image
import logging
import os
import base64
import json
from dotenv import load_dotenv
from tencentcloud.common import credential
from tencentcloud.common.exception.tencent_cloud_sdk_exception import TencentCloudSDKException
from tencentcloud.hunyuan.v20230901 import hunyuan_client, models

# Load environment variables from .env file
load_dotenv()

# --- Tencent Cloud Credentials ---
# **重要：请在下方填入您的腾讯云API密钥**
# 建议使用环境变量以提高安全性
TENCENT_SECRET_ID = os.environ.get("TENCENT_SECRET_ID")
TENCENT_SECRET_KEY = os.environ.get("TENCENT_SECRET_KEY")

# --- Configuration ---
HOST = "0.0.0.0"  # 监听所有网络接口
PORT = 8080
logging.basicConfig(level=logging.INFO)

# --- FastAPI App Setup ---
app = FastAPI()

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logging.info("一个客户端已连接")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logging.info("一个客户端已断开连接")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

# --- Real AI Function ---
async def get_ai_solution(image: Image.Image) -> str:
    """
    调用腾讯云混元大模型进行图片解答。
    """
    if TENCENT_SECRET_ID == "YOUR_SECRET_ID" or TENCENT_SECRET_KEY == "YOUR_SECRET_KEY":
        error_msg = "错误：腾讯云API密钥未配置。请在 server.py 文件中填写 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY"
        logging.error(error_msg)
        return error_msg

    try:
        logging.info(f"检测到新图片 (大小: {image.size})，正在调用腾讯混元模型...")

        # 1. 将图片转换为Base64编码
        buffered = io.BytesIO()
        # 确保图片是RGB格式以兼容JPEG
        if image.mode != 'RGB':
            image = image.convert('RGB')
        image.save(buffered, format="JPEG")
        img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')

        # 2. 设置腾讯云凭证和客户端 (建议选择离您最近的地域，如 "ap-guangzhou")
        cred = credential.Credential(TENCENT_SECRET_ID, TENCENT_SECRET_KEY)
        client = hunyuan_client.HunyuanClient(cred, "ap-guangzhou")

        # 3. 使用SDK标准对象构建请求（确保图片被正确识别）
        req = models.ChatCompletionsRequest()
        req.Model = "hunyuan-turbos-vision-20250619"

        # 记录图片Base64长度，便于排查
        logging.info(f"Image base64 length: {len(img_str)}")

        # 构造用户消息
        user_message = models.Message()
        user_message.Role = "user"

        # 图片内容：使用正确的混元API格式
        content_image = models.Content()
        content_image.Type = "image_url"
        content_image.ImageUrl = models.ImageUrl()
        content_image.ImageUrl.Url = f"data:image/jpeg;base64,{img_str}"

        # 文本提示词
        content_text = models.Content()
        content_text.Type = "text"
        content_text.Text = (
            "你是一位资深的前端面试官。请根据图片中的题目类型，采用不同的回答策略：\n\n"
            "**选择题**：直接给出答案选项和核心考点，无需详细步骤。格式：答案：X。考点：xxx。\n\n"
            "**简答题**：\n"
            "1. **答案**：直接给出核心答案\n"
            "2. **解析**：简要说明原理和关键点\n\n"
            "**代码题**：\n"
            "1. **思路**：一句话概括解题思路\n"
            "2. **代码**：提供简洁代码，每行不超过40字符，适当换行\n"
            "3. **要点**：关键逻辑说明\n\n"
            "要求：回答简洁明了，确保内容能在一个手机屏幕内完整显示，避免冗长解释。使用Markdown格式。"
        )

        user_message.Contents = [content_text, content_image]
        req.Messages = [user_message]

        # 4. 发送请求并获取结果
        resp = client.ChatCompletions(req)
        
        # 5. 解析并返回答案
        answer = resp.Choices[0].Message.Content
        logging.info("成功获取AI解答。")
        return answer

    except TencentCloudSDKException as err:
        logging.error(f"调用腾讯云API失败: {err}")
        return f"AI接口调用失败: {err}"
    except Exception as e:
        logging.error(f"处理图片或API请求时发生未知错误: {e}")
        return f"发生未知错误: {e}"

# --- Clipboard Monitoring Background Task ---
async def clipboard_monitor():
    """在后台监控剪贴板，并在检测到新图片时广播结果。"""
    last_image_bytes = None
    logging.info("剪贴板监控已启动...")
    while True:
        try:
            image = ImageGrab.grabclipboard()
            if image and isinstance(image, Image.Image):
                current_image_bytes = image.tobytes()
                if current_image_bytes != last_image_bytes:
                    last_image_bytes = current_image_bytes
                    # 广播正在处理的状态
                    processing_message = json.dumps({"status": "processing"})
                    await manager.broadcast(processing_message)
                    
                    # 获取AI解答
                    solution = await get_ai_solution(image)
                    
                    # 广播最终结果
                    result_message = json.dumps({"status": "success", "content": solution})
                    await manager.broadcast(result_message)
        except Exception:
            # 剪贴板没有图片或内容格式不支持时，ImageGrab会抛出异常或返回None
            pass
        await asyncio.sleep(2)  # 每2秒检查一次

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(clipboard_monitor())

# --- WebSocket Endpoint ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # 保持连接开放以接收服务器的推送
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# --- Static File Serving ---
@app.get('/favicon.ico', include_in_schema=False)
async def favicon_route():
    return Response(status_code=204)

@app.get("/")
async def read_root():
    return FileResponse('index.html')

@app.get("/{filename:path}")
async def read_static_files(filename: str):
    return FileResponse(filename)

# --- To run this server ---
# 1. pip install -r requirements.txt
# 2. uvicorn server:app --host 0.0.0.0 --port 8080