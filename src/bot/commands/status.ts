// bot/commands/status.ts - 狀態指令
import { Context } from 'grammy';
import { BridgeServer } from '../../bridge/ws-server.js';

export async function statusCommand(ctx: Context, bridgeServer: BridgeServer) {
  const status = bridgeServer.getStatus();
  
  const statusText = status.connected 
    ? '✅ VSCode Extension 已連接'
    : '❌ VSCode Extension 未連接';
  
  const workspaceText = status.connected && status.workspaceName
    ? `🗂️ 工作區: ${status.workspaceName}\n📁 路徑: ${status.workspacePath}`
    : '';

  const pendingText = `⏳ 待處理請求: ${status.pendingRequests}`;
  
  const lines = [statusText, workspaceText, pendingText].filter(Boolean);
  await ctx.reply(lines.join('\n'));
}