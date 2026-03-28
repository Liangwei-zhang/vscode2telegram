// bot/commands/model.ts - 模型列表與切換指令
import { Context } from 'grammy';
import { v4 as uuidv4 } from 'uuid';
import { BridgeMessage, BridgeResponse, ModelListResponse } from '../../shared/types.js';
import { BridgeServer } from '../../bridge/ws-server.js';
import { sendLongReply } from '../utils/reply.js';

function isModelListResponse(res: BridgeResponse): res is ModelListResponse {
  return res.type === 'model_list';
}

/**
 * /model          - 列出所有可用模型，標記當前使用的
 * /model <id>     - 切換到指定模型（支持 id 或 family 模糊匹配）
 */
export async function modelCommand(ctx: Context, args: string, bridgeServer: BridgeServer) {
  if (!bridgeServer.isConnected()) {
    await ctx.reply('❌ VSCode Extension 未連接');
    return;
  }

  const modelId = args.trim();
  const userId = ctx.from?.id || 0;

  if (modelId) {
    // 切換模型
    await ctx.reply(`🔄 正在切換到模型 \`${modelId}\`...`, { parse_mode: 'Markdown' });

    const msg: BridgeMessage = {
      id: uuidv4(),
      userId,
      type: 'model_set',
      payload: { modelId },
      timestamp: new Date().toISOString()
    };

    try {
      const res = await bridgeServer.sendCommand(msg);
      if (res.status === 'error' || res.type === 'error') {
        const err = (res as any).payload?.error || '未知錯誤';
        await ctx.reply(`❌ ${err}`);
        return;
      }
      if (isModelListResponse(res)) {
        await ctx.reply(
          `✅ *模型已切換*\n\n` +
          `當前使用：\`${res.payload.current}\``,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (e: any) {
      await ctx.reply(`❌ 切換失敗: ${e.message}`);
    }
    return;
  }

  // 列出所有模型
  const msg: BridgeMessage = {
    id: uuidv4(),
    userId,
    type: 'model_list',
    payload: {},
    timestamp: new Date().toISOString()
  };

  try {
    const res = await bridgeServer.sendCommand(msg);
    if (!isModelListResponse(res)) {
      const err = (res as any).payload?.error || '未知錯誤';
      await ctx.reply(`❌ ${err}`);
      return;
    }

    const { models, current } = res.payload;

    if (models.length === 0) {
      await ctx.reply(
        '⚠️ *沒有可用的 Language Model*\n\n' +
        '請安裝 GitHub Copilot 擴展，並在 VS Code 中登錄',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const lines = models.map(m => {
      const active = m.id === current ? ' ✅' : '';
      return `• \`${m.id}\`${active}\n  └ family: \`${m.family}\`  vendor: \`${m.vendor}\``;
    });

    await sendLongReply(ctx,
      `🤖 *可用模型列表*\n\n` +
      lines.join('\n\n') +
      `\n\n*當前使用：* \`${current}\`\n\n` +
      `切換方式：\`/model <模型id或family>\`\n` +
      `例如：\`/model gpt-4o\` 或 \`/model claude\``,
      { parse_mode: 'Markdown' }
    );
  } catch (e: any) {
    await ctx.reply(`❌ 獲取模型列表失敗: ${e.message}`);
  }
}
