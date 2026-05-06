# SmartStudy - 个人 AI 学习助手

SmartStudy 是一款面向初中生的 AI 一对一家教 App，由 React Native (Expo) 构建。它通过 DeepSeek API 提供智能辅导，涵盖数学、物理、化学、英语、语文等九大学科。

## 功能特性

- **AI 一对一家教** — 苏格拉底式引导教学，分步启发而非直接给答案
- **多学科覆盖** — 数学、物理、化学、英语、语文、历史、地理、生物、道德与法治
- **图片识别** — 拍照上传题目，自动 OCR 识别并解答
- **多模态教学** — 复杂几何图/函数图自动切换到多模态模型处理
- **智能路由** — 自动识别学生意图（讲题、对答案、复习、反馈等）
- **质量审查** — AI 评审机制，回答不合格自动换更优模型重试
- **学习画像** — 自动追踪薄弱点、优势点、常见错误，每 5 次对话更新学情报告
- **错题本** — 自动记录错题，支持按学科分类
- **知识图谱** — 知识点掌握度追踪
- **历史记录** — 对话历史查看与恢复
- **API 用量统计** — 追踪各模型调用次数和 Token 消耗，上报到自有服务端（可选）

## 技术架构

```
App (React Native / Expo)
  │
  ├─ DeepSeekClient ──── API 调用层（封装 DeepSeek API）
  ├─ Router             意图路由判断
  ├─ Teacher            教学生成引擎（支持工具调用：计算器、网络搜索）
  ├─ Reviewer           回答质量审查
  ├─ TopicDetector      换题检测
  ├─ MultimodalClient   OCR / 多模态图片识别（通义千问 VL）
  ├─ ApiUsageTracker    API 用量追踪与上报
  │
  └─ MemoryManager      本地存储管理（SQLite）
       ├─ 学生学习画像
       ├─ 对话历史
       ├─ 错题本 / 知识图谱 / 黑名单
       └─ API 调用记录
```

### 模型分层

| 层级 | 用途 | 默认模型 |
|------|------|---------|
| Fast | 教学生成、路由判断、话题检测 | `deepseek-chat` |
| Flagship | 审查失败后升级重试 | `deepseek-v4-flash` |
| OCR | 图片文字提取与多模态对话 | `qwen3.6-plus` (DashScope) |

## 快速开始

### 环境要求

- Node.js >= 18
- Android Studio (Android 构建)
- JDK 17
- Android SDK (API 35+)

### 安装

```bash
# 克隆项目
git clone https://github.com/Fakerol-111/SmartStudy-Junior.git
cd mobile

# 安装依赖
npm install
```

### 配置

复制环境变量模板并填入你的 API Key：

```bash
cp .env.example .env
```

填入以下密钥（可在对应平台免费申请）：

| 变量 | 说明 | 获取地址 |
|------|------|---------|
| `EXPO_PUBLIC_DEEPSEEK_API_KEY` | DeepSeek API Key | https://platform.deepseek.com |
| `EXPO_PUBLIC_OCR_API_KEY` | 阿里云 DashScope Key | https://dashscope.aliyun.com |
| `EXPO_PUBLIC_TELEMETRY_ENDPOINT` | 用量统计接收地址（可选） | 见下方说明 |

### 启动

```bash
# 开发模式
npx expo start

# 直接构建 APK
bash build-android.sh
```

APK 生成路径：`android/app/build/outputs/apk/debug/app-debug.apk`

## API 用量统计（可选）

SmartStudy 内置 API 用量追踪功能，可主动上报模型调用次数和 Token 消耗。

### 数据格式

每条调用记录包含：
```json
{
  "deviceId": "自动生成的设备 UUID",
  "model": "deepseek-chat",
  "component": "handler",
  "promptTokens": 150,
  "completionTokens": 80,
  "totalTokens": 230,
  "timestamp": "2026-05-06T10:30:00.000Z"
}
```

### 服务端配置（Cloudflare Worker）

1. 创建 Worker，绑定 KV 命名空间（binding: `USAGE_KV`）
2. 部署 `api-usage-worker.js` 中的代码
3. 在 `.env` 中设置 `EXPO_PUBLIC_TELEMETRY_ENDPOINT`

不配置端点则仅本地记录，不影响 App 功能。

## 项目结构

```
mobile/
├── App.tsx                  # 主入口（聊天界面）
├── prompts/
│   ├── config.json          # AI 教学 Prompt 配置（角色、学科、意图）
│   └── instructions.json    # 模块指令（路由、审查、多模态、画像）
├── src/
│   ├── core/
│   │   ├── deepseek.ts      # DeepSeek API 客户端
│   │   ├── harness.ts       # 核心流程编排
│   │   ├── router.ts        # 意图路由判断器
│   │   ├── teacher.ts       # 教学生成引擎
│   │   ├── reviewer.ts      # 回答质量审查
│   │   ├── topicDetector.ts # 换题检测
│   │   ├── multimodalClient.ts # OCR/多模态客户端
│   │   ├── apiUsageTracker.ts  # API 用量追踪
│   │   ├── memoryManager.ts # 本地存储管理
│   │   ├── systemPrompt.ts  # 系统 Prompt 构建
│   │   ├── safety.ts        # 安全过滤
│   │   └── types.ts         # 类型定义
│   ├── db/
│   │   ├── database.ts      # SQLite 数据库初始化
│   │   └── repository.ts    # 数据仓库层
│   ├── components/          # UI 组件
│   ├── tools/               # AI 工具（计算器、网络搜索）
│   └── data/                # 测试数据
├── api-usage-worker.js      # Cloudflare Worker 接收端
├── wrangler.toml            # Cloudflare Worker 配置
└── build-android.sh         # Android APK 构建脚本
```

## 安全说明

- `.env` 文件包含 API Key 等敏感信息，不会提交到 git
- 参考 `.env.example` 了解需要配置的环境变量

## 许可

MIT
