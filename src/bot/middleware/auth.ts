// bot/middleware/auth.ts - 用戶白名單驗證
import { Context, MiddlewareFn } from 'grammy';
import { config } from '../config.js';
import { logger } from '../../shared/logger.js';

export const authMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  const userId = ctx.from?.id;
  const allowedUserIds = config.getTelegram().allowedUserIds;
  
  if (!userId) {
    await ctx.reply('❌ 無法識別用戶');
    return;
  }

  // 如果沒有配置白名單，則允許所有用戶
  const allowAll = allowedUserIds.length === 0;
  
  if (!allowAll && !allowedUserIds.includes(userId)) {
    logger.info(`AUTH_DENIED: userId=${userId} username=${ctx.from?.username ?? 'N/A'}`);
    await ctx.reply('❌ 未授權，請聯繫管理員');
    return;
  }

  await next();
};

// 危險命令黑名單
export function isCommandSafe(cmd: string): boolean {
  const blockedCommands = config.getSecurity().blockedCommands;
  const lower = cmd.toLowerCase();
  return !blockedCommands.some(blocked => lower.includes(blocked));
}