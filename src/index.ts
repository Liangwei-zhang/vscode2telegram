import { Bot, Context } from 'grammy';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN || '';
const bot = new Bot(token);

console.log('🤖 VSCode2Telegram Bot 啟動中...');

// 指令處理
bot.command('start', async (ctx) => {
  await ctx.reply('✅ VSCode2Telegram 已連接！\n\n可用指令：\n/run - 執行當前文件\n/terminal <command> - 執行終端命令\n/file <path> - 讀取文件\n/status - VSCode 狀態');
});

bot.command('status', async (ctx) => {
  await ctx.reply('🔄 VSCode 連接中...\nPort: 3456');
});

bot.command('run', async (ctx) => {
  // TODO: 發送到 VSCode Extension
  await ctx.reply('⏳ 執行中...');
});

bot.command('terminal', async (ctx) => {
  const command = ctx.message?.text.split(' ').slice(1).join(' ');
  if (!command) {
    await ctx.reply('❌ 請輸入命令\n例如: /terminal ls -la');
    return;
  }
  // TODO: 發送到 VSCode Extension
  await ctx.reply(`⏳ 執行: ${command}`);
});

bot.command('file', async (ctx) => {
  const path = ctx.message?.text.split(' ').slice(1).join(' ');
  if (!path) {
    await ctx.reply('❌ 請輸入檔案路徑\n例如: /file src/index.ts');
    return;
  }
  // TODO: 發送到 VSCode Extension
  await ctx.reply(`📝 讀取: ${path}`);
});

// 監聽所有訊息
bot.on('message', async (ctx) => {
  console.log('📩 收到:', ctx.message?.text);
});

bot.start();
console.log('🤖 Bot 運行中...');