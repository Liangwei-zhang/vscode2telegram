// bot/commands/terminal.ts - 終端指令
import { Context } from 'grammy';
import { v4 as uuidv4 } from 'uuid';
import { BridgeMessage, BridgeResponse, TerminalOutputResponse } from '../../shared/types.js';
import { BridgeServer } from '../../bridge/ws-server.js';
import { isCommandSafe } from '../middleware/auth.js';

function isTerminalOutputResponse(res: BridgeResponse): res is TerminalOutputResponse {
  return res.type === 'terminal_output';
}

export async function terminalCommand(ctx: Context, command: string, bridgeServer: BridgeServer) {
  // 安全檢查
  if (!isCommandSafe(command)) {
    await ctx.reply('❌ 此命令被禁止執行');
    return;
  }

  if (!bridgeServer.isConnected()) {
    await ctx.reply('❌ VSCode Extension 未連接，請先安裝並啟動 Extension');
    return;
  }

  await ctx.reply('⏳ 執行中...');

  const msg: BridgeMessage = {
    id: uuidv4(),
    type: 'terminal',
    payload: { command },
    userId: ctx.from?.id || 0,
    timestamp: new Date().toISOString()
  };

  try {
    const response = await bridgeServer.sendCommand(msg);
    
    if (response.status === 'success' && isTerminalOutputResponse(response)) {
      const output = response.payload.stdout || '';
      const stderr = response.payload.stderr || '';
      const exitCode = response.payload.exitCode || 0;
      
      let result = `<pre>${escapeHtml(output)}</pre>`;
      if (stderr) {
        result += `\n\n--- stderr ---\n<pre>${escapeHtml(stderr)}</pre>`;
      }
      result += `\n\nExit Code: ${exitCode}`;
      
      await ctx.reply(result, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(`❌ 錯誤: ${(response.payload as any).error || '未知錯誤'}`);
    }
  } catch (e: any) {
    await ctx.reply(`❌ 執行失敗: ${e.message}`);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}