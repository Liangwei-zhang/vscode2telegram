# vscode2telegram

讓 Telegram 能夠控制 VSCode，執行指令並回傳結果。

## 功能

- 🔌 Telegram Bot 接收指令
- 📝 發送指令到 VSCode Extension
- 📊 執行結果回傳到 Telegram
- 🔄 雙向通信

## 架構

```
[Telegram] → [Bot API] → [VSCode Extension] → [Terminal/Output]
     ↑____________________________|
```

## 快速開始

### 1. 安裝 Telegram Bot

```bash
npm install
```

### 2. 配置環境變量

```bash
cp .env.example .env
# 編輯 .env 填入你的 Telegram Bot Token
```

### 3. 運行

```bash
npm run dev
```

## 指令範例

- `/run` - 執行當前文件
- `/terminal <command>` - 執行終端命令
- `/file <path>` - 讀取文件內容
- `/output` - 獲取 VSCode Output

## License

MIT