# AI 投标助手 (AI Bid Assistant)

> 专为企业投标团队打造的智能标书撰写平台。上传招标文件，AI 自动解析评分规则、提取废标条款、生成应标大纲、撰写章节内容，最终输出规范的 Word 文档。

## 功能特性

- **智能解析** — 上传 PDF/Word 招标文件，AI 自动提取评分标准、废标条款、投标要求
- **大纲生成** — 基于解析结果自动生成应标大纲，支持人工调整确认
- **内容撰写** — 结合企业知识库（资质、案例、方案）自动撰写各章节内容
- **Word 导出** — 一键生成格式规范的 Word 文档，含封面、目录、正文、签章区
- **知识库管理** — 上传企业资质、历史案例、技术方案，AI 自动引用
- **合规检查** — 自动检测标书是否满足招标文件要求
- **积分系统** — PayJS 支付集成，支持微信/支付宝充值

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query |
| 后端 | FastAPI (Python 3.12), SQLAlchemy async, Celery |
| 数据库 | PostgreSQL + pgvector (向量检索) |
| 缓存/队列 | Redis |
| AI | DeepSeek API, sentence-transformers, FlagEmbedding |
| OCR | PaddleOCR, PyMuPDF |
| 文档生成 | python-docx |
| 部署 | Docker Compose, nginx, Google Cloud Compute Engine |

## 快速开始

### 前提条件

- Docker & Docker Compose
- DeepSeek API Key

### 部署步骤

```bash
# 1. 克隆仓库
git clone https://github.com/lzqggghotmailcom/bid-ai-assistant.git
cd bid-ai-assistant

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY 和 SECRET_KEY

# 3. 启动所有服务
docker compose up -d

# 4. 初始化数据库扩展
docker exec bid-ai-assistant-db-1 psql -U biduser -d bid_assistant -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 5. 访问 http://localhost:3000
```

### 首次使用

1. 注册账号 → 登录
2. 在知识库上传企业资质和历史案例
3. 上传招标文件（PDF/Word）
4. AI 自动解析 → 确认大纲 → 生成内容
5. 预览满意后下载 Word 文档

## 环境变量

参见 `.env.example`：

| 变量 | 说明 | 必填 |
|------|------|------|
| SECRET_KEY | JWT 签名密钥 | 是 |
| DEEPSEEK_API_KEY | DeepSeek API 密钥 | 是 |
| CORS_ORIGINS | 跨域来源 | 否 |
| NEXT_PUBLIC_API_URL | 前端 API 地址 | 否 |
| PAYJS_MCHID | PayJS 商户号（可选） | 否 |
| PAYJS_KEY | PayJS 密钥（可选） | 否 |

## 积分计费

| 操作 | 消耗 |
|------|------|
| 上传招标文件 | 免费 |
| 解析 / 首次生成 / 预览 | 免费 |
| 下载 Word | 3 积分 |
| 重新生成章节 | 1 积分 |

| 套餐 | 价格 |
|------|------|
| 10 积分 | 10 元 |
| 50 积分 | 45 元 |
| 100 积分 | 80 元 |

## 项目结构

```
bid-ai-assistant/
├── backend/
│   ├── app/
│   │   ├── core/            # 配置、数据库、安全
│   │   ├── models/          # SQLAlchemy 模型
│   │   ├── routers/         # API 路由
│   │   ├── schemas/         # Pydantic 模型
│   │   └── services/        # 业务逻辑
│   │       ├── docx_engine/ # Word 文档引擎
│   │       ├── file_service/# 文件处理
│   │       ├── llm/         # 大模型调用
│   │       ├── orchestrator/# 编排层
│   │       ├── payment/     # 支付集成
│   │       ├── pdf_parser/  # PDF 解析
│   │       ├── rag/         # 知识库检索
│   │       └── tasks/       # Celery 异步任务
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── app/             # Next.js App Router 页面
│       ├── components/      # React 组件
│       ├── hooks/           # 自定义 Hooks
│       └── providers/       # Context Providers
├── docker-compose.yml
└── .env.example
```
