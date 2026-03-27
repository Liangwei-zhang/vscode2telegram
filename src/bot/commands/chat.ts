// bot/commands/chat.ts - 對話指令
import { Context } from 'grammy';
import { v4 as uuidv4 } from 'uuid';
import { BridgeMessage } from '../../shared/types.js';
import { BridgeServer } from '../../bridge/ws-server.js';
import { SessionManager } from '../../bridge/session-manager.js';

export async function chatCommand(
  ctx: Context, 
  message: string, 
  bridgeServer: BridgeServer,
  sessionManager: SessionManager
) {
  if (!bridgeServer.isConnected()) {
    await ctx.reply('❌ VSCode Extension 未連接');
    return;
  }

  const userId = ctx.from?.id || 0;
  const history = sessionManager.getHistory(userId);

  await ctx.reply('🤔 Agent 思考中...');

  const msg: BridgeMessage = {
    id: uuidv4(),
    type: 'chat',
    payload: { message, history },
    userId,
    timestamp: new Date().toISOString()
  };

  try {
    // 發送到 Extension 並等待回應
    const response = await bridgeServer.sendCommand(msg);

    if (response.status === 'success') {
      // 保存歷史
      sessionManager.appendHistory(userId, 'user', message);
      sessionManager.appendHistory(userId, 'assistant', response.payload.full_text);
      await ctx.reply(response.payload.full_text);
    } else {
      await ctx.reply(`❌ 錯誤: ${response.payload?.error || '未知錯誤'}`);
    }
  } catch (e: any) {
    await ctx.reply(`❌ 錯誤: ${e.message}`);
  }
}