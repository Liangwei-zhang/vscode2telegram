// bot/commands/help.ts - 幫助指令
import { Context } from 'grammy';

const HELP_TEXT = `🤖 VSCode2Telegram 指令列表

📝 基本指令
/start - 開始使用
/help - 顯示幫助
/status - 連接狀態
/projects - 列出所有已連接的 VSCode 窗口
/use <項目名> - 切換要操作的項目
/stats - 系統統計

🤖 AI Agent（直接操作項目）
/agent <任務> - AI 自動讀取全部代碼、修改文件、執行命令
  例: /agent 幫我對這個項目做 QA 並修復潜在 bug
  例: /agent 新增一個 /ping 指令到 Telegram bot
  例: /agent git commit 所有未提交的變更

💬 AI 對話（自動感知當前文件+項目結構）
/chat <message> - 與 AI 對話（自動注入當前文件+項目結構）
/qa [問題] - 讀取項目所有源碼做全面 QA（不傳問題則做通用 QA）
直接發文字 - 等同 /chat
/clear - 清空對話歷史
/cancel - 取消請求

📎 引用文件（類似 Copilot #file）
在消息中加 #file:路徑 引用任意文件，例如：
/chat #file:src/bot/index.ts 幫我重構這個文件
/chat #file:src/shared/types.ts 這個類型定義有什麼問題

💻 終端命令
/terminal <command> - 執行終端命令
/run [file] - 執行代碼

📁 文件操作
/file <path> - 讀取文件
/ls [path] - 列出文件
/edit <path> <content> - 寫入文件
/delete <path> - 刪除文件或目錄
/mkdir <path> - 建立目錄

⚙️ 快速範例
/terminal ls -la
/chat 當前文件有什麼問題？
/chat #file:src/bot/index.ts 解釋這個文件的結構
/file src/index.ts

🔒 安全
- 用戶白名單驗證
- 危險命令黑名單
- 頻率限制`;

export async function helpCommand(ctx: Context) {
  await ctx.reply(HELP_TEXT);
}