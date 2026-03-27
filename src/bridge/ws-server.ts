// bridge/ws-server.ts - WebSocket 服務器
import { WebSocketServer, WebSocket } from 'ws';
import { BridgeMessage, BridgeResponse } from '../shared/types.js';
import { config } from '../bot/config.js';

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
  private connectedWorkspaceName: string | null = null;
  private connectedWorkspacePath: string | null = null;

  constructor(port: number = 3456) {
    this.wss = new WebSocketServer({ host: '127.0.0.1', port });
    this.wss.on('connection', this.onConnection.bind(this));
    console.log(`🔌 Bridge WebSocket Server 運行於 port ${port}`);
  }

  private onConnection(ws: WebSocket, req: any) {
    // 驗證 WebSocket 認證 token
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const expectedToken = process.env.WS_SECRET;
    
    if (expectedToken && token !== expectedToken) {
      console.log('❌ WebSocket 認證失敗');
      ws.close(1008, 'Unauthorized');
      return;
    }
    
    console.log('📡 VSCode Extension 已連接');
    this.extensionSocket = ws;
    this.connectedWorkspaceName = null;
    this.connectedWorkspacePath = null;

    ws.on('message', async (data) => {
      try {
        const raw = JSON.parse(data.toString());
        await this.handleMessage(raw, ws);
      } catch (e) {
        console.error('❌ 消息解析錯誤:', e);
      }
    });

    ws.on('close', () => {
      console.log('❌ VSCode Extension 斷開連接');
      this.extensionSocket = null;
      this.connectedWorkspaceName = null;
      this.connectedWorkspacePath = null;
      // 拒絕所有 pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('連接斷開'));
      }
      this.pendingRequests.clear();
    });

    ws.on('error', (err) => {
      console.error('❌ WebSocket 錯誤:', err.message);
    });
  }

  private async handleMessage(msg: any, ws: WebSocket) {
    // 處理 hello 握手消息
    if (msg.type === 'hello') {
      this.connectedWorkspaceName = msg.workspaceName ?? null;
      this.connectedWorkspacePath = msg.workspacePath ?? null;
      console.log(`🗂️  工作區: ${this.connectedWorkspaceName} (${this.connectedWorkspacePath})`);
      return;
    }

    // 檢查是否為 pending request 的回應
    const pending = this.pendingRequests.get(msg.id);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(msg.id);
      // 如果是 BridgeResponse 格式，直接 resolve
      if ('status' in msg) {
        pending.resolve(msg as BridgeResponse);
        return;
      }
    }

    // 處理其他消息，通過 handler
    if ('type' in msg && msg.type === 'ping') {
      this.sendToExtension({
        id: msg.id,
        type: 'pong',
        payload: { status: 'ok' },
        status: 'success',
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (this.messageHandler) {
      const response = await this.messageHandler(msg as BridgeMessage);
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

      const timeoutMs = config.getBridge().timeout;
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(msg.id);
        reject(new Error('指令超時'));
      }, timeoutMs);

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
      pendingRequests: this.pendingRequests.size,
      workspaceName: this.connectedWorkspaceName,
      workspacePath: this.connectedWorkspacePath
    };
  }
}