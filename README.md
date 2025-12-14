# 🌸 Waifu Generator AI

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-6.2-646CFF?style=flat-square&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/Gemini-AI-4285F4?style=flat-square&logo=google" alt="Gemini AI" />
</p>

<p align="center">
  <b>基于 Google Gemini AI 打造的深度角色扮演体验</b>
</p>

<p align="center">
  AI 生成独特角色 · 动态剧情对话 · 实时图片生成 · 好感度系统 · HE/BE 多结局
</p>

---

## ✨ 功能特色

### 🎭 智能角色生成
- **随机向导模式**: 选择世界观、种族、职业、性格，AI 自动生成完整人设
- **自定义模式**: 完全自定义角色设定，支持上传参考图片
- **四大世界观**: 现代都市、奇幻异界、东方古风、未来科幻
- **丰富种族/职业**: 从精灵、魅魔到赛博格，数十种选择

### 💬 深度 AI 对话
- **流式响应**: 实时显示 AI 回复，体验更自然
- **智能回复建议**: AI 根据剧情自动生成对话选项
- **情境感知**: AI 理解角色性格、好感度、当前场景
- **R18 成人模式**: 可选解锁更成熟的剧情内容

### 🖼️ 动态图片生成
- **角色立绘**: 根据描述生成角色肖像
- **场景插图**: 剧情关键时刻自动生成场景图
- **道具图片**: 获得道具时生成物品图标
- **双引擎支持**: Gemini 或 Gradio 图片生成服务

### 💕 好感度系统
- **0-1000 好感度**: 从厌恶到挚爱的完整情感曲线
- **动态变化**: 每次对话根据行为自动调整
- **秘密解锁**: 高好感度解锁角色隐藏秘密
- **结局触发**: 好感度影响 HE (Happy Ending) 或 BE (Bad Ending)

### 📦 游戏系统
- **背包系统**: 收集剧情中获得的道具
- **回忆画廊**: 保存精彩瞬间和 CG 图片
- **自动存档**: IndexedDB 本地存储，进度不丢失
- **多档位管理**: 同时进行多条故事线

---

## 🚀 快速开始

### 环境要求
- Node.js 18+
- 有效的 [Google Gemini API Key](https://aistudio.google.com/app/apikey)

### 安装

```bash
# 克隆项目
git clone https://github.com/Dev-Umb/wife-generate-game.git
cd wife-generate-game

# 安装依赖
yarn install
# 或
npm install

# 启动开发服务器
yarn dev
# 或
npm run dev
```

### 配置 API Key

首次运行时，应用会提示输入 Gemini API Key。你可以：
1. 在弹窗中直接输入 API Key
2. 或设置环境变量 `API_KEY`

---

## 🎮 使用指南

### 开始新游戏

1. **选择生成模式**
   - 🎲 **随机向导**: 选择世界观和属性，AI 生成角色
   - 📄 **自定义**: 手动填写角色设定
   - 📜 **历史记录**: 继续之前的存档

2. **配置选项**
   - ✨ AI 智能润色: 让 AI 优化你的设定
   - 🔞 R18 模式: 解锁成人内容 (需自行承担责任)
   - 🖼️ 图片服务: Gradio (推荐) 或 Gemini

3. **预览并开始**
   - 确认角色设定
   - 输入你的名字
   - 开始剧情！

### 游戏界面

| 区域 | 功能 |
|------|------|
| 左侧角色卡 | 查看角色信息、好感度、已解锁秘密 |
| 中央聊天区 | 与角色对话、查看场景图 |
| 右侧工具栏 | 背包、回忆画廊 |
| 底部输入框 | 发送消息或选择建议回复 |

### 特殊指令

在对话中可以触发特殊行为：
- 📍 **切换场景**: 说"我想去别的地方逛逛"
- 👋 **暂时分开**: 说"我先走了，晚点联系"
- ⏩ **快进时间**: 使用系统指令快进到下次见面

---

## 🛠️ 技术架构

```
waifu-generator-ai/
├── App.tsx                 # 主应用组件
├── types.ts                # TypeScript 类型定义
├── components/
│   ├── ApiKeyModal.tsx     # API Key 输入弹窗
│   ├── CharacterCard.tsx   # 角色信息卡片
│   ├── ChatInterface.tsx   # 聊天界面
│   ├── ConfirmModal.tsx    # 确认对话框
│   ├── Inventory.tsx       # 背包系统
│   ├── MemoryGallery.tsx   # 回忆画廊
│   ├── MobileNav.tsx       # 移动端导航
│   └── TextEditorModal.tsx # 文本编辑器
├── services/
│   ├── geminiService.ts    # Gemini AI 服务封装
│   └── storageService.ts   # IndexedDB 存储服务
└── index.html
```

### 核心技术

| 技术 | 用途 |
|------|------|
| **React 19** | UI 框架 |
| **TypeScript** | 类型安全 |
| **Vite** | 构建工具 |
| **@google/genai** | Gemini AI SDK |
| **IndexedDB** | 本地存储 |
| **Tailwind CSS** | 样式系统 |

### AI 功能调用 (Function Calling)

游戏使用 Gemini 的 Function Calling 能力实现动态交互：

- `updateAffection` - 更新好感度
- `updateVisualState` - 更新视觉状态
- `generateScene` - 生成场景图片
- `generateItem` - 生成道具
- `saveMemory` - 保存回忆
- `switchScene` - 切换场景
- `triggerEnding` - 触发结局
- `unlockSecret` - 解锁秘密

---

## 📝 配置说明

### 图片生成服务

| 服务 | 优点 | 缺点 |
|------|------|------|
| **Gradio** (默认) | 速度快、无内容限制 | 需要自建服务或使用公共端点 |
| **Gemini** | 官方服务、质量高 | 有内容安全限制 |

### 环境变量配置

复制 `.env.example` 为 `.env` 并配置：

```bash
cp .env.example .env
```

```env
# Gradio 图片生成服务地址 (必填，使用 Gradio 模式时)
VITE_GRADIO_ENDPOINT=https://your-gradio-endpoint.com/api/call/generate_image

# Gemini API Key (可选)
VITE_API_KEY=your_gemini_api_key_here
```

> ⚠️ `.env` 文件已添加到 `.gitignore`，不会被提交到 Git 仓库

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## ⚠️ 免责声明

- 本项目仅供学习和娱乐目的
- AI 生成内容不代表开发者观点
- 使用 R18 模式需确保符合当地法律法规
- 请勿将生成内容用于非法用途

---

## 📄 License

MIT License

---

<p align="center">
  Made with ❤️ and AI
</p>
