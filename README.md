# vscode2telegram 🚀

讓 Telegram 能夠控制 VSCode，執行指令並回傳結果。

## ⭐ 項目亮點

- **雙向通信**：Telegram ↔ VSCode 即時互動
- **AI 集成**：直接調用 GitHub Copilot API (vscode.lm)
- **安全防護**：用戶白名單、危險命令黑名單、頻率限制
- **完整測試**：90 個測試，商業級別 QA
- **生產級別**：配置管理、日誌、錯誤處理、健康檢查、指標準集

## 🛠️ 技術棧

| 層 | 技術 |
|----|------|
| **Telegram Bot** | grammy |
| **WebSocket** | ws (Node.js) |
| **VSCode** | vscode.lm API, Extension SDK |
| **測試** | Vitest |
| **語言** | TypeScript (ES Modules) |
| **運行環境** | Node.js 20+, VSCode 1.90+ |

## 📁 目錄結構

```
vscode2telegram/
│
├── src/
│   ├── bot/                    # Telegram Bot
│   │   ├── commands/           # 指令處理
│   │   │   ├── chat.ts       # /chat AI對話
│   │   │   ├── terminal.ts   # /terminal 執行命令
│   │   │   ├── file.ts       # /file, /ls 文件操作
│   │   │   ├── edit.ts       # /edit 寫入文件
│   │   │   ├── cancel.ts     # /cancel 取消請求
│   │   │   ├── status.ts    # /status 狀態
│   │   │   ├── stats.ts      # /stats 統計
│   │   │   └── help.ts      # /help 幫助
│   │   │
│   │   ├── formatters/       # 訊息格式化
│   │   │   ├── markdown.ts  # Markdown轉換
│   │   │   └── code-block.ts# 代碼塊截斷
│   │   │
│   │   ├── middleware/       # 中間件
│   │   │   ├── auth.ts       # 用戶白名單
│   │   │   └── rate-limit.ts # 頻率限制
│   │   │
│   │   ├── config.ts        # 配置管理
│   │   └── index.ts         # Bot入口
│   │
│   ├── bridge/               # 橋接層
│   │   ├── ws-server.ts    # WebSocket服務器
│   │   ├── session-manager.ts # 對話會話
│   │   ├── health-check.ts # 健康檢查
│   │   └── metrics.ts      # 指標準集
│   │
│   └── shared/              # 共享模組
│       ├── types.ts        # 類型定義
│       ├── logger.ts       # 日誌系統
│       └── errors.ts       # 錯誤處理
│
├── extension/                # VSCode 插件
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── extension.ts    # 插件入口
│       ├── ws-client.ts   # WebSocket客戶端
│       ├── lm-handler.ts  # vscode.lm API
│       ├── terminal-runner.ts # 終端執行
│       ├── file-manager.ts # 文件管理
│       └── command-dispatcher.ts # 指令分發
│
└── tests/                   # 測試 (90 tests)
    ├── types.test.ts
    ├── auth.test.ts
    ├── session-manager.test.ts
    ├── command-dispatcher.test.ts
    ├── lm-handler.test.ts
    ├── rate-limit.test.ts
    └── bot-integration.test.ts
```

## 📋 指令列表

| 指令 | 描述 |
|------|------|
| `/start` | 顯示歡迎訊息 |
| `/help` | 顯示完整幫助 |
| `/chat <message>` | 與 AI 對話 |
| `/terminal <command>` | 執行終端命令 |
| `/run [file]` | 執行代碼 |
| `/file <path>` | 讀取檔案 |
| `/edit <path> <content>` | 寫入檔案（需確認） |
| `/ls [path]` | 列出檔案 |
| `/status` | 連接狀態 |
| `/stats` | 系統統計 |
| `/clear` | 清空歷史 |
| `/cancel` | 取消請求 |

## 🧪 測試覆蓋

```
 Test Files  7 passed (7)
      Tests  90 passed (90)
```

| 測試類型 | 數量 |
|---------|------|
| 單元測試 | 90 |
| 商業級別 QA | 74 |
| Rate Limit | 16 |
| LM Handler | 23 |

## 🔒 安全配置

```bash
# 允許的用戶 ID
ALLOWED_TELEGRAM_USER_IDS=123456789

# 危險命令黑名單
BLOCKED_COMMANDS=rm -rf,sudo,chmod 777

# 頻率限制
RATE_LIMIT_MAX=20
```

## 🚀 快速開始

```bash
# 安裝
npm install

# 配置
cp .env.example .env

# 運行
npm run dev

# 測試
npm test
```

## 📊 版本

- **v1.0**: 基礎功能完成
- **v2.0**: 生產級別優化（配置、日誌、錯誤、健康檢查、指標準集）

## 📝 License

MIT

## 🔗 倉庫

https://github.com/Liangwei-zhang/vscode2telegram