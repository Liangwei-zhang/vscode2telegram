// extension/terminal-runner.ts - 終端命令執行
import { exec, spawn } from 'child_process';
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

  async runStream(
    command: string,
    onOutput: (line: string, isStderr: boolean) => void,
    cwd?: string
  ): Promise<number> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const proc = spawn(command, { shell: true, cwd: cwd || workspaceRoot });

    proc.stdout.on('data', (d: Buffer) => {
      onOutput(d.toString(), false);
    });

    proc.stderr.on('data', (d: Buffer) => {
      onOutput(d.toString(), true);
    });

    return new Promise(resolve => proc.on('close', resolve));
  }
}