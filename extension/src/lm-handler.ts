// extension/lm-handler.ts - VSCode Language Model API 集成
import * as vscode from 'vscode';
import type { ChatMessage } from './shared-types.js';

// 指定模型優先級（從高到低依次嘗試）
const MODEL_PRIORITY = [
  'claude-sonnet-4.6',
  'claude-sonnet-4.5',
  'claude-sonnet-4',
  'claude-sonnet',
];

export class LMHandler {
  private model: vscode.LanguageModelChat | null = null;
  private selectedModelFamily: string = 'claude-sonnet-4.6'; // 指定 Sonnet 4.6
  private activeCancellation: vscode.CancellationTokenSource | null = null;

  /**
   * 獲取可用的 Chat 模型
   */
  async getChatModels(): Promise<vscode.LanguageModelChat[]> {
    try {
      const models = await vscode.lm.selectChatModels();
      return models;
    } catch (e) {
      console.error('❌ 獲取模型失敗:', e);
      return [];
    }
  }

  /**
   * 選擇最佳模型：直接用 selectChatModels({ family }) 精確請求，
   * 若找不到則按優先級列表依次降級，最後才用第一個可用模型。
   */
  async selectModel(): Promise<vscode.LanguageModelChat | null> {
    // 1. 先嘗試精確請求指定 family（最快路徑）
    try {
      const exact = await vscode.lm.selectChatModels({ family: this.selectedModelFamily });
      if (exact.length > 0) {
        this.model = exact[0];
        console.log('✅ 精確匹配模型:', this.model.id, '/ family:', this.model.family);
        return this.model;
      }
    } catch { /* 繼續降級 */ }

    // 2. 從所有可用模型中按優先級列表匹配
    const models = await this.getChatModels();
    if (models.length === 0) {
      console.log('⚠️ 沒有可用的 Language Model');
      return null;
    }

    for (const priority of MODEL_PRIORITY) {
      const found = models.find(m =>
        m.id?.toLowerCase() === priority.toLowerCase() ||
        m.family?.toLowerCase() === priority.toLowerCase() ||
        m.id?.toLowerCase().includes(priority.toLowerCase())
      );
      if (found) {
        this.model = found;
        console.log('✅ 優先級匹配模型:', this.model.id, '/ family:', this.model.family);
        return this.model;
      }
    }

    // 3. 最終降級到第一個可用
    this.model = models[0];
    console.log('⚠️ 降級使用模型:', this.model.id, '/ family:', this.model.family);
    return this.model;
  }

  /**
   * 發送對話並獲取響應
   */
  async chat(
    message: string,
    history: ChatMessage[],
    onChunk?: (chunk: string) => void,
    workspaceContext?: string
  ): Promise<string> {
    // 確保模型已選擇
    if (!this.model) {
      await this.selectModel();
    }

    if (!this.model) {
      throw new Error('沒有可用的 Language Model，請安裝 GitHub Copilot 或其他支持 vscode.lm 的擴展');
    }

    // 構建系統提示
    const systemPrompt =
      '你是一個 VSCode 中的編程助手，用戶通過 Telegram 遠程與你交互。' +
      '請直接給出代碼和簡潔的解釋，避免過多廢話。' +
      '如果需要多個文件，請標註文件名。' +
      (workspaceContext ? `\n\n當前工作區信息：\n${workspaceContext}` : '');

    // 構建消息列表
    const messages: vscode.LanguageModelChatMessage[] = [
      // 系統提示（使用 User 角色）
      vscode.LanguageModelChatMessage.User(systemPrompt),
      // 歷史記錄
      ...history.map(h =>
        h.role === 'user'
          ? vscode.LanguageModelChatMessage.User(h.content)
          : vscode.LanguageModelChatMessage.Assistant(h.content)
      ),
      // 當前消息
      vscode.LanguageModelChatMessage.User(message)
    ];

    // 創建取消令牌（存為實例變量，支持外部取消）
    const cancellation = new vscode.CancellationTokenSource();
    this.activeCancellation = cancellation;
    let fullResponse = '';

    try {
      // 發送請求
      const response = await this.model.sendRequest(
        messages,
        {},
        cancellation.token
      );

      // 流式讀取響應
      for await (const part of response.stream) {
        if (part instanceof vscode.LanguageModelTextPart) {
          fullResponse += part.value;
          
          // 回調流式內容
          if (onChunk) {
            onChunk(part.value);
          }
        }
      }

      return fullResponse;
    } catch (e: any) {
      if (e instanceof vscode.CancellationError) {
        return '⚠️ 請求已取消';
      }
      throw e;
    } finally {
      cancellation.dispose();
      this.activeCancellation = null;
    }
  }

  /**
   * 取消當前進行中的 LM 請求
   */
  cancelCurrentRequest(): void {
    if (this.activeCancellation) {
      this.activeCancellation.cancel();
    }
  }

  /**
   * 同步版本的 chat
   */
  async chatSync(message: string, history: ChatMessage[]): Promise<string> {
    return await this.chat(message, history);
  }

  /**
   * 獲取模型信息
   */
  getModelInfo(): { name: string; family: string; vendor: string } | null {
    if (!this.model) return null;
    
    return {
      name: this.model.id,
      family: this.model.family || 'unknown',
      vendor: (this.model as any).vendor || 'unknown'
    };
  }

  /**
   * 列出所有可用模型（含詳細信息）
   */
  async listAllModels(): Promise<Array<{ id: string; family: string; vendor: string; version: string }>> {
    const models = await this.getChatModels();
    return models.map(m => ({
      id: m.id,
      family: m.family || 'unknown',
      vendor: (m as any).vendor || 'unknown',
      version: (m as any).version || 'unknown'
    }));
  }

  /**
   * 按 id 或 family 切換模型（即刻生效）
   */
  async setModelById(modelId: string): Promise<{ id: string; family: string } | null> {
    const models = await this.getChatModels();
    const target = models.find(
      m => m.id === modelId ||
           m.family?.toLowerCase() === modelId.toLowerCase() ||
           m.id.toLowerCase().includes(modelId.toLowerCase()) ||
           (m.family || '').toLowerCase().includes(modelId.toLowerCase())
    );
    if (!target) return null;
    this.model = target;
    this.selectedModelFamily = target.family || target.id;
    console.log('🔄 模型已切換:', target.id);
    return { id: target.id, family: target.family || 'unknown' };
  }

  /**
   * 检查是否有可用的模型
   */
  async hasAvailableModel(): Promise<boolean> {
    const models = await this.getChatModels();
    return models.length > 0;
  }
}

// 導出單例
export const lmHandler = new LMHandler();