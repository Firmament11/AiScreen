# AI Screen - 智能截图分析工具

一个基于腾讯云混元AI的智能截图分析工具，包含Web应用和浏览器插件。

## 功能特性

- 🖼️ 智能截图分析
- 🤖 基于腾讯云混元AI的图像理解
- 🌐 Web界面和浏览器插件
- 🔒 安全的环境变量配置
- ⚡ 实时WebSocket通信

## 项目结构

```
AiScreen/
├── myapp/              # Web应用
│   ├── server.py       # FastAPI后端服务
│   ├── index.html      # 前端页面
│   ├── script.js       # 前端JavaScript
│   ├── style.css       # 样式文件
│   ├── requirements.txt # Python依赖
│   ├── .env.example    # 环境变量模板
│   └── .gitignore      # Git忽略文件
└── plugin/             # 浏览器插件
    ├── manifest.json   # 插件配置
    ├── background.js   # 后台脚本
    └── content.js      # 内容脚本
```

## 安装和配置

### 1. 克隆项目

```bash
git clone https://github.com/Firmament11/AiScreen.git
cd AiScreen
```

### 2. 配置环境变量

1. 复制环境变量模板：
   ```bash
   cd myapp
   copy .env.example .env
   ```

2. 编辑 `.env` 文件，填入您的腾讯云API密钥：
   ```
   TENCENT_SECRET_ID=your_secret_id_here
   TENCENT_SECRET_KEY=your_secret_key_here
   ```

### 3. 安装Python依赖

```bash
cd myapp
pip install -r requirements.txt
```

### 4. 运行Web应用

```bash
python server.py
```

应用将在 `http://localhost:8080` 启动。

## 浏览器插件安装

1. 打开Chrome浏览器
2. 进入扩展程序管理页面 (`chrome://extensions/`)
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目中的 `plugin` 文件夹

## 使用方法

### Web应用
1. 访问 `http://localhost:8080`
2. 点击"开始截图"按钮
3. 系统会自动截取屏幕并进行AI分析
4. 查看分析结果

### 浏览器插件
1. 安装插件后，点击浏览器工具栏中的插件图标
2. 插件会自动截取当前页面并发送给AI分析
3. 在插件弹窗中查看分析结果

## 技术栈

- **后端**: FastAPI, Python
- **前端**: HTML, CSS, JavaScript
- **AI服务**: 腾讯云混元AI
- **通信**: WebSocket
- **图像处理**: Pillow
- **浏览器插件**: Chrome Extension API

## 安全说明

- ✅ API密钥通过环境变量安全存储
- ✅ `.env` 文件已添加到 `.gitignore`
- ✅ 提供 `.env.example` 作为配置模板
- ✅ 代码中不包含任何硬编码密钥

## 注意事项

1. 请确保您有有效的腾讯云账户和混元AI服务权限
2. 不要将 `.env` 文件提交到版本控制系统
3. 定期更新您的API密钥以确保安全

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！