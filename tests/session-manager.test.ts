// tests/session-manager.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from '../src/bridge/session-manager';

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  it('should create a new session for new user', () => {
    const session = sessionManager.getOrCreate(123);
    expect(session.telegramUserId).toBe(123);
    expect(session.chatHistory).toHaveLength(0);
  });

  it('should return existing session for existing user', () => {
    const session1 = sessionManager.getOrCreate(123);
    const session2 = sessionManager.getOrCreate(123);
    expect(session1).toBe(session2);
  });

  it('should append history correctly', () => {
    const userId = 123;
    sessionManager.appendHistory(userId, 'user', 'Hello');
    sessionManager.appendHistory(userId, 'assistant', 'Hi there');
    
    const history = sessionManager.getHistory(userId);
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe('user');
    expect(history[0].content).toBe('Hello');
    expect(history[1].role).toBe('assistant');
    expect(history[1].content).toBe('Hi there');
  });

  it('should limit history to 20 messages', () => {
    const userId = 123;
    for (let i = 0; i < 25; i++) {
      sessionManager.appendHistory(userId, 'user', `Message ${i}`);
    }
    
    const history = sessionManager.getHistory(userId);
    expect(history).toHaveLength(20);
    expect(history[0].content).toBe('Message 5');
  });

  it('should clear history', () => {
    const userId = 123;
    sessionManager.appendHistory(userId, 'user', 'Hello');
    sessionManager.clearHistory(userId);
    
    const history = sessionManager.getHistory(userId);
    expect(history).toHaveLength(0);
  });

  it('should track current request', () => {
    const userId = 123;
    sessionManager.setCurrentRequest(userId, 'req-123');
    expect(sessionManager.getCurrentRequest(userId)).toBe('req-123');
    
    sessionManager.setCurrentRequest(userId, null);
    expect(sessionManager.getCurrentRequest(userId)).toBeNull();
  });
});