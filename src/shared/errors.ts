// shared/errors.ts - 統一錯誤類別

export class VSCode2TelegramError extends Error {
  constructor(
    message: string,
    public code: string = 'UNKNOWN',
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'VSCode2TelegramError';
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details
    };
  }
}

export class AuthError extends VSCode2TelegramError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'AUTH_ERROR', 401, details);
    this.name = 'AuthError';
  }
}

export class RateLimitError extends VSCode2TelegramError {
  constructor(retryAfter: number) {
    super(`請求過於頻繁，請 ${retryAfter} 秒後再試`, 'RATE_LIMIT', 429, { retryAfter });
    this.name = 'RateLimitError';
  }
}

export class ExtensionError extends VSCode2TelegramError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'EXTENSION_ERROR', 503, details);
    this.name = 'ExtensionError';
  }
}

export class CommandError extends VSCode2TelegramError {
  constructor(message: string, command?: string) {
    super(message, 'COMMAND_ERROR', 400, { command });
    this.name = 'CommandError';
  }
}

export class ValidationError extends VSCode2TelegramError {
  constructor(message: string, field?: string) {
    super(message, 'VALIDATION_ERROR', 400, { field });
    this.name = 'ValidationError';
  }
}

// 錯誤處理裝飾器
export function errorHandler(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    try {
      return await originalMethod.apply(this, args);
    } catch (e: any) {
      if (e instanceof VSCode2TelegramError) {
        throw e;
      }
      throw new VSCode2TelegramError(
        e.message || '未知錯誤',
        'INTERNAL_ERROR',
        500,
        { originalError: e.message }
      );
    }
  };

  return descriptor;
}

// 全局錯誤監聽
export function setupGlobalErrorHandlers() {
  process.on('uncaughtException', (err) => {
    console.error('❌ 未捕獲的異常:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('❌ 未處理的 Promise 拒絕:', reason);
  });
}