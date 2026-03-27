// extension/ws-client.ts - WebSocket 客户端
import WebSocket from 'ws';
import { BridgeMessage, BridgeResponse } from '../shared/types.js';

export class ExtensionWSClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageHandler: ((msg: BridgeMessage) => Promise<BridgeResponse>) | null = null;
  private bridgeUrl: string = 'ws://127.0.0.1:3456';

  constructor(bridgeUrl?: string) {
    if (bridgeUrl) {
      this.bridgeUrl = bridgeUrl;
    }
  }

  public connect() {
    console.log('🔌 連接到 Bridge Server...');
    this.ws = new WebSocket(this.bridgeUrl);

    this.ws.on('open', () => {
      console.log('✅ 已連接到 Bridge Server');
      this.sendStatus('connected');
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
      console.log('❌ 連接斷開，5秒後重連...');
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('❌ WebSocket 錯誤:', err.message);
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000);
  }

  public setMessageHandler(handler: (msg: BridgeMessage) => Promise<BridgeResponse>) {
    this.messageHandler = handler;
  }

  public sendStatus(status: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'pong',
        payload: { status }
      }));
    }
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}