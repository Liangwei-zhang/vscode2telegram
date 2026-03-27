// shared/logger.ts - 日誌系統優化
import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
}

class Logger {
  private level: LogLevel = 'info';
  private logFile: string = '';
  private enableConsole: boolean = true;
  private enableFile: boolean = false;

  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  configure(options: { level?: LogLevel; file?: string; console?: boolean; enableFile?: boolean }) {
    if (options.level) this.level = options.level;
    if (options.file) this.logFile = options.file;
    if (options.console !== undefined) this.enableConsole = options.console;
    if (options.enableFile !== undefined) this.enableFile = options.enableFile;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level];
  }

  private format(level: LogLevel, message: string, context?: Record<string, any>): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context
    };

    if (context) {
      return `[${entry.timestamp}] ${level.toUpperCase()}: ${message} ${JSON.stringify(context)}`;
    }
    return `[${entry.timestamp}] ${level.toUpperCase()}: ${message}`;
  }

  private write(level: LogLevel, message: string, context?: Record<string, any>) {
    if (!this.shouldLog(level)) return;

    const formatted = this.format(level, message, context);

    if (this.enableConsole) {
      const color = level === 'error' ? '\x1b[31m' :
                   level === 'warn' ? '\x1b[33m' :
                   level === 'debug' ? '\x1b[36m' : '\x1b[0m';
      console.log(`${color}${formatted}\x1b[0m`);
    }

    if (this.enableFile && this.logFile) {
      try {
        const dir = path.dirname(this.logFile);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.appendFileSync(this.logFile, formatted + '\n');
      } catch (e) {
        console.error('❌ 日誌寫入失敗:', e);
      }
    }
  }

  debug(message: string, context?: Record<string, any>) {
    this.write('debug', message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.write('info', message, context);
  }

  warn(message: string, context?: Record<string, any>) {
    this.write('warn', message, context);
  }

  error(message: string, context?: Record<string, any>) {
    this.write('error', message, context);
  }

  // 快捷方法
  logCommand(userId: number, command: string, args?: string) {
    this.info('命令執行', { userId, command, args });
  }

  logConnection(status: 'connected' | 'disconnected', details?: string) {
    this.info('連接狀態', { status, details });
  }

  logError(operation: string, error: Error | string) {
    this.error(`錯誤: ${operation}`, { error: String(error) });
  }
}

export const logger = new Logger();