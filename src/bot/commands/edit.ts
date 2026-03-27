// bot/commands/edit.ts - 編輯/寫入檔案指令
import { Context, InlineKeyboard } from 'grammy';
import { v4 as uuidv4 } from 'uuid';
import { BridgeMessage, BridgeResponse } from '../../shared/types.js';

interface PendingConfirm {
  requestId: string;
  userId: number;
  path: string;
  content: string;
  timestamp: number;
}

// 等待確認的請求（5分鐘過期）
const pendingConfirms = new Map<string, PendingConfirm>();
const CONFIRM_TIMEOUT = 5 * 60 * 1000; // 5 分鐘

// 清理過期的確認請求
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
  bridgeServer: any
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

  // 創建確認請求
  const requestId = uuidv4();
  const confirm: PendingConfirm = {
    requestId,
    userId: ctx.from?.id || 0,
    path: filePath,
    content,
    timestamp: Date.now()
  };

  pendingConfirms.set(requestId, confirm);

  // 創建確認鍵盤
  const keyboard = new InlineKeyboard()
    .text('✅ 確認寫入', `confirm_edit:${requestId}`)
    .text('❌ 取消', `cancel_edit:${requestId}`);

  await ctx.reply(
    `⚠️ 確認寫入檔案？\n\n` +
    `📁 路徑: \`${filePath}\`\n` +
    `📝內容預覽:\n\`\`\`\n${content.slice(0, 200)}${content.length > 200 ? '...' : ''}\n\`\`\``,
    {
      reply_markup: keyboard,
      parse_mode: 'MarkdownV2'
    }
  );
}

/**
 * 處理確認回調
 */
export async function handleConfirmEdit(
  ctx: Context,
  requestId: string,
  confirm: boolean,
  bridgeServer: any
): Promise<void> {
  const confirmData = pendingConfirms.get(requestId);
  
  if (!confirmData) {
    await ctx.answerCallbackQuery('❌ 請求已過期或不存在');
    return;
  }

  // 驗證用戶
  if (ctx.from?.id !== confirmData.userId) {
    await ctx.answerCallbackQuery('❌ 無權操作');
    return;
  }

  pendingConfirms.delete(requestId);

  if (!confirm) {
    await ctx.answerCallbackQuery('❌ 已取消');
    await ctx.editMessageText('❌ 已取消寫入操作');
    return;
  }

  // 執行寫入
  await ctx.answerCallbackQuery('✅ 執行中...');

  const msg: BridgeMessage = {
    id: uuidv4(),
    type: 'file_write',
    payload: {
      path: confirmData.path,
      content: confirmData.content
    },
    userId: confirmData.userId,
    timestamp: new Date().toISOString()
  };

  try {
    const response = await bridgeServer.sendCommand(msg);
    
    if (response.status === 'success') {
      await ctx.editMessageText(
        `✅ 檔案已寫入\n\n📁 ${confirmData.path}`
      );
    } else {
      await ctx.editMessageText(
        `❌ 寫入失敗\n\n${response.error}`
      );
    }
  } catch (e: any) {
    await ctx.editMessageText(`❌ 錯誤: ${e.message}`);
  }
}

/**
 * 取消編輯
 */
export async function handleCancelEdit(
  ctx: Context,
  requestId: string
): Promise<void> {
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