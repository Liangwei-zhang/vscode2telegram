// bot/middleware/rate-limit.ts - 頻率限制中間件
import { Context, MiddlewareFn } from 'grammy';

// 限制配置
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60000,
  maxRequests: 20
};

export class RateLimiter {
  private requests = new Map<number, number[]>();

  constructor(private config: RateLimitConfig = DEFAULT_CONFIG) {}

  isAllowed(userId: number): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(userId) || [];
    
    const validRequests = userRequests.filter(
      time => now - time < this.config.windowMs
    );
    
    if (validRequests.length >= this.config.maxRequests) {
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
      time => now - time < this.config.windowMs
    );
    return Math.max(0, this.config.maxRequests - validRequests.length);
  }

  getResetTime(userId: number): number {
    const userRequests = this.requests.get(userId) || [];
    if (userRequests.length === 0) return 0;
    
    const oldest = Math.min(...userRequests);
    return Math.ceil((oldest + this.config.windowMs - Date.now()) / 1000);
  }

  clear(userId: number) {
    this.requests.delete(userId);
  }

  clearAll() {
    this.requests.clear();
  }
}

export const rateLimiter = new RateLimiter();

export function rateLimitMiddleware(config?: RateLimitConfig): MiddlewareFn<Context> {
  const limiter = config ? new RateLimiter(config) : rateLimiter;
  
  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await next();
      return;
    }

    if (!limiter.isAllowed(userId)) {
      const resetTime = limiter.getResetTime(userId);
      await ctx.reply(`⚠️ 請求過於頻繁，請 ${resetTime} 秒後再試`);
      return;
    }

    await next();
  };
}

export const HIGH_FREQUENCY_CONFIG: RateLimitConfig = {
  windowMs: 60000,
  maxRequests: 10
};

export const highFrequencyLimiter = new RateLimiter(HIGH_FREQUENCY_CONFIG);