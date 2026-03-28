// extension/terminal-runner.ts - 終端命令執行
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
      exec(command, {
        cwd: effectiveCwd,
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024, // 10MB
        shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
      }, (err, stdout, stderr) => {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: err?.code ?? (err ? 1 : 0)
        });
      });
    });
  }

  async runStream(
    command: string,
    onOutput: (line: string, isStderr: boolean) => void,
    cwd?: string
  ): Promise<number> {
    const { spawn } = await import('child_process');
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

    const proc = spawn(command, [], {
      cwd: cwd || workspaceRoot,
      shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
    });

    proc.stdout.on('data', (d: Buffer) => { onOutput(d.toString(), false); });
    proc.stderr.on('data', (d: Buffer) => { onOutput(d.toString(), true); });

    return new Promise(resolve => proc.on('close', (code) => resolve(code ?? 0)));
  }
}