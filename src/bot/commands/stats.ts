// bot/commands/stats.ts - 統計指令
import { Context } from 'grammy';
import { SessionManager } from '../../bridge/session-manager.js';
import { metrics } from '../../bridge/metrics.js';
import { HealthCheck } from '../../bridge/health-check.js';

export async function statsCommand(ctx: Context, healthCheck: HealthCheck) {
  const status = healthCheck.check();
  
  const statusEmoji = status.status === 'healthy' ? '✅' : status.status === 'degraded' ? '⚠️' : '❌';
  
  const msg = `📊 系統統計

${statusEmoji} 狀態: ${status.status}

🕐 運行時間: ${formatUptime(status.uptime)}

📡 組件狀態:
• Bridge: ${status.components.bridge.status}
• Session: ${status.components.session.status}
• Telegram: ${status.components.telegram.status}

📈 指標:
• 總請求: ${status.metrics.totalRequests}
• 會話數: ${status.metrics.activeSessions}
• 連接數: ${status.metrics.activeConnections}

💾 內存: ${metrics.getGauge('memory_usage') || 0} MB`;

  await ctx.reply(msg);
}

export async function topUsersCommand(ctx: Context, sessionManager: SessionManager) {
  const sessions = sessionManager.getAllSessions();
  
  if (sessions.length === 0) {
    await ctx.reply('📊 沒有活動用戶');
    return;
  }

  const userActivity = sessions.map(s => ({
    userId: s.telegramUserId,
    messages: s.chatHistory.length,
    lastActivity: s.lastActivity
  })).sort((a, b) => b.messages - a.messages).slice(0, 5);

  let msg = '📊 Top 5 活跃用户\n\n';
  
  userActivity.forEach((u, i) => {
    msg += `${i + 1}. User ${u.userId}: ${u.messages} 條消息\n`;
  });

  await ctx.reply(msg);
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}