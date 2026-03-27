// bridge/session-manager.ts - 對話會話管理
import { Session, ChatMessage } from '../shared/types.js';

const MAX_HISTORY = 20;
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

export class SessionManager {
  private sessions = new Map<number, Session>();

  // 清理過期會話
  cleanup() {
    const now = Date.now();
    for (const [userId, session] of this.sessions) {
      if (now - session.lastActivity.getTime() > SESSION_TTL) {
        this.sessions.delete(userId);
      }
    }
  }

  // 定期清理（每5分鐘）
  startCleanupTimer() {
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

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