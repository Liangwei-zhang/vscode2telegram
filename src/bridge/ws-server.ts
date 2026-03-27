// bridge/ws-server.ts - WebSocket 服務器
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { BridgeMessage, BridgeResponse } from '../shared/types.js';

interface PendingRequest {
  resolve: (res: BridgeResponse) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
}

export class BridgeServer {
  private wss: WebSocketServer;
  private extensionSocket: WebSocket | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private messageHandler: ((msg: BridgeMessage) => Promise<BridgeResponse>) | null = null;

  constructor(port: number = 3456) {
    this.wss = new WebSocketServer({ host: '127.0.0.1', port });
    this.wss.on('connection', this.onConnection.bind(this));
    console.log(`🔌 Bridge WebSocket Server 運行於 port ${port}`);
  }

  private onConnection(ws: WebSocket) {
    console.log('📡 VSCode Extension 已連接');
    this.extensionSocket = ws;

    ws.on('message', async (data) => {
      try {
        const msg: BridgeMessage = JSON.parse(data.toString());
        await this.handleMessage(msg, ws);
      } catch (e) {
        console.error('❌ 消息解析錯誤:', e);
      }
    });

    ws.on('close', () => {
      console.log('❌ VSCode Extension 斷開連接');
      this.extensionSocket = null;
    });

    ws.on('error', (err) => {
      console.error('❌ WebSocket 錯誤:', err.message);
    });
  }

  private async handleMessage(msg: BridgeMessage, ws: WebSocket) {
    // 響應 ping
    if (msg.type === 'ping') {
      this.sendToExtension({
        id: msg.id,
        type: 'pong',
        payload: {},
        status: 'success',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 處理其他消息，通過 handler
    if (this.messageHandler) {
      const response = await this.messageHandler(msg);
      this.sendToExtension(response);
    }
  }

  public setMessageHandler(handler: (msg: BridgeMessage) => Promise<BridgeResponse>) {
    this.messageHandler = handler;
  }

  public isConnected(): boolean {
    return this.extensionSocket !== null && this.extensionSocket.readyState === WebSocket.OPEN;
  }

  public async sendCommand(msg: BridgeMessage): Promise<BridgeResponse> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        return reject(new Error('VSCode Extension 未連接'));
      }

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(msg.id);
        reject(new Error('指令超時'));
      }, 30000);

      this.pendingRequests.set(msg.id, { resolve, reject, timeout });
      this.extensionSocket!.send(JSON.stringify(msg));
    });
  }

  public sendToExtension(response: BridgeResponse) {
    if (this.extensionSocket && this.isConnected()) {
      this.extensionSocket.send(JSON.stringify(response));
    }
  }

  public getStatus() {
    return {
      connected: this.isConnected(),
      pendingRequests: this.pendingRequests.size
    };
  }
}