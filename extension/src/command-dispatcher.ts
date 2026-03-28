// extension/command-dispatcher.ts - 指令路由分發
import * as vscode from 'vscode';
import { BridgeMessage, BridgeResponse, ChatMessage } from './shared-types.js';
import { TerminalRunner } from './terminal-runner.js';
import { FileManager } from './file-manager.js';
import { LMHandler } from './lm-handler.js';

export class CommandDispatcher {
  private terminalRunner = new TerminalRunner();
  private fileManager = new FileManager();
  private lmHandler: LMHandler;
  private useRealLM: boolean = false; // 可開關是否使用真實 LM

  constructor(lmHandler?: LMHandler) {
    this.lmHandler = lmHandler || new LMHandler();
  }

  /**
   * 啟用真實的 Language Model
   */
  enableRealLM() {
    this.useRealLM = true;
  }

  /**
   * 禁用真實的 Language Model（使用模擬響應）
   */
  disableRealLM() {
    this.useRealLM = false;
  }

  /**
   * 取消當前進行中的 LM 請求
   */
  cancelCurrentLMRequest(): void {
    this.lmHandler.cancelCurrentRequest();
  }

  async dispatch(msg: BridgeMessage): Promise<BridgeResponse> {
    const { id, type, payload } = msg;

    try {
      switch (type) {
        case 'ping':
          return this.pongResponse(id);
        
        case 'terminal':
          return await this.handleTerminal(id, payload.command);
        
        case 'file_read':
          return await this.handleFileRead(id, payload.path);
        
        case 'file_write':
          return await this.handleFileWrite(id, payload.path, payload.content);
        
        case 'file_delete':
          return await this.handleFileDelete(id, payload.path);
        
        case 'create_dir':
          return await this.handleCreateDir(id, payload.path);
        
        case 'list_files':
          return await this.handleListFiles(id, payload.path ?? '');
        
        case 'run_code':
          return await this.handleRunCode(id, payload.filePath);
        
        case 'get_status':
          return await this.handleStatus(id);
        
        case 'chat':
          return await this.handleChat(id, payload.message, payload.history || []);
        
        case 'chat_stream':
          return await this.handleChatStream(id, payload.message, payload.history || []);
        
        case 'qa_project':
          return await this.handleQaProject(id, payload.question, payload.history || []);
        
        default:
          return this.errorResponse(id, `未知指令: ${type}`);
      }
    } catch (e: any) {
      return this.errorResponse(id, e.message);
    }
  }

  private pongResponse(id: string): BridgeResponse {
    return {
      id,
      type: 'pong',
      payload: { status: 'ok' },
      status: 'success',
      timestamp: new Date().toISOString()
    };
  }

  private async handleTerminal(id: string, command: string): Promise<BridgeResponse> {
    try {
      const result = await this.terminalRunner.run(command);
      return {
        id,
        type: 'terminal_output',
        payload: result,
        status: 'success',
        timestamp: new Date().toISOString()
      };
    } catch (e: any) {
      return this.errorResponse(id, `終端錯誤: ${e.message}`);
    }
  }

  private async handleFileRead(id: string, filePath: string): Promise<BridgeResponse> {
    try {
      const content = await this.fileManager.readFile(filePath);
      return {
        id,
        type: 'file_content',
        payload: { content, path: filePath },
        status: 'success',
        timestamp: new Date().toISOString()
      };
    } catch (e: any) {
      return this.errorResponse(id, `讀取失敗: ${e.message}`);
    }
  }

  private async handleFileWrite(id: string, filePath: string, content: string): Promise<BridgeResponse> {
    try {
      await this.fileManager.writeFile(filePath, content);
      return {
        id,
        type: 'file_content',
        payload: { message: '文件已寫入', path: filePath },
        status: 'success',
        timestamp: new Date().toISOString()
      };
    } catch (e: any) {
      return this.errorResponse(id, `寫入失敗: ${e.message}`);
    }
  }

  private async handleFileDelete(id: string, filePath: string): Promise<BridgeResponse> {
    try {
      await this.fileManager.deleteFile(filePath);
      return {
        id,
        type: 'file_content',
        payload: { message: `已刪除: ${filePath}`, path: filePath },
        status: 'success',
        timestamp: new Date().toISOString()
      };
    } catch (e: any) {
      return this.errorResponse(id, `刪除失敗: ${e.message}`);
    }
  }

  private async handleCreateDir(id: string, dirPath: string): Promise<BridgeResponse> {
    try {
      await this.fileManager.createDir(dirPath);
      return {
        id,
        type: 'file_content',
        payload: { message: `目錄已建立: ${dirPath}`, path: dirPath },
        status: 'success',
        timestamp: new Date().toISOString()
      };
    } catch (e: any) {
      return this.errorResponse(id, `建立目錄失敗: ${e.message}`);
    }
  }

  private async handleListFiles(id: string, globPattern: string): Promise<BridgeResponse> {
    try {
      const files = await this.fileManager.listFiles(globPattern || '*');
      return {
        id,
        type: 'files_list',
        payload: { files, path: globPattern },
        status: 'success',
        timestamp: new Date().toISOString()
      };
    } catch (e: any) {
      return this.errorResponse(id, `列出失敗: ${e.message}`);
    }
  }

  private async handleRunCode(id: string, filePath?: string): Promise<BridgeResponse> {
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return this.errorResponse(id, '沒有打開的文件');
      }

      const lang = editor.document.languageId;
      const command = this.getRunCommand(lang, filePath);
      
      if (!command) {
        return this.errorResponse(id, `不支持的語言: ${lang}`);
      }

      const result = await this.terminalRunner.run(command);
      return {
        id,
        type: 'run_result',
        payload: result,
        status: 'success',
        timestamp: new Date().toISOString()
      };
    } catch (e: any) {
      return this.errorResponse(id, `執行失敗: ${e.message}`);
    }
  }

  private getRunCommand(lang: string, filePath?: string): string | null {
    // cpp/c 需要多步編譯，不支持 execFile 單命令執行
    if (lang === 'cpp' || lang === 'c') {
      return null;
    }

    const commandArgs: Record<string, string[]> = {
      javascript: ['node'],
      typescript: ['npx', 'ts-node'],
      python: ['python3'],
      go: ['go', 'run'],
      rust: ['cargo', 'run'],
      java: ['java'],
      html: ['echo', '請在瀏覽器打開'],
      css: ['echo', '請在瀏覽器打開']
    };

    const parts = commandArgs[lang];
    if (!parts) return null;

    if (filePath) {
      return [...parts, filePath].join(' ');
    }
    return parts.join(' ');
  }

  private async handleStatus(id: string): Promise<BridgeResponse> {
    const workspace = vscode.workspace.workspaceFolders?.[0]?.name || '無';
    const editor = vscode.window.activeTextEditor?.document.fileName || '無';
    const lmInfo = this.lmHandler.getModelInfo();
    
    return {
      id,
      type: 'status_info',
      payload: {
        workspace,
        editor,
        connected: true,
        lmEnabled: this.useRealLM,
        model: lmInfo || '未配置'
      },
      status: 'success',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 解析消息中的 #file:路徑 引用，讀取文件內容注入上下文
   */
  private async resolveFileReferences(message: string): Promise<{ cleanMessage: string; fileContents: string }> {
    const fileRefPattern = /#file:([^\s]+)/g;
    const fileContents: string[] = [];
    let match;

    while ((match = fileRefPattern.exec(message)) !== null) {
      const filePath = match[1];
      try {
        const content = await this.fileManager.readFile(filePath);
        const ext = filePath.split('.').pop() || '';
        // 每個引用文件最多 150 行，避免超出 token 限制
        const lines = content.split('\n');
        const preview = lines.slice(0, 150).join('\n') + (lines.length > 150 ? '\n... (已截斷)' : '');
        fileContents.push(`📄 ${filePath}:\n\`\`\`${ext}\n${preview}\n\`\`\``);
      } catch {
        fileContents.push(`📄 ${filePath}: ❌ 讀取失敗`);
      }
    }

    const cleanMessage = message.replace(/#file:[^\s]+/g, '').trim();
    return { cleanMessage, fileContents: fileContents.join('\n\n') };
  }

  /**
   * 收集工作區上下文信息（含當前文件內容和項目結構）
   */
  private async buildWorkspaceContext(): Promise<string> {
    const lines: string[] = [];

    // 工作區名稱和路徑
    const wsFolder = vscode.workspace.workspaceFolders?.[0];
    if (wsFolder) {
      lines.push(`工作區: ${wsFolder.name} (${wsFolder.uri.fsPath})`);
    }

    // 項目文件結構
    try {
      const files = await vscode.workspace.findFiles(
        '{src,extension/src,tests}/**/*.{ts,js,json}',
        '{node_modules,dist,out,.git}/**',
        50
      );
      if (files.length > 0) {
        const filePaths = files.map(f => vscode.workspace.asRelativePath(f)).sort();
        lines.push(`\n項目文件結構:\n${filePaths.join('\n')}`);
      }
    } catch { /* ignore */ }

    // 當前活動的文件（包含完整內容）
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const doc = editor.document;
      const relativePath = vscode.workspace.asRelativePath(doc.uri);
      lines.push(`\n當前文件: ${relativePath} (語言: ${doc.languageId})`);

      // 注入文件內容（最多 200 行）
      const content = doc.getText();
      const contentLines = content.split('\n');
      const preview = contentLines.slice(0, 200).join('\n') + (contentLines.length > 200 ? '\n... (已截斷)' : '');
      lines.push(`\n文件內容:\n\`\`\`${doc.languageId}\n${preview}\n\`\`\``);

      // 選中的文字
      const selection = editor.selection;
      if (!selection.isEmpty) {
        const selectedText = doc.getText(selection);
        if (selectedText.length <= 1000) {
          lines.push(`\n用戶選中的代碼:\n\`\`\`${doc.languageId}\n${selectedText}\n\`\`\``);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * 處理 chat 類型的消息（非流式）
   */
  private async handleChat(id: string, message: string, history: ChatMessage[]): Promise<BridgeResponse> {
    if (!this.useRealLM) {
      // 使用模擬響應
      return {
        id,
        type: 'chat_done',
        payload: { 
          full_text: this.getMockResponse(message)
        },
        status: 'success',
        timestamp: new Date().toISOString()
      };
    }

    try {
      // 檢查是否有可用的 LM
      const hasLM = await this.lmHandler.hasAvailableModel();
      if (!hasLM) {
        return {
          id,
          type: 'chat_done',
          payload: { 
            full_text: '⚠️ 沒有可用的 Language Model\n\n請安裝 GitHub Copilot 或其他支持 vscode.lm 的擴展'
          },
          status: 'success',
          timestamp: new Date().toISOString()
        };
      }

      // 解析 #file: 引用 + 收集工作區上下文
      const [{ cleanMessage, fileContents }, workspaceContext] = await Promise.all([
        this.resolveFileReferences(message),
        this.buildWorkspaceContext()
      ]);

      const fullContext = workspaceContext +
        (fileContents ? `\n\n用戶引用的文件:\n${fileContents}` : '');

      // 使用真實 LM
      const response = await this.lmHandler.chat(cleanMessage, history, undefined, fullContext);
      
      return {
        id,
        type: 'chat_done',
        payload: { full_text: response },
        status: 'success',
        timestamp: new Date().toISOString()
      };
    } catch (e: any) {
      return this.errorResponse(id, `LM 錯誤: ${e.message}`);
    }
  }

  /**
   * 處理流式 chat（預留）
   */
  private async handleChatStream(id: string, message: string, history: ChatMessage[]): Promise<BridgeResponse> {
    // 流式響應需要在 Bridge Server 端處理
    // 這裡返回普通響應
    return await this.handleChat(id, message, history);
  }

  /**
   * 處理全項目 QA：讀取所有源碼文件，整體注入給 AI
   */
  private async handleQaProject(id: string, question: string, history: ChatMessage[]): Promise<BridgeResponse> {
    if (!this.useRealLM) {
      return {
        id,
        type: 'chat_done',
        payload: { full_text: this.getMockResponse(question) },
        status: 'success',
        timestamp: new Date().toISOString()
      };
    }

    try {
      const hasLM = await this.lmHandler.hasAvailableModel();
      if (!hasLM) {
        return {
          id,
          type: 'chat_done',
          payload: { full_text: '⚠️ 沒有可用的 Language Model' },
          status: 'success',
          timestamp: new Date().toISOString()
        };
      }

      // 讀取所有項目源碼文件
      const wsFolder = vscode.workspace.workspaceFolders?.[0];
      const projectContext: string[] = [];

      if (wsFolder) {
        projectContext.push(`工作區: ${wsFolder.name} (${wsFolder.uri.fsPath})\n`);

        // 查找所有源碼文件（排除 node_modules / dist / out / .git）
        const files = await vscode.workspace.findFiles(
          '**/*.{ts,js,json,md}',
          '{node_modules,dist,out,.git,*.vsix}/**',
          120
        );
        files.sort((a, b) => a.fsPath.localeCompare(b.fsPath));

        let totalChars = 0;
        const MAX_TOTAL_CHARS = 80000; // 約 20k token，留空間給 question + history

        for (const fileUri of files) {
          if (totalChars >= MAX_TOTAL_CHARS) {
            projectContext.push(`\n...(已達上限，剩餘 ${files.length} 個文件未讀取)`);
            break;
          }
          try {
            const doc = await vscode.workspace.openTextDocument(fileUri);
            const relativePath = vscode.workspace.asRelativePath(fileUri);
            const content = doc.getText();
            const ext = relativePath.split('.').pop() || '';
            // 單文件最多 300 行
            const lines = content.split('\n');
            const preview = lines.slice(0, 300).join('\n') + (lines.length > 300 ? '\n...(截斷)' : '');
            const block = `\n📄 ${relativePath}:\n\`\`\`${ext}\n${preview}\n\`\`\``;
            projectContext.push(block);
            totalChars += block.length;
          } catch { /* 跳過不可讀取的文件 */ }
        }
      }

      const fullContext = projectContext.join('\n');
      const response = await this.lmHandler.chat(question, history, undefined, fullContext);

      return {
        id,
        type: 'chat_done',
        payload: { full_text: response },
        status: 'success',
        timestamp: new Date().toISOString()
      };
    } catch (e: any) {
      return this.errorResponse(id, `QA 錯誤: ${e.message}`);
    }
  }

  /**
   * 模擬響應（當沒有 LM 時使用）
   */
  private getMockResponse(message: string): string {
    const lower = message.toLowerCase();
    
    if (lower.includes('hello') || lower.includes('你好')) {
      return '👋 你好！我是 VSCode2Telegram AI 助手。\n\n請安裝 VSCode Extension 並啟用 Language Model 來獲得完整功能。';
    }
    
    if (lower.includes('help') || lower.includes('幫助')) {
      return `📚 可用指令：
/chat <message> - AI 對話
/terminal <command> - 執行命令
/file <path> - 讀取文件
/run [file] - 執行代碼
/status - 查看狀態

⚠️ 當前使用模擬響應`;
    }

    return `📝 我收到了: "${message}"

⚠️ 這是模擬響應。
如需使用真實 AI，請：
1. 安裝 GitHub Copilot 擴展
2. 在 Extension 中啟用 LM
3. 使用 /status 查看`;
  }

  private errorResponse(id: string, error: string): BridgeResponse {
    return {
      id,
      type: 'error',
      payload: { error },
      status: 'error',
      timestamp: new Date().toISOString()
    };
  }
}