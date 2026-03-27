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
        
        case 'list_files':
          return await this.handleListFiles(id, payload.path);
        
        case 'run_code':
          return await this.handleRunCode(id, payload.filePath);
        
        case 'get_status':
          return await this.handleStatus(id);
        
        case 'chat':
          return await this.handleChat(id, payload.message, payload.history || []);
        
        case 'chat_stream':
          return await this.handleChatStream(id, payload.message, payload.history || []);
        
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
    const result = await this.terminalRunner.run(command);
    return {
      id,
      type: 'terminal_output',
      payload: result,
      status: 'success',
      timestamp: new Date().toISOString()
    };
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
    const commands: Record<string, string> = {
      javascript: 'node',
      typescript: 'npx ts-node',
      python: 'python3',
      go: 'go run',
      rust: 'cargo run',
      java: 'java',
      cpp: 'g++ -o /tmp/a.out && /tmp/a.out',
      c: 'gcc -o /tmp/a.out && /tmp/a.out',
      html: 'echo "請在瀏覽器打開"',
      css: 'echo "請在瀏覽器打開"'
    };
    
    const cmd = commands[lang];
    if (cmd && filePath) {
      return `${cmd} ${filePath}`;
    }
    return cmd ? `${cmd} ${filePath || ''}` : null;
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

      // 使用真實 LM
      const response = await this.lmHandler.chat(message, history);
      
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
      type: 'chat_done',
      payload: { error },
      status: 'error',
      error,
      timestamp: new Date().toISOString()
    };
  }
}