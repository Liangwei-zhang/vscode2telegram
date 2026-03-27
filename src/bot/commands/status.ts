// bot/commands/status.ts - 狀態指令
import { Context } from 'grammy';

export async function statusCommand(ctx: Context, bridgeServer: any) {
  const status = bridgeServer.getStatus();
  
  const statusText = status.connected 
    ? '✅ VSCode Extension 已連接'
    : '❌ VSCode Extension 未連接';
  
  const pendingText = `⏳ 待處理請求: ${status.pendingRequests}`;
  
  await ctx.reply(`${statusText}\n${pendingText}`);
}