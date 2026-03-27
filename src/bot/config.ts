// bot/config.ts - 配置管理優化
import * as fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

interface Config {
  telegram: {
    botToken: string;
    allowedUserIds: number[];
  };
  bridge: {
    port: number;
    host: string;
    timeout: number;
  };
  security: {
    blockedCommands: string[];
    rateLimit: {
      windowMs: number;
      maxRequests: number;
    };
    enableFileWrite: boolean;
  };
  vscode: {
    extensionPort: number;
    autoConnect: boolean;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file: string;
  };
}

const DEFAULT_CONFIG: Config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    allowedUserIds: process.env.ALLOWED_TELEGRAM_USER_IDS?.split(',').map(Number).filter(Boolean) || []
  },
  bridge: {
    port: parseInt(process.env.BRIDGE_PORT || '3456'),
    host: process.env.BRIDGE_HOST || '127.0.0.1',
    timeout: parseInt(process.env.COMMAND_TIMEOUT_MS || '30000')
  },
  security: {
    blockedCommands: ['rm -rf', 'sudo', 'chmod 777', '> /dev/', 'dd if='],
    rateLimit: {
      windowMs: 60000,
      maxRequests: 20
    },
    enableFileWrite: process.env.ENABLE_FILE_WRITE === 'true'
  },
  vscode: {
    extensionPort: 3456,
    autoConnect: true
  },
  logging: {
    level: (process.env.LOG_LEVEL as any) || 'info',
    file: process.env.LOG_FILE || './logs/vscode2telegram.log'
  }
};

// 深度合併工具函數
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target } as any;
  
  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key])
      ) {
        result[key] = deepMerge(result[key] || {}, source[key] as any);
      } else {
        result[key] = source[key];
      }
    }
  }
  
  return result as T;
}

class ConfigManager {
  private config: Config;
  private configPath: string;

  constructor() {
    this.configPath = process.env.CONFIG_PATH || './config.json';
    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    try {
      if (fs.existsSync(this.configPath)) {
        const fileConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
        return deepMerge(DEFAULT_CONFIG, fileConfig);
      }
    } catch (e) {
      console.warn('⚠️ 配置文件載入失敗，使用預設值');
    }
    return DEFAULT_CONFIG;
  }

  get(): Config {
    return this.config;
  }

  getTelegram() {
    return this.config.telegram;
  }

  getBridge() {
    return this.config.bridge;
  }

  getSecurity() {
    return this.config.security;
  }

  getVSCode() {
    return this.config.vscode;
  }

  getLogging() {
    return this.config.logging;
  }

  reload() {
    this.config = this.loadConfig();
    console.log('✅ 配置已重新載入');
  }
}

export const config = new ConfigManager();
export type { Config };