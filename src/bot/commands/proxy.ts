// bot/commands/proxy.ts - 代理切換指令
import { Context } from 'grammy';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ProxyAgent, Agent, setGlobalDispatcher } from 'undici';

const ENV_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env');

/**
 * 切換全局 HTTP 代理（即刻生效，無需重啟 Bot）
 * /proxy          - 查看當前代理
 * /proxy set URL  - 設置代理並立即切換
 * /proxy off      - 關閉代理
 */
export async function proxyCommand(ctx: Context, args: string) {
  const parts = args.trim().split(/\s+/);
  const subcmd = parts[0]?.toLowerCase();

  // /proxy (no args) → show status
  if (!subcmd) {
    const current = process.env.PROXY_URL || '';
    if (current) {
      await ctx.reply(
        `🌐 *當前代理已啟用*\n\n` +
        `\`${current}\`\n\n` +
        `使用 /proxy off 關閉代理`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await ctx.reply(
        `🚫 *未設置代理*\n\n` +
        `用法：\n` +
        `/proxy set http://127.0.0.1:7890\n` +
        `/proxy off`,
        { parse_mode: 'Markdown' }
      );
    }
    return;
  }

  if (subcmd === 'set') {
    const proxyUrl = parts[1];
    if (!proxyUrl) {
      await ctx.reply(
        '❌ 請輸入代理地址\n\n' +
        '例如：\n' +
        '`/proxy set http://127.0.0.1:7890`\n' +
        '`/proxy set http://user:pass@host:port`',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // 驗證 URL 格式
    let parsed: URL;
    try {
      parsed = new URL(proxyUrl);
    } catch {
      await ctx.reply('❌ 代理地址格式不正確，請使用 `http://host:port` 格式', { parse_mode: 'Markdown' });
      return;
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      await ctx.reply(
        '❌ 目前只支持 HTTP/HTTPS 代理協議\n\n' +
        'Clash、V2Ray、Shadowsocks 等工具都提供 HTTP 端口，請使用 HTTP 端口地址',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // 即刻切換代理
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
    process.env.PROXY_URL = proxyUrl;

    // 持久化到 .env
    await writeEnvKey('PROXY_URL', proxyUrl);

    await ctx.reply(
      `✅ *代理已切換*\n\n` +
      `\`${proxyUrl}\`\n\n` +
      `已即刻生效，下次重啟也會自動使用此代理`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (subcmd === 'off') {
    setGlobalDispatcher(new Agent());
    process.env.PROXY_URL = '';
    await writeEnvKey('PROXY_URL', '');

    await ctx.reply('✅ *代理已關閉*，已切換為直連', { parse_mode: 'Markdown' });
    return;
  }

  await ctx.reply(
    '❓ 未知子命令\n\n' +
    '用法：\n' +
    '/proxy — 查看當前代理\n' +
    '/proxy set http://127.0.0.1:7890 — 設置代理\n' +
    '/proxy off — 關閉代理'
  );
}

/**
 * 在啟動時應用已保存的代理設置
 */
export function applyStartupProxy() {
  const proxyUrl = process.env.PROXY_URL;
  if (proxyUrl) {
    try {
      setGlobalDispatcher(new ProxyAgent(proxyUrl));
      return proxyUrl;
    } catch (e: any) {
      console.warn(`⚠️ 代理設置失敗: ${e.message}`);
    }
  }
  return null;
}

/**
 * 更新 .env 文件中的某個 key（無則追加，有則替換，值為空則刪除）
 */
async function writeEnvKey(key: string, value: string) {
  let content = '';
  try {
    content = await fs.readFile(ENV_PATH, 'utf-8');
  } catch { /* .env 不存在也無妨 */ }

  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (value) {
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content = content.trimEnd() + `\n${key}=${value}\n`;
    }
  } else {
    // 刪除該 key
    content = content.replace(regex, '').replace(/\n{3,}/g, '\n\n');
  }

  await fs.writeFile(ENV_PATH, content, 'utf-8');
}
