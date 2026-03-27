// extension/command-dispatcher.ts - 指令路由分發
import { BridgeMessage, BridgeResponse } from '../shared/types.js';
import { TerminalRunner } from './terminal-runner.js';
import { FileManager } from './file-manager.js';

export class CommandDispatcher {
  private terminalRunner = new TerminalRunner();
  private fileManager = new FileManager();
  private lmHandler: any = null; // Phase 3 實現

  constructor(lmHandler?: any) {
    if (lmHandler) {
      this.lmHandler = lmHandler;
    }
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
          return this.handleStatus(id);
        
        case 'chat':
          return await this.handleChat(id, payload.message, payload.history);
        
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
    const content = await this.fileManager.readFile(filePath);
    return {
      id,
      type: 'file_content',
      payload: { content, path: filePath },
      status: 'success',
      timestamp: new Date().toISOString()
    };
  }

  private async handleFileWrite(id: string, filePath: string, content: string): Promise<BridgeResponse> {
    await this.fileManager.writeFile(filePath, content);
    return {
      id,
      type: 'file_content',
      payload: { message: '文件已寫入', path: filePath },
      status: 'success',
      timestamp: new Date().toISOString()
    };
  }

  private async handleListFiles(id: string, globPattern: string): Promise<BridgeResponse> {
    const files = await this.fileManager.listFiles(globPattern || '*');
    return {
      id,
      type: 'files_list',
      payload: { files, path: globPattern },
      status: 'success',
      timestamp: new Date().toISOString()
    };
  }

  private async handleRunCode(id: string, filePath?: string): Promise<BridgeResponse> {
    // 獲取當前活動編輯器的語言
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

  private handleStatus(id: string): BridgeResponse {
    const workspace = vscode.workspace.workspaceFolders?.[0]?.name || '無';
    const editor = vscode.window.activeTextEditor?.document.fileName || '無';
    
    return {
      id,
      type: 'status_info',
      payload: {
        workspace,
        editor,
        connected: true
      },
      status: 'success',
      timestamp: new Date().toISOString()
    };
  }

  private async handleChat(id: string, message: string, history: any[]): Promise<BridgeResponse> {
    // Phase 3: 調用 vscode.lm API
    // 目前返回模擬響應
    return {
      id,
      type: 'chat_done',
      payload: { 
        full_text: `我收到了: "${message}"\n\n(Phase 3 將接入 vscode.lm API)` 
      },
      status: 'success',
      timestamp: new Date().toISOString()
    };
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