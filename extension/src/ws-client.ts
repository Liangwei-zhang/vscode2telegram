// extension/ws-client.ts - WebSocket 客户端
import WebSocket from 'ws';
import { BridgeMessage, BridgeResponse } from './shared-types.js';

export class ExtensionWSClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageHandler: ((msg: BridgeMessage) => Promise<BridgeResponse>) | null = null;
  private bridgeUrl: string = 'ws://127.0.0.1:3456';
  private wsSecret: string = '';
  private workspaceName: string = 'unknown';
  private workspacePath: string = 'unknown';

  constructor(bridgeUrl?: string, wsSecret?: string, workspaceName?: string, workspacePath?: string) {
    if (bridgeUrl) {
      this.bridgeUrl = bridgeUrl;
    }
    if (wsSecret) {
      this.wsSecret = wsSecret;
    }
    if (workspaceName) {
      this.workspaceName = workspaceName;
    }
    if (workspacePath) {
      this.workspacePath = workspacePath;
    }
  }

  public connect() {
    // 防止重複連接
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      console.log('⚠️ 已有活躍連接，跳過重複 connect()');
      return;
    }

    // 添加 token 認證參數
    const url = this.wsSecret 
      ? `${this.bridgeUrl}?token=${encodeURIComponent(this.wsSecret)}`
      : this.bridgeUrl;
    
    console.log('🔌 連接到 Bridge Server...');
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      console.log('✅ 已連接到 Bridge Server');
      this.ws?.send(JSON.stringify({
        type: 'hello',
        workspaceName: this.workspaceName,
        workspacePath: this.workspacePath
      }));
    });

    this.ws.on('message', async (data) => {
      try {
        const msg: BridgeMessage = JSON.parse(data.toString());
        console.log('📩 收到:', msg.type);
        
        if (this.messageHandler) {
          const response = await this.messageHandler(msg);
          this.ws?.send(JSON.stringify(response));
        }
      } catch (e) {
        console.error('❌ 消息解析錯誤:', e);
      }
    });

    this.ws.on('close', () => {
      console.log('❌ 與 Bridge Server 斷開連接');
      this.ws = null;
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('❌ WebSocket 錯誤:', err.message);
    });
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public setMessageHandler(handler: (msg: BridgeMessage) => Promise<BridgeResponse>) {
    this.messageHandler = handler;
  }

  public send(msg: BridgeMessage): Promise<BridgeResponse> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        return reject(new Error('未連接'));
      }

      const timeout = setTimeout(() => {
        reject(new Error('請求超時'));
      }, 180000);

      const handler = (data: Buffer) => {
        clearTimeout(timeout);
        try {
          const response: BridgeResponse = JSON.parse(data.toString());
          resolve(response);
        } catch (e) {
          reject(e);
        }
      };

      this.ws!.once('message', handler);
      this.ws!.send(JSON.stringify(msg));
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000);
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private sendStatus(status: string) {
    // 發送狀態更新到 bridge
  }
}

export const wsClient = new ExtensionWSClient();