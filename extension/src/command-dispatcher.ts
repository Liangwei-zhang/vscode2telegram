// extension/command-dispatcher.ts - 指令路由分發
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
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
        
        case 'agent_task':
          return await this.handleAgentTask(id, payload.task, payload.history || []);
        
        case 'model_list':
          return await this.handleModelList(id);
        
        case 'model_set':
          return await this.handleModelSet(id, payload.modelId);
        
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
   * 直接讀取項目所有源碼文件（用 fs.readFile 而非 openTextDocument，避免觸發語言服務，速度快 10x）
   */
  private async readProjectFiles(glob: string, maxTotalChars = 80000): Promise<string> {
    const wsFolder = vscode.workspace.workspaceFolders?.[0];
    if (!wsFolder) return '';
    const lines: string[] = [`工作區: ${wsFolder.name} (${wsFolder.uri.fsPath})\n`];
    const files = await vscode.workspace.findFiles(glob, '{node_modules,dist,out,.git,*.vsix,logs}/**', 120);
    files.sort((a, b) => a.fsPath.localeCompare(b.fsPath));
    let totalChars = 0;
    for (const fileUri of files) {
      if (totalChars >= maxTotalChars) {
        lines.push(`\n...(已達字符上限，剩餘文件未讀取)`);
        break;
      }
      try {
        const content = await fs.readFile(fileUri.fsPath, 'utf-8');
        const rel = vscode.workspace.asRelativePath(fileUri);
        const ext = rel.split('.').pop() || '';
        const fileLines = content.split('\n');
        const preview = fileLines.slice(0, 300).join('\n') + (fileLines.length > 300 ? '\n...(截斷)' : '');
        const block = `\n📄 ${rel}:\n\`\`\`${ext}\n${preview}\n\`\`\``;
        lines.push(block);
        totalChars += block.length;
      } catch { /* 跳過不可讀取的文件 */ }
    }
    return lines.join('\n');
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
   * 收集工作區上下文信息（含全部源碼文件內容 + 當前文件/選中代碼）
   */
  private async buildWorkspaceContext(): Promise<string> {
    const lines: string[] = [];

    // 讀取全部項目源碼（40k chars 限制，為 history + question 保留空間）
    try {
      const projectFiles = await this.readProjectFiles(
        '**/*.{ts,js,json,md,css,html,sh}',
        40000
      );
      lines.push(projectFiles);
    } catch { /* ignore */ }

    // 當前活動的文件（補充完整內容 + 選中代碼）
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const doc = editor.document;
      const relativePath = vscode.workspace.asRelativePath(doc.uri);
      lines.push(`\n⭐ 當前正在編輯的文件: ${relativePath} (語言: ${doc.languageId})`);

      // 選中的文字（優先展示）
      const selection = editor.selection;
      if (!selection.isEmpty) {
        const selectedText = doc.getText(selection);
        if (selectedText.length <= 2000) {
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

      // 讀取所有項目源碼文件（使用快速 fs.readFile）
      const fullContext = await this.readProjectFiles('**/*.{ts,js,json,md}', 80000);

      const qaSystemPrompt =
        `你是一個專業的代碼審查員，正在分析下面提供的完整項目源碼。\n` +
        `你的任務是直接對代碼進行分析，給出具體的發現結果。\n\n` +
        `重要規則：\n` +
        `- 不要建議用戶「去終端執行某命令」或「在 IDE 中運行某工具」\n` +
        `- 直接分析代碼，列出具體問題（哪個文件第幾行有什麼問題）\n` +
        `- 對找到的問題，直接給出修復後的代碼片段\n` +
        `- 用中文回答，分類列出：Bug、類型問題、安全問題、性能問題、代碼品質\n\n` +
        `項目源碼：\n` + fullContext;

      const response = await this.lmHandler.chat(question, history, undefined, qaSystemPrompt);

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
   * Agent 任務：AI 规划 → 解析代码块 → 批量写文件 → 执行 terminal 指令
   *
   * AI 响应约定格式：
   *   <<<FILE:path/to/file.ts>>>
   *   ...文件完整内容...
   *   <<<END>>>
   *
   *   <<<CMD>>>
   *   git add -A && git commit -m "..."
   *   <<<END>>>
   */
  private async handleAgentTask(id: string, task: string, history: ChatMessage[]): Promise<BridgeResponse> {
    if (!this.useRealLM) {
      return {
        id, type: 'chat_done',
        payload: { full_text: this.getMockResponse(task) },
        status: 'success', timestamp: new Date().toISOString()
      };
    }

    try {
      const hasLM = await this.lmHandler.hasAvailableModel();
      if (!hasLM) {
        return {
          id, type: 'chat_done',
          payload: { full_text: '⚠️ 沒有可用的 Language Model' },
          status: 'success', timestamp: new Date().toISOString()
        };
      }

      // 1. 收集全项目源码上下文（使用快速 fs.readFile）
      const projectFilesContext = await this.readProjectFiles(
        '**/*.{ts,js,json,md,css,html,sh,env}',
        80000
      );

      // 2. 构造 Agent 系统 prompt
      const systemPrompt =
        `你是一個直接操作 VSCode 項目的 AI Agent，由用戶通過 Telegram 遠程控制。\n` +
        `本系統會自動解析你輸出的特殊格式塊並立即執行——這是唯一的執行方式。\n\n` +
        `【絕對禁止】：\n` +
        `- 禁止說「請在終端執行...」「請運行...」「你需要...」\n` +
        `- 禁止只給建議或描述步驟，必須直接輸出可執行的格式塊\n` +
        `- 禁止用 markdown 代碼塊（\`\`\`）代替格式塊\n\n` +
        `【必须使用的輸出格式】：\n` +
        `需要修改/創建文件時（必须输出完整文件内容）：\n` +
        `<<<FILE:相對於工作區的路徑>>>\n文件的完整內容（不要省略任何部分）\n<<<END>>>\n\n` +
        `需要執行終端命令時（git、npm、等任何命令）：\n` +
        `<<<CMD>>>\n要執行的命令\n<<<END>>>\n\n` +
        `【示例 - git 提交代碼】：\n` +
        `<<<CMD>>>\ngit add -A\n<<<END>>>\n` +
        `<<<CMD>>>\ngit commit -m "feat: 你的提交信息"\n<<<END>>>\n` +
        `<<<CMD>>>\ngit push\n<<<END>>>\n\n` +
        `【示例 - 修改文件後提交】：\n` +
        `<<<FILE:src/example.ts>>>\n// 完整文件內容\n<<<END>>>\n` +
        `<<<CMD>>>\ngit add -A && git commit -m "fix: 修復問題"\n<<<END>>>\n\n` +
        `最後輸出一段簡短中文摘要說明完成了什麼。\n\n` +
        `當前工作區項目代碼：\n` + projectFilesContext;

      // 3. 调用 AI
      const aiResponse = await this.lmHandler.chat(task, history, undefined, systemPrompt);

      // 4. 解析 FILE 块并写入文件
      const filesChanged: string[] = [];
      const filePattern = /<<<FILE:([^>]+)>>>([\s\S]*?)<<<END>>>/g;
      let match;
      while ((match = filePattern.exec(aiResponse)) !== null) {
        const filePath = match[1].trim();
        const content = match[2].replace(/^\n/, '').replace(/\n$/, '');
        try {
          await this.fileManager.writeFile(filePath, content);
          filesChanged.push(filePath);
        } catch (e: any) {
          filesChanged.push(`❌ ${filePath}: ${e.message}`);
        }
      }

      // 5. 解析 CMD 块并执行
      const terminalOutputs: Array<{ command: string; output: string; exitCode: number }> = [];

      const cmdPattern2 = /<<<CMD>>>([\s\S]*?)<<<END>>>/g;
      let cmdMatch;
      while ((cmdMatch = cmdPattern2.exec(aiResponse)) !== null) {
        const command = cmdMatch[1].trim();
        if (!command) continue;
        try {
          const result = await this.terminalRunner.run(command);
          terminalOutputs.push({ command, output: result.stdout || result.stderr, exitCode: result.exitCode });
        } catch (e: any) {
          terminalOutputs.push({ command, output: e.message, exitCode: 1 });
        }
      }

      // 6. 提取摘要（去掉所有 <<<...>>> 块后的剩余文本）
      const summary = aiResponse
        .replace(/<<<FILE:[^>]+>>>[\s\S]*?<<<END>>>/g, '')
        .replace(/<<<CMD>>>[\s\S]*?<<<END>>>/g, '')
        .trim() || '✅ 任務完成';

      return {
        id,
        type: 'agent_result',
        payload: { summary, filesChanged, terminalOutputs },
        status: 'success',
        timestamp: new Date().toISOString()
      };
    } catch (e: any) {
      return this.errorResponse(id, `Agent 錯誤: ${e.message}`);
    }
  }

  /**
   * 列出所有可用 LM 模型
   */
  private async handleModelList(id: string): Promise<BridgeResponse> {
    try {
      const models = await this.lmHandler.listAllModels();
      const info = this.lmHandler.getModelInfo();
      const current = info?.name || 'none';
      return {
        id,
        type: 'model_list',
        payload: { models, current },
        status: 'success',
        timestamp: new Date().toISOString()
      };
    } catch (e: any) {
      return this.errorResponse(id, `獲取模型列表失敗: ${e.message}`);
    }
  }

  /**
   * 切換 LM 模型
   */
  private async handleModelSet(id: string, modelId: string): Promise<BridgeResponse> {
    try {
      const result = await this.lmHandler.setModelById(modelId);
      if (!result) {
        return this.errorResponse(id, `找不到模型: "${modelId}"，請用 /model 查看可用列表`);
      }
      return {
        id,
        type: 'model_list',
        payload: {
          models: await this.lmHandler.listAllModels(),
          current: result.id
        },
        status: 'success',
        timestamp: new Date().toISOString()
      };
    } catch (e: any) {
      return this.errorResponse(id, `切換模型失敗: ${e.message}`);
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