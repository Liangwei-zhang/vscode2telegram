// bridge/ws-server.ts - WebSocket 服務器（支持多 VSCode 窗口連接）
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { BridgeMessage, BridgeResponse } from '../shared/types.js';
import { config } from '../bot/config.js';

interface PendingRequest {
  resolve: (res: BridgeResponse) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
}

export interface ExtensionConnection {
  id: string;
  ws: WebSocket;
  workspaceName: string;
  workspacePath: string;
  pendingRequests: Map<string, PendingRequest>;
}

export class BridgeServer {
  private wss: WebSocketServer;
  private connections = new Map<string, ExtensionConnection>();
  private activeConnectionId: string | null = null;
  private messageHandler: ((msg: BridgeMessage) => Promise<BridgeResponse>) | null = null;

  constructor(port: number = 3456) {
    this.wss = new WebSocketServer({ host: '127.0.0.1', port });
    this.wss.on('connection', this.onConnection.bind(this));
    console.log(`🔌 Bridge WebSocket Server 運行於 port ${port}`);
  }

  private onConnection(ws: WebSocket, req: any) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const expectedToken = process.env.WS_SECRET;

    if (expectedToken && token !== expectedToken) {
      console.log('❌ WebSocket 認證失敗');
      ws.close(1008, 'Unauthorized');
      return;
    }

    const connId = uuidv4();
    const conn: ExtensionConnection = {
      id: connId,
      ws,
      workspaceName: '未知',
      workspacePath: '',
      pendingRequests: new Map()
    };
    this.connections.set(connId, conn);

    // 新連接若無活跃連接則自動設為活跃
    if (!this.activeConnectionId || !this.connections.has(this.activeConnectionId)) {
      this.activeConnectionId = connId;
    }

    console.log(`📡 VSCode Extension 已連接 (id: ${connId.slice(0, 8)})`);

    ws.on('message', async (data) => {
      try {
        const raw = JSON.parse(data.toString());
        await this.handleMessage(raw, conn);
      } catch (e) {
        console.error('❌ 消息解析錯誤:', e);
      }
    });

    ws.on('close', () => {
      console.log(`❌ VSCode Extension 斷開連接: ${conn.workspaceName}`);
      // 拒絕該連接的所有 pending requests
      for (const [, pending] of conn.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('連接斷開'));
      }
      conn.pendingRequests.clear();
      this.connections.delete(connId);

      // 活跃連接斷開時，切換到第一個可用連接
      if (this.activeConnectionId === connId) {
        const next = this.connections.keys().next().value;
        this.activeConnectionId = next ?? null;
        if (this.activeConnectionId) {
          const nextConn = this.connections.get(this.activeConnectionId)!;
          console.log(`🔄 自動切換到: ${nextConn.workspaceName}`);
        }
      }
    });

    ws.on('error', (err) => {
      console.error('❌ WebSocket 錯誤:', err.message);
    });
  }

  private async handleMessage(msg: any, conn: ExtensionConnection) {
    if (msg.type === 'hello') {
      conn.workspaceName = msg.workspaceName ?? '未知';
      conn.workspacePath = msg.workspacePath ?? '';
      console.log(`🗂️  工作區: ${conn.workspaceName} (${conn.workspacePath})`);
      return;
    }

    const pending = conn.pendingRequests.get(msg.id);
    if (pending) {
      clearTimeout(pending.timeout);
      conn.pendingRequests.delete(msg.id);
      if ('status' in msg) {
        pending.resolve(msg as BridgeResponse);
        return;
      }
    }

    if ('type' in msg && msg.type === 'ping') {
      conn.ws.send(JSON.stringify({
        id: msg.id,
        type: 'pong',
        payload: { status: 'ok' },
        status: 'success',
        timestamp: new Date().toISOString()
      }));
      return;
    }

    if (this.messageHandler) {
      const response = await this.messageHandler(msg as BridgeMessage);
      conn.ws.send(JSON.stringify(response));
    }
  }

  public setMessageHandler(handler: (msg: BridgeMessage) => Promise<BridgeResponse>) {
    this.messageHandler = handler;
  }

  /** 獲取所有已連接的工作區列表 */
  public getConnections(): Array<{ id: string; workspaceName: string; workspacePath: string; isActive: boolean }> {
    return Array.from(this.connections.values()).map(c => ({
      id: c.id,
      workspaceName: c.workspaceName,
      workspacePath: c.workspacePath,
      isActive: c.id === this.activeConnectionId
    }));
  }

  /** 切換活跃連接（按工作區名稱模糊匹配或 id 前綴） */
  public switchConnection(nameOrId: string): ExtensionConnection | null {
    const lower = nameOrId.toLowerCase();
    for (const conn of this.connections.values()) {
      if (
        conn.workspaceName.toLowerCase().includes(lower) ||
        conn.id.startsWith(lower)
      ) {
        this.activeConnectionId = conn.id;
        return conn;
      }
    }
    return null;
  }

  public isConnected(): boolean {
    const active = this.activeConnectionId ? this.connections.get(this.activeConnectionId) : null;
    return active !== undefined && active !== null && active.ws.readyState === WebSocket.OPEN;
  }

  public async sendCommand(msg: BridgeMessage): Promise<BridgeResponse> {
    // Build ordered list: active connection first, then others
    const orderedIds: string[] = [];
    if (this.activeConnectionId && this.connections.has(this.activeConnectionId)) {
      orderedIds.push(this.activeConnectionId);
    }
    for (const id of this.connections.keys()) {
      if (!orderedIds.includes(id)) orderedIds.push(id);
    }
    if (orderedIds.length === 0) {
      throw new Error('VSCode Extension 未連接');
    }

    let lastError = new Error('VSCode Extension 未連接');
    for (const connId of orderedIds) {
      const conn = this.connections.get(connId);
      if (!conn || conn.ws.readyState !== WebSocket.OPEN) continue;

      let response: BridgeResponse;
      try {
        response = await this.sendToConnection(conn, msg);
      } catch (e: any) {
        lastError = e;
        continue;
      }

      // If this connection returns "未知指令", it has old extension code — try next
      const errMsg: string = (response.payload as any)?.error ?? '';
      if (response.status === 'error' && errMsg.includes('未知指令')) {
        lastError = new Error(errMsg);
        continue;
      }

      // Got a valid response — if we used a fallback, switch active to it
      if (connId !== this.activeConnectionId) {
        this.activeConnectionId = connId;
        console.log(`🔄 自動切換到: ${conn.workspaceName} (支持此指令)`);
      }
      return response;
    }
    throw lastError;
  }

  private sendToConnection(conn: ExtensionConnection, msg: BridgeMessage): Promise<BridgeResponse> {
    return new Promise((resolve, reject) => {
      if (conn.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('連接已斷開'));
      }
      const timeoutMs = config.getBridge().timeout;
      const timeout = setTimeout(() => {
        conn.pendingRequests.delete(msg.id);
        reject(new Error('指令超時'));
      }, timeoutMs);
      conn.pendingRequests.set(msg.id, { resolve, reject, timeout });
      conn.ws.send(JSON.stringify(msg));
    });
  }

  public sendToExtension(response: BridgeResponse) {
    const conn = this.activeConnectionId ? this.connections.get(this.activeConnectionId) : null;
    if (conn && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify(response));
    }
  }

  public getStatus() {
    const active = this.activeConnectionId ? this.connections.get(this.activeConnectionId) : null;
    return {
      connected: this.isConnected(),
      totalConnections: this.connections.size,
      pendingRequests: active?.pendingRequests.size ?? 0,
      workspaceName: active?.workspaceName ?? null,
      workspacePath: active?.workspacePath ?? null
    };
  }
}