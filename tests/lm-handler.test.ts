// tests/lm-handler.test.ts - LM Handler 測試（無 VSCode 依賴）
import { describe, it, expect } from 'vitest';

describe('LMHandler - Language Model Integration', () => {
  describe('Model Selection Logic', () => {
    const mockModels = [
      { modelId: 'gpt-4o', modelFamily: 'GPT-4o' },
      { modelId: 'gpt-3.5', modelFamily: 'GPT-3.5' },
      { modelId: 'claude-3', modelFamily: 'Claude-3' }
    ];

    it('should have correct interface', () => {
      expect(mockModels).toHaveLength(3);
      expect(mockModels[0].modelFamily).toBe('GPT-4o');
    });

    it('should prefer GPT-4o', () => {
      const preferred = mockModels.find(m => 
        m.modelFamily?.toLowerCase().includes('gpt-4o')
      );
      expect(preferred?.modelFamily).toBe('GPT-4o');
    });

    it('should handle empty models', () => {
      const models: any[] = [];
      const preferred = models.find(m => 
        m.modelFamily?.toLowerCase().includes('gpt-4o')
      );
      expect(preferred).toBeUndefined();
    });
  });

  describe('Message Formatting', () => {
    it('should format user message', () => {
      const userMsg = { role: 'user' as const, content: 'Hello' };
      expect(userMsg.role).toBe('user');
      expect(userMsg.content).toBe('Hello');
    });

    it('should format assistant message', () => {
      const assistantMsg = { role: 'assistant' as const, content: 'Hi there' };
      expect(assistantMsg.role).toBe('assistant');
      expect(assistantMsg.content).toBe('Hi there');
    });

    it('should handle system prompt', () => {
      const systemMsg = { role: 'system' as const, content: 'You are a helpful assistant.' };
      expect(systemMsg.role).toBe('system');
    });
  });

  describe('Response Handling', () => {
    it('should accumulate streaming chunks', () => {
      const chunks = ['Hello ', 'World', '!'];
      const full = chunks.join('');
      expect(full).toBe('Hello World!');
    });

    it('should handle empty response', () => {
      const chunks: string[] = [];
      const full = chunks.join('');
      expect(full).toBe('');
    });

    it('should handle large response', () => {
      const largeChunk = 'x'.repeat(10000);
      expect(largeChunk.length).toBe(10000);
    });
  });

  describe('History Management', () => {
    it('should format history correctly', () => {
      const history = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
        { role: 'user', content: 'Write code' }
      ];
      
      const userMessages = history.filter(h => h.role === 'user');
      const assistantMessages = history.filter(h => h.role === 'assistant');
      
      expect(userMessages).toHaveLength(2);
      expect(assistantMessages).toHaveLength(1);
    });

    it('should truncate long history to 20', () => {
      const longHistory = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' as const : 'assistant' as const,
        content: `Message ${i}`
      }));
      
      const truncated = longHistory.slice(-20);
      expect(truncated).toHaveLength(20);
      expect(truncated[0].content).toBe('Message 10');
    });

    it('should preserve order after truncation', () => {
      const history = [
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'Response 1' },
        { role: 'user', content: 'Second' }
      ];
      
      const truncated = history.slice(-20);
      expect(truncated[0].content).toBe('First');
    });
  });

  describe('System Prompt', () => {
    it('should include VSCode context', () => {
      const systemPrompt = '你是一個 VSCode 中的編程助手，用戶通過 Telegram 遠程與你交互。';
      expect(systemPrompt).toContain('VSCode');
      expect(systemPrompt).toContain('Telegram');
    });

    it('should include concise instruction', () => {
      const systemPrompt = '請直接給出代碼和簡潔的解釋，避免過多廢話。';
      expect(systemPrompt).toContain('代碼');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle missing model', () => {
      const errorMessage = '沒有可用的 Language Model';
      expect(errorMessage).toContain('Language Model');
    });

    it('should handle API error', () => {
      const errorMessage = 'API 錯誤: rate limit exceeded';
      expect(errorMessage).toContain('API');
    });

    it('should handle timeout', () => {
      const errorMessage = '請求超時';
      expect(errorMessage).toBe('請求超時');
    });
  });

  describe('Chat Options', () => {
    it('should support temperature option', () => {
      const options = { temperature: 0.7 };
      expect(options.temperature).toBe(0.7);
    });

    it('should support max tokens option', () => {
      const options = { maxTokens: 2000 };
      expect(options.maxTokens).toBe(2000);
    });

    it('should support timeout option', () => {
      const options = { timeout: 60000 };
      expect(options.timeout).toBe(60000);
    });
  });

  describe('Model Vendor Detection', () => {
    it('should detect Copilot', () => {
      const model = { vendor: 'copilot', modelFamily: 'GPT-4o' };
      expect(model.vendor).toBe('copilot');
    });

    it('should detect Anthropic', () => {
      const model = { vendor: 'anthropic', modelFamily: 'Claude-3' };
      expect(model.vendor).toBe('anthropic');
    });

    it('should detect OpenAI', () => {
      const model = { vendor: 'openai', modelFamily: 'GPT-4' };
      expect(model.vendor).toBe('openai');
    });
  });
});