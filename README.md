# vscode2telegram 🚀

讓 Telegram 能夠控制 VSCode，執行指令並回傳結果。

## ⭐ 項目亮點

- **雙向通信**：Telegram ↔ VSCode 即時互動
- **AI 集成**：直接調用 GitHub Copilot API (vscode.lm)
- **安全防護**：用戶白名單、危險命令黑名單、頻率限制
- **完整測試**：94 個測試，商業級別 QA
- **設計文檔**：100% 符合原始設計

## 🛠️ 技術棧

| 層 | 技術 |
|----|------|
| Telegram Bot | grammy |
| WebSocket | ws (Node.js) |
| VSCode | vscode.lm API, Extension SDK |
| 測試 | Vitest |
| 語言 | TypeScript (ES Modules) |
| 運行環境 | Node.js 20+, VSCode 1.90+ |

## 📁 目錄結構

```
vscode2telegram/
├── src/
│   ├── bot/                    # Telegram Bot
│   │   ├── commands/           # 指令處理
│   │   ├── formatters/        # 訊息格式化
│   │   └── middleware/         # 中間件
│   ├── bridge/                 # 橋接層
│   │   ├── ws-server.ts       # WebSocket 服務器
│   │   └── session-manager.ts # 對話會話管理
│   └── shared/                # 共享類型
│
├── extension/                  # VSCode 插件
│   └── src/
│       ├── ws-client.ts       # WebSocket 客戶端
│       ├── lm-handler.ts      # vscode.lm API
│       ├── terminal-runner.ts # 終端執行
│       └── file-manager.ts    # 文件管理
│
└── tests/                      # 測試 (94 tests)
```

## ⚡ 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 配置環境變量

```bash
cp .env.example .env
```

編輯 `.env`：
```bash
TELEGRAM_BOT_TOKEN=your_bot_token
ALLOWED_TELEGRAM_USER_IDS=your_user_id
```

### 3. 運行 Bridge Server

```bash
npm run dev
```

### 4. 安裝 VSCode 插件

將 `extension/` 文件夾複製到 VSCode 插件目錄並安裝。

## 📋 指令列表

| 指令 | 描述 |
|------|------|
| `/start` | 顯示歡迎訊息 |
| `/chat <message>` | 與 Agent 對話 |
| `/terminal <command>` | 執行終端命令 |
| `/run [file]` | 執行代碼 |
| `/file <path>` | 讀取檔案 |
| `/edit <path> <content>` | 寫入檔案（需確認） |
| `/ls [path]` | 列出檔案 |
| `/status` | 連接狀態 |
| `/clear` | 清空歷史 |
| `/cancel` | 取消請求 |

## 🧪 測試

```bash
npm test
```

結果：**94 tests passed**

## 🔒 安全配置

```bash
# 允許的用戶 ID（多個用逗號分隔）
ALLOWED_TELEGRAM_USER_IDS=123456789,987654321

# 危險命令黑名單
BLOCKED_COMMANDS=rm -rf,sudo,chmod 777

# 頻率限制 (每分鐘請求數)
RATE_LIMIT_MAX=20
```

## 📊 測試覆蓋

| 測試類型 | 數量 |
|---------|------|
| 單元測試 | 90 |
| 商業級別 QA | 74 |
| Rate Limit | 16 |
| LM Handler | 23 |
| **總計** | **94** |

## 🌐 部署

### 服務器部署

```bash
# 生產構建
npm run build

# 使用 PM2 運行
pm2 start dist/bot/index.js --name vscode2telegram
```

### Docker 部署

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install
CMD ["npm", "run", "dev"]
```

## 📝 License

MIT

## 🔗 倉庫

https://github.com/Liangwei-zhang/vscode2telegram