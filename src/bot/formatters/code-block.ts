// bot/formatters/code-block.ts - 代碼塊截斷與分頁

/**
 * 代碼塊截斷與分頁處理
 */

export interface TruncateOptions {
  maxLines?: number;
  maxChars?: number;
  showLineNumbers?: boolean;
}

const DEFAULT_OPTIONS: TruncateOptions = {
  maxLines: 100,
  maxChars: 3000,
  showLineNumbers: false
};

/**
 * 截斷超長代碼塊
 */
export function truncateCode(
  code: string,
  options: TruncateOptions = DEFAULT_OPTIONS
): { content: string; truncated: boolean; originalLines: number } {
  const { maxLines, maxChars, showLineNumbers } = { ...DEFAULT_OPTIONS, ...options };
  
  const lines = code.split('\n');
  const originalLines = lines.length;
  
  let truncated = false;
  let resultLines: string[] = [];
  
  // 按行數截斷
  if (lines.length > maxLines) {
    resultLines = lines.slice(0, maxLines);
    truncated = true;
  } else {
    resultLines = lines;
  }
  
  // 添加行號（可選）
  if (showLineNumbers && resultLines.length > 0) {
    const padding = String(resultLines.length).length;
    resultLines = resultLines.map((line, i) => {
      const lineNum = String(i + 1).padStart(padding, ' ');
      return `${lineNum} │ ${line}`;
    });
  }
  
  let content = resultLines.join('\n');
  
  // 按字符數截斷
  if (content.length > maxChars) {
    content = content.slice(0, maxChars - 20) + '\n... (truncated)';
    truncated = true;
  }
  
  // 添加截斷提示
  if (truncated) {
    content += `\n\n⚠️ 顯示前 ${maxLines} 行，共 ${originalLines} 行`;
  }
  
  return {
    content,
    truncated,
    originalLines
  };
}

/**
 * 提取代碼塊的語言
 */
export function extractLanguage(codeBlock: string): string | null {
  const match = codeBlock.match(/^```(\w+)?/);
  return match ? (match[1] || 'text') : null;
}

/**
 * 提取代碼塊內容（去除標記）
 */
export function extractCodeContent(codeBlock: string): string {
  const lines = codeBlock.split('\n');
  
  if (lines.length < 2) return codeBlock;
  
  // 去除第一行和最後一行標記
  return lines.slice(1, -1).join('\n');
}

/**
 * 格式化輸出為代碼塊
 */
export function formatAsCodeBlock(content: string, language = ''): string {
  return `\`\`\`${language}\n${content}\n\`\`\``;
}

/**
 * 處理終端輸出
 */
export function formatTerminalOutput(
  stdout: string,
  stderr: string,
  exitCode: number,
  truncateOptions: TruncateOptions = DEFAULT_OPTIONS
): string {
  let output = '';
  
  if (stdout) {
    const { content, truncated } = truncateCode(stdout, truncateOptions);
    output += formatAsCodeBlock(content, 'bash');
    if (truncated) output += '\n';
  }
  
  if (stderr) {
    const { content, truncated } = truncateCode(stderr, truncateOptions);
    output += `❌ stderr:\n${formatAsCodeBlock(content, 'bash')}`;
    if (truncated) output += '\n';
  }
  
  if (exitCode !== 0) {
    output += `\n⚠️ Exit Code: ${exitCode}`;
  } else if (!stdout && !stderr) {
    output += '✅ 執行成功（無輸出）';
  }
  
  return output;
}

/**
 * 處理文件內容
 */
export function formatFileContent(
  content: string,
  filePath: string,
  truncateOptions: TruncateOptions = DEFAULT_OPTIONS
): string {
  const ext = filePath.split('.').pop() || '';
  const language = getLanguageByExtension(ext);
  
  const { content: truncatedContent, truncated, originalLines } = truncateCode(content, truncateOptions);
  
  let result = `📝 ${filePath}\n`;
  result += formatAsCodeBlock(truncatedContent, language);
  
  if (truncated) {
    result += `\n⚠️ 顯示 ${truncateOptions.maxLines || 100} 行，共 ${originalLines} 行`;
  }
  
  return result;
}

/**
 * 根據副檔名獲取語言
 */
function getLanguageByExtension(ext: string): string {
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cs: 'csharp',
    html: 'html',
    css: 'css',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash'
  };
  
  return map[ext.toLowerCase()] || 'text';
}