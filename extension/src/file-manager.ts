// extension/file-manager.ts - 文件管理
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileManager {
  private rootPath: string | null = null;

  private getRoot(): string {
    if (!this.rootPath) {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!root) throw new Error('沒有打開的工作區');
      this.rootPath = root;
    }
    return this.rootPath;
  }

  // 防止路徑遍歷攻擊
  private validatePath(relativePath: string): string {
    // 移除前後空白
    const cleaned = relativePath.trim();
    
    // 禁止穿透父目錄
    if (cleaned.includes('..')) {
      throw new Error('不允許路徑穿透');
    }
    
    // 禁止絕對路徑
    if (path.isAbsolute(cleaned)) {
      throw new Error('不允許絕對路徑');
    }

    const fullPath = path.join(this.getRoot(), cleaned);
    
    // 確保最終路徑在允許的目錄內（Windows 不區分大小寫）
    const normalizedFull = fullPath.toLowerCase();
    const normalizedRoot = this.getRoot().toLowerCase();
    if (!normalizedFull.startsWith(normalizedRoot)) {
      throw new Error('路徑驗證失敗');
    }

    return fullPath;
  }

  async readFile(relativePath: string): Promise<string> {
    const fullPath = this.validatePath(relativePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    const fullPath = this.validatePath(relativePath);
    await fs.writeFile(fullPath, content, 'utf-8');
    await vscode.window.showTextDocument(vscode.Uri.file(fullPath));
  }

  async listFiles(globPattern: string): Promise<string[]> {
    // 清理 glob pattern
    const cleaned = globPattern.replace(/\.\./g, '');
    const files = await vscode.workspace.findFiles(cleaned, '**/node_modules/**', 50);
    return files.map(f => vscode.workspace.asRelativePath(f));
  }

  async deleteFile(relativePath: string): Promise<void> {
    const fullPath = this.validatePath(relativePath);
    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      await fs.rm(fullPath, { recursive: true, force: true });
    } else {
      await fs.unlink(fullPath);
    }
    // 如果文件在 VSCode 中打開則關閉
    const uri = vscode.Uri.file(fullPath);
    const openDoc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === fullPath);
    if (openDoc) {
      await vscode.window.showTextDocument(openDoc);
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    }
  }

  async createDir(relativePath: string): Promise<void> {
    const fullPath = this.validatePath(relativePath);
    await fs.mkdir(fullPath, { recursive: true });
  }

  async fileExists(relativePath: string): Promise<boolean> {
    try {
      const fullPath = this.validatePath(relativePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}