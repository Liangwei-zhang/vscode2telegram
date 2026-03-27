// bot/commands/cancel.ts - 取消請求指令
import { Context } from 'grammy';
import { SessionManager } from '../../bridge/session-manager.js';

export class CancelHandler {
  private activeRequests = new Map<number, string>();

  startRequest(userId: number, requestId: string) {
    this.activeRequests.set(userId, requestId);
  }

  endRequest(userId: number) {
    this.activeRequests.delete(userId);
  }

  hasActiveRequest(userId: number): boolean {
    return this.activeRequests.has(userId);
  }
}

const cancelHandler = new CancelHandler();

export { cancelHandler };

export async function cancelCommand(ctx: Context, sessionManager: SessionManager): Promise<void> {
  const userId = ctx.from?.id;
  
  if (!userId) {
    await ctx.reply('❌ 無法識別用戶');
    return;
  }

  if (!cancelHandler.hasActiveRequest(userId)) {
    await ctx.reply('❌ 沒有進行中的請求');
    return;
  }

  cancelHandler.endRequest(userId);
  sessionManager.setCurrentRequest(userId, null);
  await ctx.reply('✅ 請求已取消');
}