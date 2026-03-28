// bot/commands/projects.ts - 多 VSCode 窗口項目切換
import { Context } from 'grammy';
import { BridgeServer } from '../../bridge/ws-server.js';

export async function projectsCommand(ctx: Context, bridgeServer: BridgeServer) {
  const conns = bridgeServer.getConnections();

  if (conns.length === 0) {
    await ctx.reply('❌ 沒有任何 VSCode 窗口連接\n\n請確保 VS Code 已打開並安裝了 vscode2telegram Extension');
    return;
  }

  const lines = conns.map((c, i) => {
    const active = c.isActive ? ' ✅ (當前)' : '';
    return `${i + 1}. ${c.workspaceName}${active}\n   📁 ${c.workspacePath || '未知路徑'}`;
  });

  const text =
    `🖥️ 已連接的 VSCode 窗口 (${conns.length}個):\n\n` +
    lines.join('\n\n') +
    '\n\n使用 /use <項目名> 切換，例如:\n/use vscode2telegram';

  await ctx.reply(text);
}

export async function useCommand(ctx: Context, nameQuery: string, bridgeServer: BridgeServer) {
  if (!nameQuery) {
    await ctx.reply('❌ 請輸入項目名稱\n例如: /use vscode2telegram');
    return;
  }

  const switched = bridgeServer.switchConnection(nameQuery);
  if (!switched) {
    const conns = bridgeServer.getConnections();
    const names = conns.map(c => `• ${c.workspaceName}`).join('\n');
    await ctx.reply(
      `❌ 找不到匹配 "${nameQuery}" 的項目\n\n可用項目:\n${names || '(無連接)'}`
    );
    return;
  }

  await ctx.reply(`✅ 已切換到: ${switched.workspaceName}\n📁 ${switched.workspacePath}`);
}
