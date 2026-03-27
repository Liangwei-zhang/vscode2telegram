// bot/commands/terminal.ts - 終端指令
import { Context } from 'grammy';
import { v4 as uuidv4 } from 'uuid';
import { BridgeMessage, BridgeResponse } from '../../shared/types.js';

export async function terminalCommand(ctx: Context, command: string, bridgeServer: any) {
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
    
    if (response.status === 'success') {
      const output = response.payload.stdout || '';
      const stderr = response.payload.stderr || '';
      const exitCode = response.payload.exitCode || 0;
      
      let result = `\`\`\`\n`;
      if (output) result += output;
      if (stderr) result += '\n--- stderr ---\n' + stderr;
      result += `\`\`\`\n\nExit Code: ${exitCode}`;
      
      await ctx.reply(result, { parse_mode: 'MarkdownV2' });
    } else {
      await ctx.reply(`❌ 錯誤: ${response.error}`);
    }
  } catch (e: any) {
    await ctx.reply(`❌ 執行失敗: ${e.message}`);
  }
}