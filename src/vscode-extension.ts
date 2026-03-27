/**
 * VSCode Extension - 與 Telegram Bot 通信
 * 這個文件需要放到 VSCode Extension 中
 */

import * as vscode from 'vscode';
import * as http from 'http';

const PORT = 3456;

export function activate(context: vscode.ExtensionContext) {
  console.log('📡 VSCode Extension 啟動');

  // HTTP Server 接收 Telegram 指令
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        handleCommand(data, res);
      } catch (e) {
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`🔌 VSCode Server 運行在 port ${PORT}`);
  });

  context.subscriptions.push({ dispose: () => server.close() });
}

function handleCommand(data: any, res: any) {
  const { command, args } = data;
  console.log('📝 指令:', command, args);

  let result = '';

  switch (command) {
    case 'terminal':
      executeTerminal(args[0], res);
      return;
    case 'file':
      readFile(args[0], res);
      return;
    case 'run':
      runCurrentFile(res);
      return;
    default:
      result = '未知指令';
  }

  res.end(JSON.stringify({ result }));
}

function executeTerminal(cmd: string, res: any) {
  const terminal = vscode.window.createTerminal();
  terminal.sendText(cmd);
  // TODO: 收集輸出
  setTimeout(() => {
    res.end(JSON.stringify({ result: '執行完成' }));
  }, 1000);
}

function readFile(path: string, res: any) {
  vscode.workspace.findFiles(path).then(files => {
    if (files.length > 0) {
      vscode.window.showTextDocument(files[0]);
      res.end(JSON.stringify({ result: `打開: ${path}` }));
    } else {
      res.end(JSON.stringify({ result: `找不到: ${path}` }));
    }
  });
}

function runCurrentFile(res: any) {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    vscode.commands.executeCommand('workbench.action.runTasks');
    res.end(JSON.stringify({ result: '執行當前任務' }));
  } else {
    res.end(JSON.stringify({ result: '沒有開啟的文件' }));
  }
}

export function deactivate() {}