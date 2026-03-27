// bot/commands/chat.ts - 對話指令
import { Context } from 'grammy';
import { v4 as uuidv4 } from 'uuid';
import { BridgeMessage, BridgeResponse } from '../../shared/types.js';

export async function chatCommand(
  ctx: Context, 
  message: string, 
  bridgeServer: any,
  sessionManager: any
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
    // 模擬回覆（實際需要 extension 返回）
    await new Promise(r => setTimeout(r, 1000));
    
    const response: BridgeResponse = {
      id: msg.id,
      type: 'chat_done',
      payload: { 
        full_text: `我收到了你的消息: "${message}"\n\n這是模擬回覆。請在 VSCode 中安裝 Extension 後即可使用完整功能。` 
      },
      status: 'success',
      timestamp: new Date().toISOString()
    };

    // 保存歷史
    sessionManager.appendHistory(userId, 'user', message);
    sessionManager.appendHistory(userId, 'assistant', response.payload.full_text);

    await ctx.reply(response.payload.full_text);
  } catch (e: any) {
    await ctx.reply(`❌ 錯誤: ${e.message}`);
  }
}