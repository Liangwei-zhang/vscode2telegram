// bot/commands/help.ts - 幫助指令
import { Context } from 'grammy';

const HELP_TEXT = `🤖 VSCode2Telegram 指令列表

📝 基本指令
/start - 開始使用
/help - 顯示幫助
/status - 連接狀態
/stats - 系統統計

💬 AI 對話
/chat <message> - 與 AI 對話
/clear - 清空對話歷史
/cancel - 取消請求

💻 終端命令
/terminal <command> - 執行終端命令
/run [file] - 執行代碼

📁 文件操作
/file <path> - 讀取文件
/ls [path] - 列出文件
/edit <path> <content> - 寫入文件

⚙️ 快速範例
/terminal ls -la
/chat 幫我寫一個函數
/file src/index.ts
/stats

🔒 安全
- 用戶白名單驗證
- 危險命令黑名單
- 頻率限制`;

export async function helpCommand(ctx: Context) {
  await ctx.reply(HELP_TEXT, { parse_mode: 'HTML' });
}