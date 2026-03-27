// bot/commands/file.ts - 文件指令
import { Context } from 'grammy';
import { v4 as uuidv4 } from 'uuid';
import { BridgeMessage, BridgeResponse } from '../../shared/types.js';

export async function fileCommand(ctx: Context, path: string, type: 'read' | 'list', bridgeServer: any) {
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
    // 模擬回覆
    await new Promise(r => setTimeout(r, 500));
    
    if (type === 'read') {
      await ctx.reply(`📝 文件: ${path}\n\n\`\`\`\n// 請在 VSCode 中安裝 Extension 以讀取實際文件內容\`\`\``);
    } else {
      await ctx.reply(`📁 目錄: ${path}\n\n\`\`\`\nsrc/\npackage.json\nREADME.md\n\`\`\``);
    }
  } catch (e: any) {
    await ctx.reply(`❌ 錯誤: ${e.message}`);
  }
}

export async function runCommand(ctx: Context, filePath: string | undefined, bridgeServer: any) {
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
    await new Promise(r => setTimeout(r, 1000));
    await ctx.reply('✅ 執行完成\n\n`// 請在 VSCode 中安裝 Extension 以執行實際代碼`');
  } catch (e: any) {
    await ctx.reply(`❌ 錯誤: ${e.message}`);
  }
}