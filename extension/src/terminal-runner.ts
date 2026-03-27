// extension/terminal-runner.ts - 終端命令執行
import { execFile } from 'child_process';
import * as vscode from 'vscode';

// 允許的命令白名單
const ALLOWED_COMMANDS = new Set([
  'ls', 'cat', 'pwd', 'cd', 'echo', 'git', 'npm', 'node', 'pnpm', 'yarn',
  'python', 'python3', 'pip', 'cargo', 'go', 'make', 'cmake', 'gcc',
  'grep', 'find', 'head', 'tail', 'wc', 'sort', 'uniq', 'awk', 'sed',
  'curl', 'wget', 'tar', 'zip', 'unzip', 'mv', 'cp', 'mkdir', 'rm'
]);

export class TerminalRunner {
  // 驗證命令是否安全
  private validateCommand(command: string): void {
    const parts = command.trim().split(/\s+/);
    const baseCmd = parts[0];
    
    // 檢查基本命令是否在白名單
    if (!ALLOWED_COMMANDS.has(baseCmd)) {
      // 允許自定義腳本（相對路徑）
      if (!baseCmd.startsWith('./') && !baseCmd.startsWith('/')) {
        throw new Error(`命令 "${baseCmd}" 不在允許列表中`);
      }
    }
    
    // 危險模式檢測
    const dangerous = [
      /;\s*rm\s+-rf/i, /&&\s*rm\s+-rf/i, /\|\s*rm\s+-rf/i,
      /:\(\)\{/, /eval\s*\(/, /`.*`/,
      /\$\(.*\)/, /\$HOME/, /\$PATH/
    ];
    
    for (const pattern of dangerous) {
      if (pattern.test(command)) {
        throw new Error('檢測到危險命令模式');
      }
    }
  }

  async run(
    command: string,
    cwd?: string
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // 驗證命令
    this.validateCommand(command);
    
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const effectiveCwd = cwd || workspaceRoot || process.cwd();

    return new Promise((resolve, reject) => {
      // 使用 execFile 代替 exec，更安全
      const parts = command.split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1);
      
      execFile(cmd, args, { 
        cwd: effectiveCwd, 
        timeout: 60000,
        shell: false // 不使用 shell 解析
      }, (err, stdout, stderr) => {
        if (err) {
          // 超時錯誤
          if (err.killed) {
            reject(new Error('命令執行超時'));
            return;
          }
          reject(err);
          return;
        }
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: 0
        });
      });
    });
  }

  async runStream(
    command: string,
    onOutput: (line: string, isStderr: boolean) => void,
    cwd?: string
  ): Promise<number> {
    // 驗證命令
    this.validateCommand(command);
    
    const { spawn } = await import('child_process');
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const parts = command.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);
    
    const proc = spawn(cmd, args, { 
      cwd: cwd || workspaceRoot,
      shell: false
    });

    proc.stdout.on('data', (d: Buffer) => {
      onOutput(d.toString(), false);
    });

    proc.stderr.on('data', (d: Buffer) => {
      onOutput(d.toString(), true);
    });

    return new Promise(resolve => proc.on('close', (code) => resolve(code ?? 0)));
  }
}