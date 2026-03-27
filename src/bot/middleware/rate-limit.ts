// bot/middleware/rate-limit.ts - 頻率限制中間件
import { Context, MiddlewareFn } from 'grammy';
import { config } from '../config.js';

export class RateLimiter {
  private requests = new Map<number, number[]>();

  // 支持兩種構造函數簽名
  constructor(windowMs: number, maxRequests: number);
  constructor(config: { windowMs: number; maxRequests: number });
  constructor(
    windowMsOrConfig: number | { windowMs: number; maxRequests: number },
    maxRequests?: number
  ) {
    if (typeof windowMsOrConfig === 'object') {
      this.windowMs = windowMsOrConfig.windowMs;
      this.maxRequests = windowMsOrConfig.maxRequests;
    } else {
      this.windowMs = windowMsOrConfig;
      this.maxRequests = maxRequests ?? 20;
    }
  }

  private windowMs: number;
  private maxRequests: number;

  isAllowed(userId: number): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    
    const validRequests = userRequests.filter(
      time => now - time < this.windowMs
    );
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(userId, validRequests);
    
    return true;
  }

  getRemaining(userId: number): number {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    const validRequests = userRequests.filter(
      time => now - time < this.windowMs
    );
    return Math.max(0, this.maxRequests - validRequests.length);
  }

  getResetTime(userId: number): number {
    const userRequests = this.requests.get(userId) || [];
    if (userRequests.length === 0) return 0;
    const oldest = Math.min(...userRequests);
    return Math.ceil((oldest + this.windowMs - Date.now()) / 1000);
  }

  clear(userId: number) {
    this.requests.delete(userId);
  }

  clearAll() {
    this.requests.clear();
  }
}

// 從配置讀取
const securityConfig = config.getSecurity().rateLimit;
export const rateLimiter = new RateLimiter(securityConfig.windowMs, securityConfig.maxRequests);

export function rateLimitMiddleware(): MiddlewareFn<Context> {
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await next();
      return;
    }

    if (!rateLimiter.isAllowed(userId)) {
      const resetTime = rateLimiter.getResetTime(userId);
      await ctx.reply(`⚠️ 請求過於頻繁，請 ${resetTime} 秒後再試`);
      return;
    }

    await next();
  };
}

export const HIGH_FREQUENCY_CONFIG = {
  windowMs: 60000,
  maxRequests: 10
};

export const highFrequencyLimiter = new RateLimiter(HIGH_FREQUENCY_CONFIG.windowMs, HIGH_FREQUENCY_CONFIG.maxRequests);