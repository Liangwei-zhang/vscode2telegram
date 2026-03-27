// bot/commands/file.ts - 文件指令
import { Context } from 'grammy';
import { v4 as uuidv4 } from 'uuid';
import { BridgeMessage } from '../../shared/types.js';
import { BridgeServer } from '../../bridge/ws-server.js';

export async function fileCommand(ctx: Context, path: string, type: 'read' | 'list', bridgeServer: BridgeServer) {
  if (!bridgeServer.isConnected()) {
    await ctx.reply('❌ VSCode Extension 未連接');
    return;
  }

  const msgType = type === 'list' ? 'list_files' : 'file_read';
  
  await ctx.reply('⏳ 處理中...');

  const msg: BridgeMessage = {
    id: uuidv4(),
    type: msgType,
    payload: { path },
    userId: ctx.from?.id || 0,
    timestamp: new Date().toISOString()
  };

  try {
    // 發送到 Extension
    const response = await bridgeServer.sendCommand(msg);

    if (response.status === 'success') {
      if (type === 'read') {
        await ctx.reply(`📝 ${path}\n\n${response.payload.content}`);
      } else {
        await ctx.reply(`📁 ${path}\n\n${response.payload.files?.join('\n') || '空目錄'}`);
      }
    } else {
      await ctx.reply(`❌ 錯誤: ${response.payload?.error || '未知錯誤'}`);
    }
  } catch (e: any) {
    await ctx.reply(`❌ 錯誤: ${e.message}`);
  }
}

export async function runCommand(ctx: Context, filePath: string | undefined, bridgeServer: BridgeServer) {
  if (!bridgeServer.isConnected()) {
    await ctx.reply('❌ VSCode Extension 未連接');
    return;
  }

  await ctx.reply('⏳ 執行中...');

  const msg: BridgeMessage = {
    id: uuidv4(),
    type: 'run_code',
    payload: { filePath: filePath || 'current' },
    userId: ctx.from?.id || 0,
    timestamp: new Date().toISOString()
  };

  try {
    const response = await bridgeServer.sendCommand(msg);

    if (response.status === 'success') {
      await ctx.reply(`✅ 執行完成\n\n${response.payload.output || '完成'}`);
    } else {
      await ctx.reply(`❌ 錯誤: ${response.payload?.error || '未知錯誤'}`);
    }
  } catch (e: any) {
    await ctx.reply(`❌ 錯誤: ${e.message}`);
  }
}