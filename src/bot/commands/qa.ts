// bot/commands/qa.ts - 全项目代码 QA 指令
import { Context } from 'grammy';
import { v4 as uuidv4 } from 'uuid';
import { BridgeMessage, BridgeResponse, ChatDoneResponse } from '../../shared/types.js';
import { BridgeServer } from '../../bridge/ws-server.js';
import { SessionManager } from '../../bridge/session-manager.js';
import { cancelHandler } from './cancel.js';

function isChatDoneResponse(res: BridgeResponse): res is ChatDoneResponse {
  return res.type === 'chat_done';
}

export async function qaCommand(
  ctx: Context,
  question: string,
  bridgeServer: BridgeServer,
  sessionManager: SessionManager
) {
  if (!bridgeServer.isConnected()) {
    await ctx.reply('❌ VSCode Extension 未連接');
    return;
  }

  const userId = ctx.from?.id || 0;
  const history = sessionManager.getHistory(userId);

  await ctx.reply('🔍 正在讀取項目所有源碼，請稍候...');

  const msg: BridgeMessage = {
    id: uuidv4(),
    type: 'qa_project',
    payload: { question, history },
    userId,
    timestamp: new Date().toISOString()
  };

  cancelHandler.startRequest(userId, msg.id);

  try {
    const response = await bridgeServer.sendCommand(msg);

    if (response.status === 'success' && isChatDoneResponse(response)) {
      sessionManager.appendHistory(userId, 'user', question);
      sessionManager.appendHistory(userId, 'assistant', response.payload.full_text);
      await ctx.reply(response.payload.full_text);
    } else {
      await ctx.reply(`❌ 錯誤: ${(response.payload as any).error || '未知錯誤'}`);
    }
  } catch (e: any) {
    await ctx.reply(`❌ 錯誤: ${e.message}`);
  } finally {
    cancelHandler.endRequest(userId);
  }
}
