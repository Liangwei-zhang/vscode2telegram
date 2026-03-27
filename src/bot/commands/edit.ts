// bot/commands/edit.ts - 編輯/寫入檔案指令
import { Context, InlineKeyboard } from 'grammy';
import { v4 as uuidv4 } from 'uuid';
import { BridgeMessage } from '../../shared/types.js';
import { BridgeServer } from '../../bridge/ws-server.js';
import { SessionManager } from '../../bridge/session-manager.js';

interface PendingConfirm {
  requestId: string;
  userId: number;
  path: string;
  content: string;
  timestamp: number;
}

const pendingConfirms = new Map<string, PendingConfirm>();
const CONFIRM_TIMEOUT = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, confirm] of pendingConfirms) {
    if (now - confirm.timestamp > CONFIRM_TIMEOUT) {
      pendingConfirms.delete(id);
    }
  }
}, 60000);

export async function editCommand(
  ctx: Context,
  args: string,
  bridgeServer: BridgeServer,
  sessionManager: SessionManager
): Promise<void> {
  const parts = args.split(' ');
  
  if (parts.length < 2) {
    await ctx.reply(
      '❌ 用法: /edit <路徑> <內容>\n\n' +
      '範例: /edit src/index.ts console.log("hello")\n\n' +
      '⚠️ 此操作需要確認'
    );
    return;
  }

  const filePath = parts[0];
  const content = parts.slice(1).join(' ');

  if (!filePath || !content) {
    await ctx.reply('❌ 請提供檔案路徑和內容');
    return;
  }

  const requestId = uuidv4();
  const confirm: PendingConfirm = {
    requestId,
    userId: ctx.from?.id || 0,
    path: filePath,
    content,
    timestamp: Date.now()
  };

  pendingConfirms.set(requestId, confirm);

  const keyboard = new InlineKeyboard()
    .text('✅ 確認寫入', `confirm_edit:${requestId}`)
    .text('❌ 取消', `cancel_edit:${requestId}`);

  await ctx.reply(
    `⚠️ 確認寫入檔案？\n\n` +
    `📁 路徑: ${filePath}\n` +
    `📝內容預覽:\n\`\`\`\n${content.slice(0, 200)}${content.length > 200 ? '...' : ''}\n\`\`\``,
    { reply_markup: keyboard, parse_mode: 'MarkdownV2' }
  );
}

export async function handleConfirmEdit(
  ctx: Context,
  requestId: string,
  bridgeServer: BridgeServer
): Promise<void> {
  const confirmData = pendingConfirms.get(requestId);
  
  if (!confirmData) {
    await ctx.answerCallbackQuery('❌ 請求已過期或不存在');
    return;
  }

  if (ctx.from?.id !== confirmData.userId) {
    await ctx.answerCallbackQuery('❌ 無權操作');
    return;
  }

  pendingConfirms.delete(requestId);
  await ctx.answerCallbackQuery('✅ 執行中...');

  const msg: BridgeMessage = {
    id: uuidv4(),
    type: 'file_write',
    payload: { path: confirmData.path, content: confirmData.content },
    userId: confirmData.userId,
    timestamp: new Date().toISOString()
  };

  try {
    const response = await bridgeServer.sendCommand(msg);
    
    if (response.status === 'success') {
      await ctx.editMessageText(`✅ 檔案已寫入: ${confirmData.path}`);
    } else {
      await ctx.editMessageText(`❌ 寫入失敗: ${response.payload?.error}`);
    }
  } catch (e: any) {
    await ctx.editMessageText(`❌ 錯誤: ${e.message}`);
  }
}

export async function handleCancelEdit(ctx: Context, requestId: string): Promise<void> {
  const confirmData = pendingConfirms.get(requestId);
  
  if (!confirmData) {
    await ctx.answerCallbackQuery('❌ 請求已過期');
    return;
  }

  if (ctx.from?.id !== confirmData.userId) {
    await ctx.answerCallbackQuery('❌ 無權操作');
    return;
  }

  pendingConfirms.delete(requestId);
  await ctx.answerCallbackQuery('❌ 已取消');
  await ctx.editMessageText('❌ 已取消寫入操作');
}