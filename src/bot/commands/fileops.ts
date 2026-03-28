// bot/commands/fileops.ts - 文件删除和目录创建命令
import { Context } from 'grammy';
import { v4 as uuidv4 } from 'uuid';
import { BridgeMessage, BridgeResponse } from '../../shared/types.js';
import { BridgeServer } from '../../bridge/ws-server.js';

function getPayloadMessage(res: BridgeResponse): string {
  if ('message' in res.payload) return (res.payload as any).message;
  if ('error' in res.payload) return (res.payload as any).error;
  return JSON.stringify(res.payload);
}

export async function deleteCommand(ctx: Context, filePath: string, bridgeServer: BridgeServer) {
  if (!filePath) {
    await ctx.reply('❌ 請輸入路徑\n例如: /delete src/old-file.ts\n或刪除目錄: /delete src/old-folder');
    return;
  }
  if (!bridgeServer.isConnected()) {
    await ctx.reply('❌ VSCode Extension 未連接');
    return;
  }

  const msg: BridgeMessage = {
    id: uuidv4(),
    type: 'file_delete',
    payload: { path: filePath },
    userId: ctx.from?.id || 0,
    timestamp: new Date().toISOString()
  };

  try {
    const response = await bridgeServer.sendCommand(msg);
    if (response.status === 'success') {
      await ctx.reply(`🗑️ ${getPayloadMessage(response)}`);
    } else {
      await ctx.reply(`❌ ${getPayloadMessage(response)}`);
    }
  } catch (e: any) {
    await ctx.reply(`❌ 錯誤: ${e.message}`);
  }
}

export async function mkdirCommand(ctx: Context, dirPath: string, bridgeServer: BridgeServer) {
  if (!dirPath) {
    await ctx.reply('❌ 請輸入目錄路徑\n例如: /mkdir src/new-folder');
    return;
  }
  if (!bridgeServer.isConnected()) {
    await ctx.reply('❌ VSCode Extension 未連接');
    return;
  }

  const msg: BridgeMessage = {
    id: uuidv4(),
    type: 'create_dir',
    payload: { path: dirPath },
    userId: ctx.from?.id || 0,
    timestamp: new Date().toISOString()
  };

  try {
    const response = await bridgeServer.sendCommand(msg);
    if (response.status === 'success') {
      await ctx.reply(`📁 ${getPayloadMessage(response)}`);
    } else {
      await ctx.reply(`❌ ${getPayloadMessage(response)}`);
    }
  } catch (e: any) {
    await ctx.reply(`❌ 錯誤: ${e.message}`);
  }
}
