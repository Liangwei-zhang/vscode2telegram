// bot/index.ts - Bot 入口，grammy 初始化
import { Bot, Context } from 'grammy';
import dotenv from 'dotenv';
import { BridgeServer } from '../bridge/ws-server.js';
import { SessionManager } from '../bridge/session-manager.js';
import { HealthCheck } from '../bridge/health-check.js';
import { statusCommand } from './commands/status.js';
import { terminalCommand } from './commands/terminal.js';
import { chatCommand } from './commands/chat.js';
import { fileCommand, runCommand } from './commands/file.js';
import { editCommand, handleConfirmEdit, handleCancelEdit } from './commands/edit.js';
import { statsCommand, topUsersCommand } from './commands/stats.js';
import { helpCommand } from './commands/help.js';
import { cancelCommand } from './commands/cancel.js';
import { projectsCommand, useCommand } from './commands/projects.js';
import { qaCommand } from './commands/qa.js';
import { deleteCommand, mkdirCommand } from './commands/fileops.js';
import { agentCommand } from './commands/agent.js';
import { proxyCommand, applyStartupProxy } from './commands/proxy.js';
import { modelCommand } from './commands/model.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { config } from './config.js';
import { logger, setupGlobalErrorHandlers } from '../shared/logger.js';
import { startMetricsCollection, stopMetricsCollection } from '../bridge/metrics.js';

dotenv.config();

// 設置全局錯誤處理
setupGlobalErrorHandlers();

// 應用啟動代理（如果 .env 中有 PROXY_URL）
const startupProxy = applyStartupProxy();
if (startupProxy) {
  console.log(`🌐 使用代理: ${startupProxy}`);
}

const token = process.env.TELEGRAM_BOT_TOKEN || '';
if (!token) {
  logger.error('TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

const bot = new Bot(token);

// 初始化 Bridge Server 和 Session Manager
const bridgeServer = new BridgeServer(config.getBridge().port);
const sessionManager = new SessionManager();
sessionManager.startCleanupTimer(); // 啟動會話清理定時器
const healthCheck = new HealthCheck(bridgeServer, sessionManager);

// 配置日誌
logger.configure({
  level: config.getLogging().level,
  console: true
});

// 啟動指標準集
startMetricsCollection();

// 中間件
bot.use(authMiddleware);
bot.use(rateLimitMiddleware());

// 指令處理
bot.command('start', async (ctx) => {
  await ctx.reply(
    '✅ VSCode2Telegram 已連接！\n\n' +
    '可用指令：\n' +
    '/chat <message> - 與 AI 對話（自動感知當前文件+項目結構）\n' +
    '  例: /chat 這個文件有什麼問題？\n' +
    '  例: /chat #file:src/bot/index.ts 解釋這個\n' +
    '/terminal <command> - 執行終端命令\n' +
    '/file <path> - 讀取文件\n' +
    '/ls [path] - 列出文件\n' +
    '/run [file] - 執行代碼\n' +
    '/projects - 列出所有已連接的 VSCode 窗口\n' +
    '/use <項目名> - 切換操作的項目\n' +
    '/proxy - 查看/切換代理\n' +
    '/status - 連接狀態\n' +
    '/clear - 清空對話歷史\n' +
    '/help - 完整幫助'
  );
});

bot.command('status', async (ctx) => {
  await statusCommand(ctx, bridgeServer);
});

bot.command('projects', async (ctx) => {
  await projectsCommand(ctx, bridgeServer);
});

bot.command('use', async (ctx) => {
  const name = ctx.message?.text.split(' ').slice(1).join(' ');
  await useCommand(ctx, name || '', bridgeServer);
});

bot.command('stats', async (ctx) => {
  await statsCommand(ctx, healthCheck);
});

bot.command('top', async (ctx) => {
  await topUsersCommand(ctx, sessionManager);
});

bot.command('help', async (ctx) => {
  await helpCommand(ctx);
});

bot.command('cancel', async (ctx) => {
  await cancelCommand(ctx, sessionManager);
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
bot.command('qa', async (ctx) => {
  const question = ctx.message?.text.split(' ').slice(1).join(' ') || '請對整個項目代碼做全面 QA，找出所有潛在協一、bug、類型錯誤、遣漏的錯誤處理和安全問題。';
  await qaCommand(ctx, question, bridgeServer, sessionManager);
});

bot.command('proxy', async (ctx) => {
  const args = ctx.message?.text.split(' ').slice(1).join(' ') || '';
  await proxyCommand(ctx, args);
});

bot.command('model', async (ctx) => {
  const args = ctx.message?.text.split(' ').slice(1).join(' ') || '';
  await modelCommand(ctx, args, bridgeServer);
});

bot.command('agent', async (ctx) => {
  const task = ctx.message?.text.split(' ').slice(1).join(' ');
  if (!task) {
    await ctx.reply(
      '❌ 請描述任務\n\n' +
      '例如:\n' +
      '/agent 幫我對這個項目做代碼 QA 並修復所有問題\n' +
      '/agent 新增一個 /ping 指令到 bot\n' +
      '/agent 將項目的所有 console.log 改為 logger\n' +
      '/agent git add -A 然後 commit 所有變更'
    );
    return;
  }
  await agentCommand(ctx, task, bridgeServer, sessionManager);
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

bot.command('delete', async (ctx) => {
  const path = ctx.message?.text.split(' ').slice(1).join(' ');
  await deleteCommand(ctx, path || '', bridgeServer);
});

bot.command('mkdir', async (ctx) => {
  const path = ctx.message?.text.split(' ').slice(1).join(' ');
  await mkdirCommand(ctx, path || '', bridgeServer);
});

bot.command('run', async (ctx) => {
  const filePath = ctx.message?.text.split(' ').slice(1)[0];
  await runCommand(ctx, filePath, bridgeServer);
});

bot.command('edit', async (ctx) => {
  const args = ctx.message?.text.split(' ').slice(1).join(' ') || '';
  await editCommand(ctx, args, bridgeServer, sessionManager);
});

bot.callbackQuery(/^confirm_edit:(.+)$/, async (ctx) => {
  const match = ctx.match?.[1];
  if (match) {
    await handleConfirmEdit(ctx, match, bridgeServer);
  }
});

bot.callbackQuery(/^cancel_edit:(.+)$/, async (ctx) => {
  const match = ctx.match?.[1];
  if (match) {
    await handleCancelEdit(ctx, match);
  }
});

bot.on('message:text', async (ctx) => {
  if (ctx.message?.text.startsWith('/')) return;
  const message = ctx.message?.text;
  if (message) {
    await chatCommand(ctx, message, bridgeServer, sessionManager);
  }
});

logger.info('VSCode2Telegram Bot 啟動中...');
bot.start();
logger.info('Bot 運行中...');

// 向 Telegram 注冊指令列表（讓 Telegram APP 識別所有指令）
bot.api.setMyCommands([
  { command: 'chat',     description: 'AI 對話（自動感知項目文件）' },
  { command: 'qa',       description: '全項目代碼 QA 分析' },
  { command: 'agent',    description: 'AI Agent：自動修改文件+執行命令' },
  { command: 'model',    description: '查看/切換 LM 模型' },
  { command: 'terminal', description: '執行終端命令' },
  { command: 'file',     description: '讀取文件' },
  { command: 'ls',       description: '列出文件' },
  { command: 'edit',     description: '寫入文件' },
  { command: 'run',      description: '執行代碼文件' },
  { command: 'delete',   description: '刪除文件/目錄' },
  { command: 'mkdir',    description: '創建目錄' },
  { command: 'projects', description: '列出所有已連接的 VSCode 窗口' },
  { command: 'use',      description: '切換操作的 VSCode 項目' },
  { command: 'proxy',    description: '查看/切換 HTTP 代理' },
  { command: 'status',   description: '連接狀態' },
  { command: 'clear',    description: '清空對話歷史' },
  { command: 'cancel',   description: '取消當前請求' },
  { command: 'stats',    description: '系統統計' },
  { command: 'help',     description: '完整幫助' },
]).then(() => logger.info('✅ Telegram 指令列表已更新'))
  .catch((e) => logger.warn(`⚠️ 更新指令列表失敗: ${e.message}`));

// Graceful shutdown
const shutdown = () => {
  logger.info('關閉中...');
  
  // 停止 metrics
  stopMetricsCollection();
  
  // 停止 session cleanup
  sessionManager.stopCleanupTimer();
  
  // 停止 bot
  bot.stop();
  
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);