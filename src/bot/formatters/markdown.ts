// bot/formatters/markdown.ts - Markdown → Telegram MarkdownV2 轉換

/**
 * 將 Agent 輸出的 Markdown 轉換為 Telegram MarkdownV2 格式
 * 使用 placeholder 機制避免雙重轉義
 */

let placeholderCounter = 0;
const placeholders = new Map<string, string>();

function createPlaceholder(content: string): string {
  const key = `__PH${placeholderCounter++}__`;
  placeholders.set(key, content);
  return key;
}

function restorePlaceholders(text: string): string {
  let result = text;
  for (const [key, value] of placeholders) {
    result = result.split(key).join(value);
  }
  placeholders.clear();
  return result;
}

export function toTelegramMarkdown(text: string): string {
  let result = text;

  // 1. 代碼塊 - 保留內容，用 placeholder 保護
  result = result.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    // 只轉義反引號和反斜杠，其他保留
    const escapedCode = code
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`');
    return createPlaceholder(`\`\`\`${lang}\n${escapedCode}\`\`\``);
  });

  // 2. 內聯代碼 - 同樣處理
  result = result.replace(/`([^`]+)`/g, (_, code) => {
    const escapedCode = code
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`');
    return createPlaceholder(`\`${escapedCode}\``);
  });

  // 3. 粗體 **text** - 保護內部不轉義
  result = result.replace(/\*\*(.+?)\*\*/g, (_, text) => {
    return createPlaceholder(`*${text}*`);
  });

  // 4. 斜體 _text_
  result = result.replace(/_(.+?)_/g, (_, text) => {
    return createPlaceholder(`_${text}_`);
  });

  // 5. 刪除線 ~~text~~
  result = result.replace(/~~(.+?)~~/g, (_, text) => {
    return createPlaceholder(`~${text}~`);
  });

  // 6. 標題 - 轉為粗體
  result = result.replace(/^### (.+)$/gm, (_, text) => createPlaceholder(`*${text}*`));
  result = result.replace(/^## (.+)$/gm, (_, text) => createPlaceholder(`*${text}*`));
  result = result.replace(/^# (.+)$/gm, (_, text) => createPlaceholder(`*${text}*`));

  // 7. 列表 - 轉為圓點
  result = result.replace(/^- (.+)$/gm, (_, text) => createPlaceholder(`• ${text}`));
  result = result.replace(/^\* (.+)$/gm, (_, text) => createPlaceholder(`• ${text}`));
  result = result.replace(/^\d+\. (.+)$/gm, (_, text) => createPlaceholder(`• ${text}`));

  // 8. 轉義剩餘特殊字符（只有 placeholder 外部的）
  result = escapeTelegramMarkdown(result);

  // 9. 還原 placeholder
  result = restorePlaceholders(result);

  return result;
}

/**
 * 轉義 Telegram MarkdownV2 特殊字符
 */
export function escapeTelegramMarkdown(text: string): string {
  return text.replace(/([_*`\[\]()~>#+\-=|{}.!])/g, '\\$1');
}

/**
 * 檢測文本是否包含 Markdown
 */
export function hasMarkdown(text: string): boolean {
  return /```[\s\S]*?```|`[^`]+`|\*\*.+?\*\*|~~.+?~~|^#{1,6}\s|^\s*[-*]\s/.test(text);
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
  let remaining = text;

  while (remaining.length > limit) {
    let splitIndex = remaining.lastIndexOf('\n\n', limit);
    if (splitIndex === -1) splitIndex = remaining.lastIndexOf('\n', limit);
    if (splitIndex === -1) splitIndex = limit;

    parts.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex);
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