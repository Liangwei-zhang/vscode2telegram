// bridge/health-check.ts - 健康檢查
import { BridgeServer } from './ws-server.js';
import { SessionManager } from './session-manager.js';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  components: {
    bridge: ComponentHealth;
    session: ComponentHealth;
    telegram: ComponentHealth;
  };
  metrics: {
    totalRequests: number;
    activeConnections: number;
    activeSessions: number;
  };
}

interface ComponentHealth {
  status: 'ok' | 'warning' | 'error';
  message?: string;
  lastCheck: string;
}

class HealthCheck {
  private startTime = Date.now();
  private requestCount = 0;

  constructor(
    private bridgeServer: BridgeServer,
    private sessionManager: SessionManager
  ) {}

  recordRequest() {
    this.requestCount++;
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }

  check(): HealthStatus {
    const bridgeStatus = this.checkBridge();
    const sessionStatus = this.checkSession();
    const telegramStatus = this.checkTelegram();

    // 計算整體狀態
    const statuses = [bridgeStatus, sessionStatus, telegramStatus].map(s => s.status);
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    
    if (statuses.includes('error')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('warning')) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
      components: {
        bridge: bridgeStatus,
        session: sessionStatus,
        telegram: telegramStatus
      },
      metrics: {
        totalRequests: this.requestCount,
        activeConnections: this.bridgeServer.getStatus().connected ? 1 : 0,
        activeSessions: this.sessionManager.getAllSessions().length
      }
    };
  }

  private checkBridge(): ComponentHealth {
    try {
      const status = this.bridgeServer.getStatus();
      return {
        status: status.connected ? 'ok' : 'warning',
        message: status.connected ? 'Extension connected' : 'Extension not connected',
        lastCheck: new Date().toISOString()
      };
    } catch (e) {
      return {
        status: 'error',
        message: String(e),
        lastCheck: new Date().toISOString()
      };
    }
  }

  private checkSession(): ComponentHealth {
    try {
      const sessions = this.sessionManager.getAllSessions();
      return {
        status: 'ok',
        message: `${sessions.length} active sessions`,
        lastCheck: new Date().toISOString()
      };
    } catch (e) {
      return {
        status: 'error',
        message: String(e),
        lastCheck: new Date().toISOString()
      };
    }
  }

  private checkTelegram(): ComponentHealth {
    // Telegram 連接狀態通過 Bot 本身監控
    return {
      status: 'ok',
      lastCheck: new Date().toISOString()
    };
  }

  reset() {
    this.startTime = Date.now();
    this.requestCount = 0;
  }
}

export { HealthCheck, type HealthStatus, type ComponentHealth };