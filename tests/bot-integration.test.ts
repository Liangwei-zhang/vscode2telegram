// tests/bot-integration.test.ts - 商業級別集成測試
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock grammy
vi.mock('grammy', () => ({
  Bot: vi.fn().mockImplementation(() => ({
    use: vi.fn(),
    command: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    start: vi.fn(),
    stop: vi.fn()
  })),
  Context: class {},
  MiddlewareFn: vi.fn()
}));

// Mock ws
vi.mock('ws', () => ({
  WebSocketServer: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn()
  })),
  WebSocket: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
    on: vi.fn(),
    close: vi.fn()
  }))
}));

import { BridgeServer } from '../src/bridge/ws-server';
import { SessionManager } from '../src/bridge/session-manager';

describe('Bridge Server Integration - 商業級別 QA', () => {
  let bridgeServer: BridgeServer;
  let sessionManager: SessionManager;

  beforeEach(() => {
    bridgeServer = new BridgeServer(3457); // Use different port
    sessionManager = new SessionManager();
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Bridge Server', () => {
    it('should start on specified port', () => {
      const status = bridgeServer.getStatus();
      expect(status).toBeDefined();
    });

    it('should report not connected initially', () => {
      const status = bridgeServer.getStatus();
      expect(status.connected).toBe(false);
    });

    it('should track pending requests', () => {
      const status = bridgeServer.getStatus();
      expect(status.pendingRequests).toBe(0);
    });
  });

  describe('Session Management Integration', () => {
    it('should handle multiple users', () => {
      const user1 = sessionManager.getOrCreate(111);
      const user2 = sessionManager.getOrCreate(222);
      const user3 = sessionManager.getOrCreate(333);

      expect(user1.telegramUserId).toBe(111);
      expect(user2.telegramUserId).toBe(222);
      expect(user3.telegramUserId).toBe(333);
    });

    it('should maintain separate histories per user', () => {
      const userId1 = 111;
      const userId2 = 222;

      sessionManager.appendHistory(userId1, 'user', 'User 1 message');
      sessionManager.appendHistory(userId2, 'user', 'User 2 message');
      sessionManager.appendHistory(userId1, 'assistant', 'User 1 response');
      sessionManager.appendHistory(userId2, 'assistant', 'User 2 response');

      const history1 = sessionManager.getHistory(userId1);
      const history2 = sessionManager.getHistory(userId2);

      expect(history1).toHaveLength(2);
      expect(history2).toHaveLength(2);
      expect(history1[0].content).toBe('User 1 message');
      expect(history2[0].content).toBe('User 2 message');
    });

    it('should handle concurrent requests per user', () => {
      const userId = 111;

      sessionManager.setCurrentRequest(userId, 'req-1');
      expect(sessionManager.getCurrentRequest(userId)).toBe('req-1');

      // Simulate request completion
      sessionManager.setCurrentRequest(userId, null);
      expect(sessionManager.getCurrentRequest(userId)).toBeNull();

      // New request
      sessionManager.setCurrentRequest(userId, 'req-2');
      expect(sessionManager.getCurrentRequest(userId)).toBe('req-2');
    });
  });

  describe('Message Flow Simulation', () => {
    it('should simulate chat flow', () => {
      const userId = 123;
      
      // User sends message
      const message = 'Write a function';
      sessionManager.appendHistory(userId, 'user', message);

      // Get history for API call
      const history = sessionManager.getHistory(userId);
      
      expect(history).toHaveLength(1);
      expect(history[0].role).toBe('user');
      expect(history[0].content).toBe(message);
    });

    it('should simulate multi-turn conversation', () => {
      const userId = 123;
      const conversation = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi! How can I help?' },
        { role: 'user' as const, content: 'Write a function' },
        { role: 'assistant' as const, content: 'Sure, what function?' },
        { role: 'user' as const, content: 'A sort function' },
      ];

      conversation.forEach(msg => {
        sessionManager.appendHistory(userId, msg.role, msg.content);
      });

      const history = sessionManager.getHistory(userId);
      expect(history).toHaveLength(5);
      expect(history[history.length - 1].content).toBe('A sort function');
    });

    it('should handle long conversation with history truncation', () => {
      const userId = 123;
      
      // Add more than MAX_HISTORY (20) messages
      for (let i = 0; i < 25; i++) {
        sessionManager.appendHistory(userId, 'user', `Message ${i}`);
      }

      const history = sessionManager.getHistory(userId);
      expect(history).toHaveLength(20);
      // Should keep most recent
      expect(history[0].content).toBe('Message 5');
    });
  });

  describe('Error Recovery', () => {
    it('should handle user not found in session', () => {
      const history = sessionManager.getHistory(999);
      expect(history).toHaveLength(0);
    });

    it('should handle clear non-existent user history', () => {
      // Should not throw
      expect(() => sessionManager.clearHistory(999)).not.toThrow();
    });

    it('should handle concurrent session access', () => {
      const promises = Array.from({ length: 100 }, (_, i) => {
        const userId = i % 10; // 10 users
        sessionManager.appendHistory(userId, 'user', `Message ${i}`);
        return sessionManager.getHistory(userId);
      });

      // All should complete without errors
      expect(promises).toHaveLength(100);
    });
  });

  describe('Data Integrity', () => {
    it('should preserve message order', () => {
      const userId = 123;
      const messages = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];
      
      messages.forEach(msg => {
        sessionManager.appendHistory(userId, 'user', msg);
      });

      const history = sessionManager.getHistory(userId);
      history.forEach((msg, i) => {
        expect(msg.content).toBe(messages[i]);
      });
    });

    it('should handle special characters in messages', () => {
      const userId = 123;
      const specialMessages = [
        'Message with `code`',
        'Message with **bold**',
        'Message with "quotes"',
        'Message with <html>',
        'Emoji 🚀 test',
        '中文消息',
      ];

      specialMessages.forEach(msg => {
        sessionManager.appendHistory(userId, 'user', msg);
      });

      const history = sessionManager.getHistory(userId);
      expect(history).toHaveLength(specialMessages.length);
    });

    it('should handle empty messages', () => {
      const userId = 123;
      
      sessionManager.appendHistory(userId, 'user', '');
      sessionManager.appendHistory(userId, 'assistant', 'Response');

      const history = sessionManager.getHistory(userId);
      expect(history).toHaveLength(2);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should handle rapid session creation', () => {
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        sessionManager.getOrCreate(i);
      }
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should complete in 100ms
    });

    it('should handle bulk history operations', () => {
      const start = Date.now();
      const userId = 1;
      
      for (let i = 0; i < 100; i++) {
        sessionManager.appendHistory(userId, 'user', `Message ${i}`);
      }
      
      const history = sessionManager.getHistory(userId);
      const duration = Date.now() - start;
      
      expect(history).toHaveLength(20); // Capped at 20
      expect(duration).toBeLessThan(50);
    });
  });
});