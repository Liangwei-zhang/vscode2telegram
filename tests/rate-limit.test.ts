// tests/rate-limit.test.ts - Rate Limiter 測試
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from '../src/bot/middleware/rate-limit';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({ windowMs: 1000, maxRequests: 3 });
  });

  describe('Basic Limiting', () => {
    it('should allow requests within limit', () => {
      expect(limiter.isAllowed(1)).toBe(true);
      expect(limiter.isAllowed(1)).toBe(true);
      expect(limiter.isAllowed(1)).toBe(true);
    });

    it('should block requests over limit', () => {
      limiter.isAllowed(1);
      limiter.isAllowed(1);
      limiter.isAllowed(1);
      expect(limiter.isAllowed(1)).toBe(false);
    });

    it('should track different users separately', () => {
      for (let i = 0; i < 3; i++) {
        limiter.isAllowed(1);
      }
      expect(limiter.isAllowed(1)).toBe(false);
      expect(limiter.isAllowed(2)).toBe(true);
    });
  });

  describe('Time Window', () => {
    it('should reset after window expires', async () => {
      const shortLimiter = new RateLimiter({ windowMs: 100, maxRequests: 2 });
      
      shortLimiter.isAllowed(1);
      shortLimiter.isAllowed(1);
      expect(shortLimiter.isAllowed(1)).toBe(false);
      
      // Wait for window to expire
      await new Promise(r => setTimeout(r, 150));
      
      expect(shortLimiter.isAllowed(1)).toBe(true);
    });
  });

  describe('Remaining Requests', () => {
    it('should return correct remaining count', () => {
      expect(limiter.getRemaining(1)).toBe(3);
      limiter.isAllowed(1);
      expect(limiter.getRemaining(1)).toBe(2);
      limiter.isAllowed(1);
      expect(limiter.getRemaining(1)).toBe(1);
    });

    it('should return 0 when over limit', () => {
      limiter.isAllowed(1);
      limiter.isAllowed(1);
      limiter.isAllowed(1);
      expect(limiter.getRemaining(1)).toBe(0);
    });

    it('should return max when no requests', () => {
      expect(limiter.getRemaining(999)).toBe(3);
    });
  });

  describe('Reset Time', () => {
    it('should return 0 for new user', () => {
      expect(limiter.getResetTime(1)).toBe(0);
    });

    it('should return positive time for user over limit', async () => {
      const shortLimiter = new RateLimiter({ windowMs: 1000, maxRequests: 1 });
      
      shortLimiter.isAllowed(1);
      const resetTime = shortLimiter.getResetTime(1);
      
      expect(resetTime).toBeGreaterThan(0);
      expect(resetTime).toBeLessThanOrEqual(1);
    });
  });

  describe('Clear', () => {
    it('should allow after clear', () => {
      limiter.isAllowed(1);
      limiter.isAllowed(1);
      limiter.clear(1);
      
      // After clear, should allow (reset state)
      expect(limiter.isAllowed(1)).toBe(true);
    });

    it('should clear all users', () => {
      limiter.isAllowed(1);
      limiter.isAllowed(2);
      limiter.clearAll();
      
      expect(limiter.isAllowed(1)).toBe(true);
      expect(limiter.isAllowed(2)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid sequential requests', () => {
      for (let i = 0; i < 100; i++) {
        limiter.isAllowed(1);
      }
      expect(limiter.isAllowed(1)).toBe(false);
    });

    it('should handle zero max requests', () => {
      const zeroLimiter = new RateLimiter({ windowMs: 1000, maxRequests: 0 });
      expect(zeroLimiter.isAllowed(1)).toBe(false);
    });

    it('should handle negative max requests gracefully', () => {
      const negLimiter = new RateLimiter({ windowMs: 1000, maxRequests: -1 });
      expect(negLimiter.isAllowed(1)).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should use custom config', () => {
      const custom = new RateLimiter({ windowMs: 5000, maxRequests: 10 });
      
      for (let i = 0; i < 10; i++) {
        custom.isAllowed(1);
      }
      expect(custom.isAllowed(1)).toBe(false);
      expect(custom.getRemaining(1)).toBe(0);
    });

    it('should handle very small window', () => {
      const tiny = new RateLimiter({ windowMs: 10, maxRequests: 1 });
      expect(tiny.isAllowed(1)).toBe(true);
    });
  });
});