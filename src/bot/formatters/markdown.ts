// bot/formatters/markdown.ts - Markdown → Telegram MarkdownV2 轉換

/**
 * 將 Agent 輸出的 Markdown 轉換為 Telegram MarkdownV2 格式
 */

export function toTelegramMarkdown(text: string): string {
  let result = text;

  // 1. 代碼塊 - 保留但需要轉義內容
  result = result.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const escapedCode = escapeTelegramMarkdown(code);
    return `\`\`\`${lang}\n${escapedCode}\`\`\``;
  });

  // 2. 內聯代碼
  result = result.replace(/`([^`]+)`/g, (_, code) => {
    const escapedCode = escapeTelegramMarkdown(code);
    return `\`${escapedCode}\``;
  });

  // 3. 粗體 **text**
  result = result.replace(/\*\*(.+?)\*\*/g, (_, text) => {
    return `*${escapeTelegramMarkdown(text)}*`;
  });

  // 4. 斜體 _text_
  result = result.replace(/_(.+?)_/g, (_, text) => {
    return `_${escapeTelegramMarkdown(text)}_`;
  });

  // 5. 刪除線 ~~text~~
  result = result.replace(/~~(.+?)~~/g, (_, text) => {
    return `~${escapeTelegramMarkdown(text)}~`;
  });

  // 6. 標題 # H1
  result = result.replace(/^### (.+)$/gm, (_, text) => {
    return `*${escapeTelegramMarkdown(text)}*`;
  });

  result = result.replace(/^## (.+)$/gm, (_, text) => {
    return `*${escapeTelegramMarkdown(text)}*`;
  });

  result = result.replace(/^# (.+)$/gm, (_, text) => {
    return `*${escapeTelegramMarkdown(text)}*`;
  });

  // 7. 列表
  result = result.replace(/^- (.+)$/gm, '• $1');
  result = result.replace(/^\* (.+)$/gm, '• $1');
  result = result.replace(/^\d+\. (.+)$/gm, '• $1');

  // 8. 轉義剩餘特殊字符
  result = escapeTelegramMarkdown(result);

  return result;
}

/**
 * 轉義 Telegram MarkdownV2 特殊字符
 */
export function escapeTelegramMarkdown(text: string): string {
  // 需要轉義的字符: _ * ` [ ] ( ) ~ > # + - = | { } . !
  return text.replace(/([_*`\[\]()~>#+\-=|{}.!])/g, '\\$1');
}

/**
 * 檢測文本是否包含 Markdown
 */
export function hasMarkdown(text: string): boolean {
  const markdownPatterns = [
    /```[\s\S]*?```/,  // 代碼塊
    /`[^`]+`/,        // 內聯代碼
    /\*\*.+?\*\*/,     // 粗體
    /_.+?_/,           // 斜體
    /~~.+?~~/,         // 刪除線
    /^#{1,6}\s/,       // 標題
    /^\s*[-*]\s/,      // 列表
    /^\s*\d+\.\s/      // 數字列表
  ];

  return markdownPatterns.some(pattern => pattern.test(text));
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
    // 嘗試在段落或代碼塊邊界分割
    let splitIndex = remaining.lastIndexOf('\n\n', limit);
    
    if (splitIndex === -1) {
      // 沒有段落分隔，在行邊界分割
      splitIndex = remaining.lastIndexOf('\n', limit);
    }
    
    if (splitIndex === -1) {
      // 強行分割
      splitIndex = limit;
    }

    parts.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex);
  }

  if (remaining) {
    parts.push(remaining);
  }

  return parts;
}

/**
 * 清理 Markdown，轉為純文本（用於 short 模式）
 */
export function stripMarkdown(text: string): string {
  let result = text;

  // 移除代碼塊
  result = result.replace(/```[\s\S]*?```/g, '');
  
  // 移除內聯代碼
  result = result.replace(/`[^`]+`/g, '');
  
  // 移除 Markdown 符號
  result = result.replace(/[*_~#]/g, '');
  
  // 移除多餘空白
  result = result.replace(/\n{3,}/g, '\n\n');
  
  return result.trim();
}