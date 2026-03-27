// bot/middleware/auth.ts - 用戶白名單驗證
import { Context, MiddlewareFn } from 'grammy';

const ALLOWED_USER_IDS = process.env.ALLOWED_TELEGRAM_USER_IDS
  ? process.env.ALLOWED_TELEGRAM_USER_IDS.split(',').map(Number)
  : [];

// 如果沒有配置白名單，則允許所有用戶
const ALLOW_ALL = ALLOWED_USER_IDS.length === 0;

export const authMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  const userId = ctx.from?.id;
  
  if (!userId) {
    await ctx.reply('❌ 無法識別用戶');
    return;
  }

  if (!ALLOW_ALL && !ALLOWED_USER_IDS.includes(userId)) {
    await ctx.reply('❌ 未授權，請聯繫管理員');
    return;
  }

  await next();
};

// 危險命令黑名單
const BLOCKED_COMMANDS = ['rm -rf', 'sudo', 'chmod 777', '> /dev/'];

export function isCommandSafe(cmd: string): boolean {
  const lower = cmd.toLowerCase();
  return !BLOCKED_COMMANDS.some(blocked => lower.includes(blocked));
}