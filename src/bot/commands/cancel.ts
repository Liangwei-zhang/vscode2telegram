// bot/commands/cancel.ts - 取消請求指令
import { Context } from 'grammy';
import { SessionManager } from '../bridge/session-manager.js';

export class CancelHandler {
  private sessionManager: SessionManager;
  private activeRequests = new Map<number, string>(); // userId -> requestId

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  /**
   * 標記請求開始
   */
  startRequest(userId: number, requestId: string) {
    this.activeRequests.set(userId, requestId);
  }

  /**
   * 標記請求完成
   */
  endRequest(userId: number) {
    this.activeRequests.delete(userId);
  }

  /**
   * 執行取消
   */
  async execute(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    
    if (!userId) {
      await ctx.reply('❌ 無法識別用戶');
      return;
    }

    const activeRequestId = this.activeRequests.get(userId);
    
    if (!activeRequestId) {
      await ctx.reply('❌ 沒有進行中的請求');
      return;
    }

    // 清除請求
    this.activeRequests.delete(userId);
    this.sessionManager.setCurrentRequest(userId, null);

    await ctx.reply('✅ 請求已取消');
  }

  /**
   * 檢查是否有進行中的請求
   */
  hasActiveRequest(userId: number): boolean {
    return this.activeRequests.has(userId);
  }

  /**
   * 獲取進行中的請求ID
   */
  getActiveRequestId(userId: number): string | undefined {
    return this.activeRequests.get(userId);
  }
}