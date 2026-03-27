# VSCode2Telegram 详细设计文档

**版本**: v1.0  
**日期**: 2026-03-27  
**状态**: 开发用设计稿

---

## 目录

1. [项目概述](#1-项目概述)
2. [系统架构](#2-系统架构)
3. [模块详细设计](#3-模块详细设计)
4. [通信协议](#4-通信协议)
5. [VSCode Agent Chat 集成](#5-vscode-agent-chat-集成)
6. [功能规格](#6-功能规格)
7. [安全设计](#7-安全设计)
8. [目录结构](#8-目录结构)
9. [开发路线图](#9-开发路线图)
10. [关键 API 参考](#10-关键-api-参考)

---

## 1. 项目概述

### 1.1 目标

构建一个桥接服务，将 Telegram 与运行在本地的 VSCode Agent Chat 系统（如 GitHub Copilot、Cline 等）双向联通，使用户可以：

- 通过 Telegram 向 VSCode Agent 发送编程任务指令
- 接收 Agent 的执行结果、代码输出、文件变更
- 远程控制 VSCode 的终端、文件系统
- 在 Telegram 中持续与 Agent 进行多轮对话

### 1.2 现有框架分析

| 文件 | 现状 | 问题 |
|------|------|------|
| `src/index.ts` | Telegram Bot 骨架（grammy） | 所有命令只返回 "TODO"，未与 VSCode 通信 |
| `src/vscode-extension.ts` | HTTP Server 骨架 | 无法捕获终端输出；未接入 LM API |
| `.env` | 仅有 Token 和 Port | 缺少安全配置 |

### 1.3 核心挑战

1. **终端输出捕获** —— VSCode 终端 API 不提供 stdout 读取，需要用 pseudoterminal 或 child_process 替代
2. **Agent Chat 集成** —— 需对接 `vscode.lm` Language Model API，实现流式响应
3. **可靠连接** —— HTTP 轮询延迟高，需升级为 WebSocket 长连接
4. **消息格式转换** —— Agent 输出包含 Markdown/代码块，需适配 Telegram 格式

---

## 2. 系统架构

### 2.1 总体架构图

```
┌─────────────────────────────────────────────────────┐
│                   用户设备                           │
│  ┌──────────┐                                        │
│  │ Telegram │                                        │
│  │   App    │                                        │
│  └────┬─────┘                                        │
└───────┼─────────────────────────────────────────────┘
        │ HTTPS (Telegram Bot API)
        ▼
┌───────────────────────────────────┐
│        Bridge Server              │  ← 本项目核心（Node.js）
│  ┌──────────────┐                 │
│  │  Telegram    │                 │
│  │  Bot Handler │                 │
│  │  (grammy)    │                 │
│  └──────┬───────┘                 │
│         │                         │
│  ┌──────▼───────┐                 │
│  │  Session &   │                 │
│  │  Queue Mgr   │                 │
│  └──────┬───────┘                 │
│         │                         │
│  ┌──────▼───────┐                 │
│  │  WebSocket   │                 │
│  │  Server      │                 │
│  └──────┬───────┘                 │
└─────────┼─────────────────────────┘
          │ WebSocket (ws://)
          │ localhost only
          ▼
┌─────────────────────────────────────────────────────┐
│              本地开发机（VSCode 运行环境）             │
│                                                      │
│  ┌──────────────────────────────────────┐           │
│  │           VSCode Extension           │           │
│  │  ┌─────────────┐  ┌──────────────┐  │           │
│  │  │  WS Client  │  │  LM API      │  │           │
│  │  │  (连接桥接) │  │  (vscode.lm) │  │           │
│  │  └──────┬──────┘  └──────┬───────┘  │           │
│  │         │                │           │           │
│  │  ┌──────▼────────────────▼───────┐  │           │
│  │  │      Command Dispatcher       │  │           │
│  │  └───┬──────────────┬────────────┘  │           │
│  │      │              │                │           │
│  │  ┌───▼────┐   ┌─────▼───────┐       │           │
│  │  │Terminal│   │  File Sys   │       │           │
│  │  │ Runner │   │  Manager    │       │           │
│  │  └────────┘   └─────────────┘       │           │
│  └──────────────────────────────────────┘           │
│                                                      │
│  ┌─────────────────────────────────────┐            │
│  │         GitHub Copilot / Cline      │            │
│  │    (或其他 VSCode Chat 扩展)         │            │
│  └─────────────────────────────────────┘            │
└─────────────────────────────────────────────────────┘
```

### 2.2 部署模式

Bridge Server 和 VSCode 运行在**同一台本地机器**上，通过 localhost WebSocket 通信，无需暴露外网端口。

---

## 3. 模块详细设计

### 3.1 模块拆分

```
src/
├── bot/                      # Telegram Bot 层
│   ├── index.ts              # Bot 入口，grammy 初始化
│   ├── commands/             # 各命令处理器
│   │   ├── chat.ts           # /chat — 发送给 Agent
│   │   ├── terminal.ts       # /terminal — 执行终端命令
│   │   ├── file.ts           # /file, /edit — 文件操作
│   │   ├── run.ts            # /run — 运行代码
│   │   └── status.ts         # /status — 连接状态
│   ├── formatters/           # 响应格式化
│   │   ├── markdown.ts       # Agent Markdown → Telegram MarkdownV2
│   │   └── code-block.ts     # 代码块截断 & 分页
│   └── middleware/
│       ├── auth.ts           # 用户白名单验证
│       └── rate-limit.ts     # 频率限制
│
├── bridge/                   # 核心桥接层
│   ├── ws-server.ts          # WebSocket 服务器
│   ├── session-manager.ts    # 对话会话管理
│   ├── message-queue.ts      # 消息队列（pending 请求）
│   └── protocol.ts           # 消息协议类型定义
│
├── extension/                # VSCode Extension（独立打包）
│   ├── extension.ts          # activate / deactivate
│   ├── ws-client.ts          # WebSocket 客户端（连接 Bridge）
│   ├── lm-handler.ts         # vscode.lm API 集成
│   ├── terminal-runner.ts    # 终端命令执行 & 输出捕获
│   ├── file-manager.ts       # 文件读写操作
│   └── command-dispatcher.ts # 指令路由分发
│
└── shared/
    └── types.ts              # 共享类型定义
```

---

### 3.2 Bridge Server — WebSocket 服务器

**职责**: 作为 Telegram Bot 和 VSCode Extension 之间的中间人。

```typescript
// bridge/ws-server.ts
import { WebSocketServer, WebSocket } from 'ws';

export class BridgeServer {
  private wss: WebSocketServer;
  private extensionSocket: WebSocket | null = null;  // VSCode Extension 连接
  private pendingRequests = new Map<string, PendingRequest>();

  constructor(port: number) {
    this.wss = new WebSocketServer({ host: '127.0.0.1', port });
    this.wss.on('connection', this.onExtensionConnect.bind(this));
  }

  // 发送指令给 VSCode Extension，返回 Promise<Response>
  async sendCommand(msg: BridgeMessage): Promise<BridgeResponse> {
    return new Promise((resolve, reject) => {
      if (!this.extensionSocket) {
        return reject(new Error('VSCode Extension 未连接'));
      }
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(msg.id);
        reject(new Error('指令超时'));
      }, 30000);

      this.pendingRequests.set(msg.id, { resolve, reject, timeout });
      this.extensionSocket.send(JSON.stringify(msg));
    });
  }

  // 流式发送：通过回调实时推送 Agent 部分响应
  async sendStreamCommand(
    msg: BridgeMessage,
    onChunk: (chunk: string) => void
  ): Promise<void> { /* ... */ }
}
```

---

### 3.3 VSCode Extension — WebSocket 客户端

**职责**: 在 VSCode 内运行，连接到 Bridge Server，执行指令。

```typescript
// extension/ws-client.ts
import WebSocket from 'ws';

export class ExtensionWSClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  connect(bridgeUrl: string) {
    this.ws = new WebSocket(bridgeUrl);

    this.ws.on('open', () => {
      console.log('✅ 已连接到 Bridge Server');
      this.sendStatus('connected');
    });

    this.ws.on('message', async (data) => {
      const msg: BridgeMessage = JSON.parse(data.toString());
      const response = await this.dispatcher.dispatch(msg);
      this.ws!.send(JSON.stringify(response));
    });

    this.ws.on('close', () => {
      // 5 秒后自动重连
      this.reconnectTimer = setTimeout(() => this.connect(bridgeUrl), 5000);
    });
  }
}
```

---

### 3.4 Session Manager — 对话会话管理

每个 Telegram 用户维护独立的对话上下文，支持多轮与 Agent 的连续对话。

```typescript
// bridge/session-manager.ts
interface Session {
  telegramUserId: number;
  chatHistory: ChatMessage[];      // 发给 vscode.lm 的历史
  lastActivity: Date;
  currentRequestId: string | null; // 当前进行中的请求
}

export class SessionManager {
  private sessions = new Map<number, Session>();

  getOrCreate(userId: number): Session { /* ... */ }

  appendHistory(userId: number, role: 'user' | 'assistant', content: string) {
    const session = this.getOrCreate(userId);
    session.chatHistory.push({ role, content });
    // 保持最近 20 条，防止 context 过长
    if (session.chatHistory.length > 20) {
      session.chatHistory = session.chatHistory.slice(-20);
    }
  }

  clearHistory(userId: number) { /* ... */ }
}
```

---

## 4. 通信协议

### 4.1 消息格式定义

```typescript
// shared/types.ts

// Bridge Server → VSCode Extension（指令）
interface BridgeMessage {
  id: string;              // UUID，用于匹配响应
  type: MessageType;
  payload: Record<string, any>;
  userId: number;          // Telegram 用户 ID
  timestamp: string;       // ISO 8601
}

type MessageType =
  | 'chat'          // 发送给 Agent 的对话消息
  | 'terminal'      // 终端命令
  | 'file_read'     // 读取文件
  | 'file_write'    // 写入文件
  | 'run_code'      // 运行当前文件
  | 'get_status'    // 获取 VSCode 状态

// VSCode Extension → Bridge Server（响应）
interface BridgeResponse {
  id: string;              // 对应 BridgeMessage.id
  type: ResponseType;
  payload: Record<string, any>;
  status: 'success' | 'error' | 'streaming';
  error?: string;
  timestamp: string;
}

type ResponseType =
  | 'chat_chunk'    // Agent 流式输出（部分内容）
  | 'chat_done'     // Agent 输出完成
  | 'terminal_output'
  | 'file_content'
  | 'run_result'
  | 'status_info'
```

### 4.2 消息样例

**Telegram 发送聊天指令：**
```json
{
  "id": "a1b2c3d4-...",
  "type": "chat",
  "payload": {
    "message": "帮我写一个 TypeScript 的冒泡排序函数",
    "history": [
      { "role": "user", "content": "我在写算法练习" },
      { "role": "assistant", "content": "好的，需要什么语言？" }
    ]
  },
  "userId": 123456789,
  "timestamp": "2026-03-27T10:00:00Z"
}
```

**Agent 流式响应：**
```json
{ "id": "a1b2c3d4-...", "type": "chat_chunk", "status": "streaming",
  "payload": { "chunk": "```typescript\nfunction bubbleSort" } }
{ "id": "a1b2c3d4-...", "type": "chat_chunk", "status": "streaming",
  "payload": { "chunk": "(arr: number[]): number[] {" } }
{ "id": "a1b2c3d4-...", "type": "chat_done", "status": "success",
  "payload": { "full_text": "..." } }
```

**终端命令：**
```json
{
  "id": "e5f6g7h8-...",
  "type": "terminal",
  "payload": { "command": "npm test", "cwd": "/workspace/myproject" }
}
```

**终端响应：**
```json
{
  "id": "e5f6g7h8-...",
  "type": "terminal_output",
  "status": "success",
  "payload": {
    "stdout": "PASS src/sort.test.ts\n✓ bubbleSort (3ms)",
    "stderr": "",
    "exitCode": 0
  }
}
```

---

## 5. VSCode Agent Chat 集成

这是项目最核心的部分，对接 `vscode.lm` Language Model API。

### 5.1 获取可用模型

```typescript
// extension/lm-handler.ts
import * as vscode from 'vscode';

export class LMHandler {
  async getChatModels(): Promise<vscode.LanguageModelChat[]> {
    // 获取所有可用的 chat 模型（Copilot、本地模型等）
    return await vscode.lm.selectChatModels({
      vendor: 'copilot',   // 优先选 Copilot；若无则任意模型
      family: 'gpt-4o'     // 可配置
    });
  }
}
```

### 5.2 发送对话并流式返回

```typescript
async chat(
  message: string,
  history: ChatMessage[],
  onChunk: (chunk: string) => void
): Promise<string> {
  const models = await vscode.lm.selectChatModels();
  if (!models.length) throw new Error('没有可用的 Language Model');

  const model = models[0];
  const messages: vscode.LanguageModelChatMessage[] = [
    // 系统提示：告诉 Agent 它在通过 Telegram 远程协作
    vscode.LanguageModelChatMessage.Assistant(
      '你是一个 VSCode 中的编程助手，用户通过 Telegram 远程与你交互。' +
      '请直接给出代码和简洁的解释，避免过多废话。'
    ),
    // 对话历史
    ...history.map(h =>
      h.role === 'user'
        ? vscode.LanguageModelChatMessage.User(h.content)
        : vscode.LanguageModelChatMessage.Assistant(h.content)
    ),
    // 当前消息
    vscode.LanguageModelChatMessage.User(message)
  ];

  const cancellation = new vscode.CancellationTokenSource();
  let fullResponse = '';

  try {
    const response = await model.sendRequest(messages, {}, cancellation.token);

    for await (const part of response.stream) {
      if (part instanceof vscode.LanguageModelTextPart) {
        fullResponse += part.value;
        onChunk(part.value);   // 实时推送给 Telegram
      }
    }
  } finally {
    cancellation.dispose();
  }

  return fullResponse;
}
```

### 5.3 终端输出捕获

VSCode 原生终端 API 无法读取 stdout，需使用 `vscode.window.createTerminal` 的 `pty` 接口，或直接用 Node.js `child_process`：

```typescript
// extension/terminal-runner.ts
import { exec } from 'child_process';
import * as vscode from 'vscode';

export class TerminalRunner {
  async run(
    command: string,
    cwd?: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const effectiveCwd = cwd || workspaceRoot || process.cwd();

    return new Promise((resolve) => {
      exec(command, { cwd: effectiveCwd, timeout: 60000 }, (err, stdout, stderr) => {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: err?.code ?? 0
        });
      });
    });
  }

  // 流式执行（适用于长时间运行的命令）
  async runStream(
    command: string,
    onOutput: (line: string, isStderr: boolean) => void,
    cwd?: string
  ): Promise<number> {
    const { spawn } = require('child_process');
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const proc = spawn(command, { shell: true, cwd: cwd || workspaceRoot });

    proc.stdout.on('data', (d: Buffer) => onOutput(d.toString(), false));
    proc.stderr.on('data', (d: Buffer) => onOutput(d.toString(), true));

    return new Promise(resolve => proc.on('close', resolve));
  }
}
```

### 5.4 文件管理器

```typescript
// extension/file-manager.ts
import * as vscode from 'vscode';
import * as fs from 'fs/promises';

export class FileManager {
  async readFile(relativePath: string): Promise<string> {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) throw new Error('没有打开的工作区');
    const fullPath = path.join(root, relativePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) throw new Error('没有打开的工作区');
    const fullPath = path.join(root, relativePath);
    await fs.writeFile(fullPath, content, 'utf-8');
    // 在 VSCode 编辑器中打开（可选）
    await vscode.window.showTextDocument(vscode.Uri.file(fullPath));
  }

  async listFiles(globPattern: string): Promise<string[]> {
    const files = await vscode.workspace.findFiles(globPattern, '**/node_modules/**', 50);
    return files.map(f => vscode.workspace.asRelativePath(f));
  }
}
```

---

## 6. 功能规格

### 6.1 Telegram Bot 指令列表

| 指令 | 格式 | 描述 |
|------|------|------|
| `/start` | `/start` | 显示欢迎信息和指令列表 |
| `/chat` | `/chat <消息>` | **核心** 与 VSCode Agent 对话 |
| `/terminal` | `/terminal <命令>` | 执行终端命令，返回输出 |
| `/run` | `/run [文件路径]` | 运行当前或指定文件 |
| `/file` | `/file <路径>` | 读取文件内容 |
| `/edit` | `/edit <路径> <内容>` | 写入文件（需确认） |
| `/ls` | `/ls [路径]` | 列出工作区文件 |
| `/status` | `/status` | 查看 VSCode 连接状态 |
| `/clear` | `/clear` | 清空当前对话历史 |
| `/cancel` | `/cancel` | 取消当前进行中的请求 |

### 6.2 普通消息（非命令）

当用户发送非命令的普通消息时，自动视为 `/chat` 消息，直接转发给 Agent。这是最常用的交互模式。

```typescript
// bot/index.ts
bot.on('message:text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return; // 命令交由各 handler 处理
  // 普通消息 → 直接进入 chat 流程
  await chatHandler(ctx, ctx.message.text);
});
```

### 6.3 Telegram 消息格式适配

Agent 输出的 Markdown 需转换为 Telegram 支持的 MarkdownV2 格式：

```typescript
// bot/formatters/markdown.ts
export function toTelegramMarkdown(agentOutput: string): string {
  return agentOutput
    // 代码块保留
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `\`\`\`${lang}\n${escapeTgMd(code)}\`\`\``
    )
    // 内联代码
    .replace(/`([^`]+)`/g, (_, code) => `\`${escapeTgMd(code)}\``)
    // 粗体
    .replace(/\*\*(.+?)\*\*/g, (_, t) => `*${escapeTgMd(t)}*`)
    // 斜体
    .replace(/_(.+?)_/g, (_, t) => `_${escapeTgMd(t)}_`)
    // 剩余特殊字符转义
    .replace(/([.!?|{}\[\]()~>#+\-=])/g, '\\$1');
}

// Telegram 消息长度限制 4096 字符，超过则分页
export function splitMessage(text: string, limit = 4000): string[] {
  if (text.length <= limit) return [text];
  const parts: string[] = [];
  // 按代码块边界或段落分割，避免截断代码块
  // ...
  return parts;
}
```

### 6.4 流式响应到 Telegram

Agent 的流式输出实时推送给用户（类似 ChatGPT 打字效果）：

```typescript
// bot/commands/chat.ts
async function chatHandler(ctx: Context, message: string) {
  const loadingMsg = await ctx.reply('🤔 Agent 思考中...');
  let buffer = '';
  let lastEditTime = 0;

  const onChunk = async (chunk: string) => {
    buffer += chunk;
    const now = Date.now();
    // 每 1 秒更新一次消息，避免触发 Telegram API 限制
    if (now - lastEditTime > 1000) {
      lastEditTime = now;
      await ctx.api.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        buffer + ' ▌',  // 打字光标
        { parse_mode: 'MarkdownV2' }
      ).catch(() => {}); // 内容未变时会报错，忽略
    }
  };

  const fullResponse = await bridge.sendStreamCommand(
    { type: 'chat', payload: { message, history: session.chatHistory } },
    onChunk
  );

  // 最终版本
  await ctx.api.editMessageText(
    ctx.chat.id,
    loadingMsg.message_id,
    toTelegramMarkdown(fullResponse),
    { parse_mode: 'MarkdownV2' }
  );

  sessionManager.appendHistory(ctx.from!.id, 'user', message);
  sessionManager.appendHistory(ctx.from!.id, 'assistant', fullResponse);
}
```

---

## 7. 安全设计

### 7.1 用户白名单

```typescript
// bot/middleware/auth.ts
const ALLOWED_USER_IDS = process.env.ALLOWED_TELEGRAM_USER_IDS
  ?.split(',')
  .map(Number) ?? [];

export const authMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId || !ALLOWED_USER_IDS.includes(userId)) {
    await ctx.reply('❌ 未授权');
    return;
  }
  await next();
};
```

### 7.2 危险命令确认

写文件、删除文件等操作需要二次确认：

```typescript
// 使用 grammy 的 inline keyboard 实现确认
const confirmKeyboard = new InlineKeyboard()
  .text('✅ 确认执行', `confirm:${requestId}`)
  .text('❌ 取消', `cancel:${requestId}`);

await ctx.reply(
  `⚠️ 即将写入文件 \`${path}\`，确认？`,
  { reply_markup: confirmKeyboard, parse_mode: 'MarkdownV2' }
);
```

### 7.3 命令黑名单

禁止部分高危终端命令：

```typescript
const BLOCKED_COMMANDS = ['rm -rf', 'sudo', 'chmod 777', '> /dev/'];

function isCommandSafe(cmd: string): boolean {
  return !BLOCKED_COMMANDS.some(blocked =>
    cmd.toLowerCase().includes(blocked)
  );
}
```

### 7.4 环境变量配置

```bash
# .env（完整版）
TELEGRAM_BOT_TOKEN=your_bot_token
VSCODE_BRIDGE_PORT=3456
ALLOWED_TELEGRAM_USER_IDS=123456789,987654321
COMMAND_TIMEOUT_MS=60000
MAX_OUTPUT_LENGTH=3000
ENABLE_FILE_WRITE=true
ENABLE_DANGEROUS_COMMANDS=false
```

---

## 8. 目录结构

```
vscode2telegram/
├── package.json
├── tsconfig.json
├── .env.example
├── .env                         # 不提交 git
│
├── src/                         # Bridge Server（Node.js 进程）
│   ├── bot/
│   │   ├── index.ts             # grammy Bot 初始化
│   │   ├── commands/
│   │   │   ├── chat.ts
│   │   │   ├── terminal.ts
│   │   │   ├── file.ts
│   │   │   ├── run.ts
│   │   │   └── status.ts
│   │   ├── formatters/
│   │   │   ├── markdown.ts
│   │   │   └── code-block.ts
│   │   └── middleware/
│   │       ├── auth.ts
│   │       └── rate-limit.ts
│   │
│   ├── bridge/
│   │   ├── ws-server.ts
│   │   ├── session-manager.ts
│   │   ├── message-queue.ts
│   │   └── protocol.ts
│   │
│   └── shared/
│       └── types.ts
│
├── extension/                   # VSCode Extension（独立打包）
│   ├── package.json             # Extension manifest
│   ├── tsconfig.json
│   └── src/
│       ├── extension.ts         # activate / deactivate
│       ├── ws-client.ts
│       ├── lm-handler.ts
│       ├── terminal-runner.ts
│       ├── file-manager.ts
│       └── command-dispatcher.ts
│
└── docs/
    └── 设计文档.md               # 本文档
```

---

## 9. 开发路线图

### Phase 1：基础通信（1-2天）

- [ ] 实现 `bridge/ws-server.ts`，替代现有 HTTP 服务
- [ ] 实现 `extension/ws-client.ts`，连接 Bridge Server
- [ ] 实现基本 `ping/pong` 握手和 `/status` 命令
- [ ] 实现 `auth.ts` 用户白名单

### Phase 2：终端集成（1天）

- [ ] 实现 `terminal-runner.ts`（child_process 方案）
- [ ] `/terminal` 命令返回真实 stdout/stderr
- [ ] 输出超长时自动截断并提示

### Phase 3：Agent Chat 集成（2-3天）

- [ ] 实现 `lm-handler.ts`，调用 `vscode.lm` API
- [ ] 实现流式响应 → Telegram 实时更新
- [ ] 实现 Session 对话历史管理
- [ ] `/chat` 命令和普通消息路由
- [ ] Markdown 格式转换

### Phase 4：文件操作（1天）

- [ ] `/file` 读取文件内容
- [ ] `/ls` 列举文件
- [ ] `/edit` 写入文件（带确认）

### Phase 5：完善与优化（持续）

- [ ] 命令超时处理
- [ ] `/cancel` 中断进行中请求
- [ ] 频率限制（rate limit）
- [ ] 危险命令黑名单
- [ ] Extension 打包为 `.vsix`，一键安装

---

## 10. 关键 API 参考

### 10.1 vscode.lm API（VSCode 1.90+）

```typescript
// 列出可用模型
const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });

// 发送请求
const response = await model.sendRequest(messages, {}, token);

// 流式读取
for await (const part of response.stream) {
  if (part instanceof vscode.LanguageModelTextPart) {
    console.log(part.value);  // 增量文本
  }
}
```

> **注意**: 需要 VSCode 1.90+ 且已安装 GitHub Copilot 或其他支持 `vscode.lm` 的扩展。如果想支持 Cline 等第三方 Agent，需要通过 `vscode.commands` 与其交互或调用其暴露的 API。

### 10.2 grammy Bot API 关键用法

```typescript
// 编辑已发送的消息（流式更新用）
await ctx.api.editMessageText(chatId, msgId, newText, { parse_mode: 'MarkdownV2' });

// Inline Keyboard（确认按钮）
bot.callbackQuery(/confirm:(.+)/, async (ctx) => {
  const requestId = ctx.match[1];
  // 执行确认逻辑
  await ctx.answerCallbackQuery('✅ 已确认');
});
```

### 10.3 extension/package.json 关键字段

```json
{
  "name": "vscode2telegram-extension",
  "displayName": "VSCode2Telegram Bridge",
  "engines": { "vscode": "^1.90.0" },
  "activationEvents": ["onStartupFinished"],
  "contributes": {
    "commands": [
      { "command": "vscode2telegram.connect", "title": "Connect to Telegram Bridge" },
      { "command": "vscode2telegram.disconnect", "title": "Disconnect" }
    ]
  },
  "dependencies": {
    "ws": "^8.0.0"
  }
}
```

---

## 附录：典型交互流程

```
用户 Telegram           Bridge Server          VSCode Extension
     │                       │                       │
     │ "帮我优化这段代码"      │                       │
     ├──────────────────────►│                       │
     │                       │ WS: { type:'chat',    │
     │                       │   payload:{message} } │
     │                       ├──────────────────────►│
     │                       │                       │ vscode.lm.sendRequest()
     │                       │                       ├──────────────────────►
     │                       │ WS: {type:'chunk',    │ streaming...
     │ [实时更新消息]          │◄──────────────────────┤
     │◄──────────────────────┤                       │
     │                       │                       │
     │ [最终消息]             │ WS: {type:'done'}     │
     │◄──────────────────────┤◄──────────────────────┤
     │                       │                       │
     │ "/terminal npm test"  │                       │
     ├──────────────────────►│                       │
     │                       ├──────────────────────►│ child_process.exec()
     │                       │                       ├──────────────────────►
     │ "PASS ✓ 3 tests"      │◄──────────────────────┤
     │◄──────────────────────┤                       │
```
