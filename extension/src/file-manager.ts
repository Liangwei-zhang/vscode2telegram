// extension/file-manager.ts - 文件管理
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileManager {
  async readFile(relativePath: string): Promise<string> {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) throw new Error('沒有打開的工作區');
    const fullPath = path.join(root, relativePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) throw new Error('沒有打開的工作區');
    const fullPath = path.join(root, relativePath);
    await fs.writeFile(fullPath, content, 'utf-8');
    // 在 VSCode 編輯器中打開
    await vscode.window.showTextDocument(vscode.Uri.file(fullPath));
  }

  async listFiles(globPattern: string): Promise<string[]> {
    const files = await vscode.workspace.findFiles(globPattern, '**/node_modules/**', 50);
    return files.map(f => vscode.workspace.asRelativePath(f));
  }

  async fileExists(relativePath: string): Promise<boolean> {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!root) return false;
    const fullPath = path.join(root, relativePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}