// bot/formatters/markdown.ts - Markdown → Telegram MarkdownV2 轉換

/**
 * 將 Agent 輸出的 Markdown 轉換為 Telegram MarkdownV2 格式
 * 使用局部變量避免併發衝突
 */

export function toTelegramMarkdown(text: string): string {
  // 使用局部變量，避免模組級狀態導致併發問題
  let counter = 0;
  const placeholders = new Map<string, string>();

  // 使用 null 字符合成 key，避免與用戶文本衝突
  const createPlaceholder = (content: string): string => {
    const key = `\x00PH${counter++}\x00`;
    placeholders.set(key, content);
    return key;
  };

  let result = text;

  // 1. 代碼塊 - 保護內容
  result = result.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const escapedCode = code.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
    return createPlaceholder(`\`\`\`${lang}\n${escapedCode}\`\`\``);
  });

  // 2. 內聯代碼
  result = result.replace(/`([^`]+)`/g, (_, code) => {
    const escapedCode = code.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
    return createPlaceholder(`\`${escapedCode}\``);
  });

  // 3. 粗體 **text** - 內部需要轉義
  result = result.replace(/\*\*(.+?)\*\*/g, (_, inner) => {
    return createPlaceholder(`*${escapeTelegramMarkdown(inner)}*`);
  });

  // 4. 斜體 _text_ - 內部需要轉義
  result = result.replace(/_(.+?)_/g, (_, inner) => {
    return createPlaceholder(`_${escapeTelegramMarkdown(inner)}_`);
  });

  // 5. 刪除線 ~~text~~ - 內部需要轉義
  result = result.replace(/~~(.+?)~~/g, (_, inner) => {
    return createPlaceholder(`~${escapeTelegramMarkdown(inner)}~`);
  });

  // 6. 標題 - 內部需要轉義
  result = result.replace(/^### (.+)$/gm, (_, inner) => createPlaceholder(`*${escapeTelegramMarkdown(inner)}*`));
  result = result.replace(/^## (.+)$/gm, (_, inner) => createPlaceholder(`*${escapeTelegramMarkdown(inner)}*`));
  result = result.replace(/^# (.+)$/gm, (_, inner) => createPlaceholder(`*${escapeTelegramMarkdown(inner)}*`));

  // 7. 列表 - 內部需要轉義
  result = result.replace(/^- (.+)$/gm, (_, inner) => createPlaceholder(`• ${escapeTelegramMarkdown(inner)}`));
  result = result.replace(/^\* (.+)$/gm, (_, inner) => createPlaceholder(`• ${escapeTelegramMarkdown(inner)}`));
  result = result.replace(/^\d+\. (.+)$/gm, (_, inner) => createPlaceholder(`• ${escapeTelegramMarkdown(inner)}`));

  // 8. 轉義剩餘特殊字符
  result = escapeTelegramMarkdown(result);

  // 9. 還原 placeholder
  for (const [key, value] of placeholders) {
    result = result.split(key).join(value);
  }

  return result;
}

/**
 * 轉義 Telegram MarkdownV2 特殊字符
 */
function escapeTelegramMarkdown(text: string): string {
  return text.replace(/([_*`\[\]()~>#+\-=|{}.!])/g, '\\$1');
}

/**
 * 檢測文本是否包含 Markdown（添加 m flag）
 */
export function hasMarkdown(text: string): boolean {
  return /```[\s\S]*?```|`[^`]+`|\*\*.+?\*\*|~~.+?~~|^#{1,6}\s|^\s*[-*]\s/m.test(text);
}

/**
 * 檢測是否需要分頁
 */
export function needsPagination(text: string, limit = 4000): boolean {
  return text.length > limit;
}

/**
 * 分割訊息（保持代碼塊完整）
 */
export function splitMessage(text: string, limit = 4000): string[] {
  if (text.length <= limit) return [text];

  const parts: string[] = [];
  let remaining = text.trim(); // 去除前導換行

  while (remaining.length > limit) {
    let splitIndex = remaining.lastIndexOf('\n\n', limit);
    if (splitIndex === -1) splitIndex = remaining.lastIndexOf('\n', limit);
    if (splitIndex === -1) splitIndex = limit;

    parts.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  if (remaining) parts.push(remaining);
  return parts;
}

/**
 * 清理 Markdown，轉為純文本
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/[*_~#]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}