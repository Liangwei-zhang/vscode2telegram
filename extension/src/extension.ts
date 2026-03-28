// extension/src/extension.ts - VSCode Extension 入口
import * as vscode from 'vscode';
import { ExtensionWSClient } from './ws-client.js';
import { CommandDispatcher } from './command-dispatcher.js';

let wsClient: ExtensionWSClient;
let dispatcher: CommandDispatcher;

export function activate(context: vscode.ExtensionContext) {
  console.log('📡 VSCode2Telegram Extension 啟動');

  // 初始化 Command Dispatcher，啟用真實 LM
  dispatcher = new CommandDispatcher();
  dispatcher.enableRealLM();

  // 初始化 WebSocket Client
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspaceName = workspaceFolders?.[0]?.name ?? 'unknown';
  const workspacePath = workspaceFolders?.[0]?.uri.fsPath ?? 'unknown';
  const bridgePort = vscode.workspace.getConfiguration('vscode2telegram').get<number>('bridgePort', 3456);
  const wsSecret = vscode.workspace.getConfiguration('vscode2telegram').get<string>('wsSecret', '');
  const bridgeUrl = `ws://127.0.0.1:${bridgePort}`;
  wsClient = new ExtensionWSClient(bridgeUrl, wsSecret, workspaceName, workspacePath);
  wsClient.setMessageHandler(async (msg) => {
    return await dispatcher.dispatch(msg);
  });
  wsClient.connect();

  // 註冊命令
  const connectCmd = vscode.commands.registerCommand('vscode2telegram.connect', () => {
    wsClient.connect();
    vscode.window.showInformationMessage('✅ 已連接到 Bridge Server');
  });

  const disconnectCmd = vscode.commands.registerCommand('vscode2telegram.disconnect', () => {
    wsClient.disconnect();
    vscode.window.showInformationMessage('❌ 已斷開連接');
  });

  const statusCmd = vscode.commands.registerCommand('vscode2telegram.status', async () => {
    const status = wsClient.isConnected() ? '✅ 已連接' : '❌ 未連接';
    vscode.window.showInformationMessage(`VSCode2Telegram: ${status}`);
  });

  context.subscriptions.push(connectCmd, disconnectCmd, statusCmd);

  // 狀態欄
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.text = '$(plug) VSCode2Telegram';
  statusBarItem.command = 'vscode2telegram.status';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  console.log('✅ Extension 準備就緒');
}

export function deactivate() {
  wsClient?.disconnect();
  console.log('👋 Extension 已關閉');
}