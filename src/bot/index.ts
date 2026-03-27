// bot/index.ts - Bot 入口，grammy 初始化
import { Bot, Context } from 'grammy';
import dotenv from 'dotenv';
import { BridgeServer } from '../bridge/ws-server.js';
import { SessionManager } from '../bridge/session-manager.js';
import { statusCommand } from './commands/status.js';
import { terminalCommand } from './commands/terminal.js';
import { chatCommand } from './commands/chat.js';
import { fileCommand, runCommand } from './commands/file.js';
import { authMiddleware } from './middleware/auth.js';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN || '';
if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

const bot = new Bot(token);

// 初始化 Bridge Server 和 Session Manager
const bridgeServer = new BridgeServer(3456);
const sessionManager = new SessionManager();

// 中間件
bot.use(authMiddleware);

// 指令處理
bot.command('start', async (ctx) => {
  await ctx.reply(
    '✅ VSCode2Telegram 已連接！\n\n' +
    '可用指令：\n' +
    '/chat <message> - 與 Agent 對話\n' +
    '/terminal <command> - 執行終端命令\n' +
    '/file <path> - 讀取文件\n' +
    '/ls [path] - 列出文件\n' +
    '/run [file] - 執行代碼\n' +
    '/status - 連接狀態\n' +
    '/clear - 清空對話歷史'
  );
});

bot.command('status', async (ctx) => {
  await statusCommand(ctx, bridgeServer);
});

bot.command('clear', async (ctx) => {
  const userId = ctx.from?.id || 0;
  sessionManager.clearHistory(userId);
  await ctx.reply('✅ 對話歷史已清空');
});

bot.command('terminal', async (ctx) => {
  const command = ctx.message?.text.split(' ').slice(1).join(' ');
  if (!command) {
    await ctx.reply('❌ 請輸入命令\n例如: /terminal ls -la');
    return;
  }
  await terminalCommand(ctx, command, bridgeServer);
});

bot.command('chat', async (ctx) => {
  const message = ctx.message?.text.split(' ').slice(1).join(' ');
  if (!message) {
    await ctx.reply('❌ 請輸入消息\n例如: /chat 帮我写一个函数');
    return;
  }
  await chatCommand(ctx, message, bridgeServer, sessionManager);
});

bot.command('file', async (ctx) => {
  const path = ctx.message?.text.split(' ').slice(1).join(' ');
  if (!path) {
    await ctx.reply('❌ 請輸入檔案路徑\n例如: /file src/index.ts');
    return;
  }
  await fileCommand(ctx, path, 'read', bridgeServer);
});

bot.command('ls', async (ctx) => {
  const path = ctx.message?.text.split(' ').slice(1).join(' ') || '';
  await fileCommand(ctx, path, 'list', bridgeServer);
});

bot.command('run', async (ctx) => {
  const filePath = ctx.message?.text.split(' ').slice(1)[0];
  await runCommand(ctx, filePath, bridgeServer);
});

bot.on('message:text', async (ctx) => {
  if (ctx.message?.text.startsWith('/')) return;
  const message = ctx.message?.text;
  if (message) {
    await chatCommand(ctx, message, bridgeServer, sessionManager);
  }
});

console.log('🤖 VSCode2Telegram Bot 啟動中...');
bot.start();
console.log('🤖 Bot 運行中...');

process.on('SIGINT', () => {
  console.log('👋 關閉中...');
  bot.stop();
  process.exit(0);
});