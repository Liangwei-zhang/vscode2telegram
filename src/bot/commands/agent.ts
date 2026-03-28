// bot/commands/agent.ts - AI Agent 任务执行命令
import { Context } from 'grammy';
import { v4 as uuidv4 } from 'uuid';
import { BridgeMessage, BridgeResponse, AgentResultResponse } from '../../shared/types.js';
import { BridgeServer } from '../../bridge/ws-server.js';
import { SessionManager } from '../../bridge/session-manager.js';
import { cancelHandler } from './cancel.js';
import { sendLongReply } from '../utils/reply.js';

function isAgentResultResponse(res: BridgeResponse): res is AgentResultResponse {
  return res.type === 'agent_result';
}

export async function agentCommand(
  ctx: Context,
  task: string,
  bridgeServer: BridgeServer,
  sessionManager: SessionManager
) {
  if (!bridgeServer.isConnected()) {
    await ctx.reply('❌ VSCode Extension 未連接');
    return;
  }

  const userId = ctx.from?.id || 0;
  const history = sessionManager.getHistory(userId);

  await ctx.reply(
    `🤖 Agent 執行中...\n\n任務: ${task}\n\n⏳ 正在讀取項目代碼並規劃變更...`
  );

  const msg: BridgeMessage = {
    id: uuidv4(),
    type: 'agent_task',
    payload: { task, history },
    userId,
    timestamp: new Date().toISOString()
  };

  cancelHandler.startRequest(userId, msg.id);

  try {
    const response = await bridgeServer.sendCommand(msg);

    if (isAgentResultResponse(response)) {
      const { summary, filesChanged, terminalOutputs } = response.payload;

      const parts: string[] = [];

      // 已修改的文件
      if (filesChanged.length > 0) {
        parts.push(`📝 已修改文件 (${filesChanged.length}個):\n` +
          filesChanged.map(f => `  • ${f}`).join('\n'));
      }

      // 执行的命令及输出
      if (terminalOutputs.length > 0) {
        const cmdLines = terminalOutputs.map(t => {
          const icon = t.exitCode === 0 ? '✅' : '❌';
          const out = t.output.slice(0, 200) + (t.output.length > 200 ? '...' : '');
          return `${icon} \`${t.command}\`\n${out ? `\`\`\`\n${out}\n\`\`\`` : ''}`;
        });
        parts.push(`💻 執行命令:\n${cmdLines.join('\n\n')}`);
      }

      // AI 摘要
      if (summary) {
        parts.push(`💬 ${summary}`);
      }

      if (filesChanged.length === 0 && terminalOutputs.length === 0) {
        // AI 没有输出 FILE/CMD 块，直接回复摘要文本
        sessionManager.appendHistory(userId, 'user', task);
        sessionManager.appendHistory(userId, 'assistant', summary);
        await sendLongReply(ctx, summary);
      } else {
        sessionManager.appendHistory(userId, 'user', task);
        sessionManager.appendHistory(userId, 'assistant', summary);
        await sendLongReply(ctx, parts.join('\n\n'));
      }
    } else {
      await ctx.reply(`❌ 錯誤: ${(response.payload as any).error || '未知錯誤'}`);
    }
  } catch (e: any) {
    await ctx.reply(`❌ 錯誤: ${e.message}`);
  } finally {
    cancelHandler.endRequest(userId);
  }
}
