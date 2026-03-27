// tests/types.test.ts
import { describe, it, expect } from 'vitest';
import type { BridgeMessage, BridgeResponse, Session, ChatMessage } from '../src/shared/types';

describe('Shared Types', () => {
  describe('BridgeMessage', () => {
    it('should have required fields', () => {
      const msg: BridgeMessage = {
        id: 'test-123',
        type: 'chat',
        payload: { message: 'Hello' },
        userId: 123456,
        timestamp: '2026-03-26T12:00:00Z'
      };
      
      expect(msg.id).toBe('test-123');
      expect(msg.type).toBe('chat');
      expect(msg.payload.message).toBe('Hello');
      expect(msg.userId).toBe(123456);
    });

    it('should support all message types', () => {
      const types: BridgeMessage['type'][] = [
        'ping', 'chat', 'terminal', 'file_read', 'file_write', 
        'run_code', 'get_status', 'list_files'
      ];
      
      types.forEach(type => {
        const msg: BridgeMessage = {
          id: 'test',
          type,
          payload: {},
          userId: 1,
          timestamp: ''
        };
        expect(msg.type).toBe(type);
      });
    });
  });

  describe('BridgeResponse', () => {
    it('should have success status', () => {
      const res: BridgeResponse = {
        id: 'test-123',
        type: 'chat_done',
        payload: { full_text: 'Response' },
        status: 'success',
        timestamp: '2026-03-26T12:00:00Z'
      };
      
      expect(res.status).toBe('success');
    });

    it('should have error status', () => {
      const res: BridgeResponse = {
        id: 'test-123',
        type: 'error',
        payload: { error: 'Something went wrong' },
        status: 'error',
        timestamp: '2026-03-26T12:00:00Z'
      };
      
      expect(res.status).toBe('error');
      expect(res.payload.error).toBe('Something went wrong');
    });

    it('should support error response type', () => {
      const res: BridgeResponse = {
        id: 'test-123',
        type: 'error',
        payload: { error: 'LM 錯誤: 模型不可用' },
        status: 'error',
        timestamp: '2026-03-26T12:00:00Z'
      };
      
      expect(res.type).toBe('error');
      expect(res.status).toBe('error');
    });
  });

  describe('Session', () => {
    it('should have correct structure', () => {
      const session: Session = {
        telegramUserId: 123456,
        chatHistory: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi' }
        ],
        lastActivity: new Date(),
        currentRequestId: null
      };
      
      expect(session.telegramUserId).toBe(123456);
      expect(session.chatHistory).toHaveLength(2);
      expect(session.currentRequestId).toBeNull();
    });
  });
});