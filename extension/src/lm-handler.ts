// extension/lm-handler.ts - VSCode Language Model API 集成
import * as vscode from 'vscode';
import type { ChatMessage } from '../src/shared/types.js';

export class LMHandler {
  private model: vscode.LanguageModelChat | null = null;
  private selectedModelFamily: string = 'gpt-4o';

  /**
   * 獲取可用的 Chat 模型
   */
  async getChatModels(): Promise<vscode.LanguageModelChat[]> {
    try {
      // 獲取所有可用的 chat 模型
      const models = await vscode.lm.selectChatModels();
      return models;
    } catch (e) {
      console.error('❌ 獲取模型失敗:', e);
      return [];
    }
  }

  /**
   * 選擇最佳模型
   */
  async selectModel(): Promise<vscode.LanguageModelChat | null> {
    const models = await this.getChatModels();
    
    if (models.length === 0) {
      console.log('⚠️ 沒有可用的 Language Model');
      return null;
    }

    // 優先選擇 Copilot GPT-4o
    const preferred = models.find(m => 
      m.modelFamily?.toLowerCase().includes('gpt-4o') ||
      m.modelFamily?.toLowerCase().includes('copilot')
    );

    this.model = preferred || models[0];
    console.log('✅ 使用模型:', this.model.modelFamily || this.model.modelId);
    
    return this.model;
  }

  /**
   * 發送對話並獲取響應
   */
  async chat(
    message: string,
    history: ChatMessage[],
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    // 確保模型已選擇
    if (!this.model) {
      await this.selectModel();
    }

    if (!this.model) {
      throw new Error('沒有可用的 Language Model，請安裝 GitHub Copilot 或其他支持 vscode.lm 的擴展');
    }

    // 構建消息列表
    const messages: vscode.LanguageModelChatMessage[] = [
      // 系統提示
      vscode.LanguageModelChatMessage.Assistant(
        '你是一個 VSCode 中的編程助手，用戶通過 Telegram 遠程與你交互。' +
        '請直接給出代碼和簡潔的解釋，避免過多廢話。' +
        '如果需要多個文件，請標註文件名。'
      ),
      // 歷史記錄
      ...history.map(h =>
        h.role === 'user'
          ? vscode.LanguageModelChatMessage.User(h.content)
          : vscode.LanguageModelChatMessage.Assistant(h.content)
      ),
      // 當前消息
      vscode.LanguageModelChatMessage.User(message)
    ];

    // 創建取消令牌
    const cancellation = new vscode.CancellationTokenSource();
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
      name: this.model.modelId,
      family: this.model.modelFamily || 'unknown',
      vendor: (this.model as any).vendor || 'unknown'
    };
  }

  /**
   * 檢查是否有可用的模型
   */
  async hasAvailableModel(): Promise<boolean> {
    const models = await this.getChatModels();
    return models.length > 0;
  }
}

// 導出單例
export const lmHandler = new LMHandler();