// bridge/session-manager.ts - 對話會話管理
import { Session, ChatMessage } from '../shared/types.js';

const MAX_HISTORY = 20;

export class SessionManager {
  private sessions = new Map<number, Session>();

  getOrCreate(userId: number): Session {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {
        telegramUserId: userId,
        chatHistory: [],
        lastActivity: new Date(),
        currentRequestId: null
      });
    }
    const session = this.sessions.get(userId)!;
    session.lastActivity = new Date();
    return session;
  }

  appendHistory(userId: number, role: 'user' | 'assistant', content: string) {
    const session = this.getOrCreate(userId);
    session.chatHistory.push({ role, content });
    
    // 保持最近 20 條
    if (session.chatHistory.length > MAX_HISTORY) {
      session.chatHistory = session.chatHistory.slice(-MAX_HISTORY);
    }
  }

  getHistory(userId: number): ChatMessage[] {
    return this.getOrCreate(userId).chatHistory;
  }

  clearHistory(userId: number) {
    const session = this.sessions.get(userId);
    if (session) {
      session.chatHistory = [];
    }
  }

  setCurrentRequest(userId: number, requestId: string | null) {
    const session = this.getOrCreate(userId);
    session.currentRequestId = requestId;
  }

  getCurrentRequest(userId: number): string | null {
    return this.getOrCreate(userId).currentRequestId;
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }
}