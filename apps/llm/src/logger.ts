import fs from 'fs';
import path from 'path';

class Logger {
  private logFilePath: string;

  constructor(logFileName: string = 'agent.log') {
    // 在 logs 目錄下創建日誌文件
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // 使用時間戳創建唯一的日誌文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fileName = `${timestamp}_${logFileName}`;
    this.logFilePath = path.join(logsDir, fileName);
    
    // 初始化日誌文件
    this.writeToFile(`=== 日誌開始 ${new Date().toISOString()} ===\n`);
  }

  private writeToFile(message: string): void {
    try {
      fs.appendFileSync(this.logFilePath, message);
    } catch (error) {
      console.error('寫入日誌文件失敗:', error);
    }
  }

  private formatMessage(level: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    return `[${timestamp}] [${level}] ${message}\n`;
  }

  log(...args: any[]): void {
    // 同時輸出到控制台和文件
    console.log(...args);
    const logMessage = this.formatMessage('LOG', ...args);
    this.writeToFile(logMessage);
  }

  error(...args: any[]): void {
    console.error(...args);
    const logMessage = this.formatMessage('ERROR', ...args);
    this.writeToFile(logMessage);
  }

  warn(...args: any[]): void {
    console.warn(...args);
    const logMessage = this.formatMessage('WARN', ...args);
    this.writeToFile(logMessage);
  }

  info(...args: any[]): void {
    console.info(...args);
    const logMessage = this.formatMessage('INFO', ...args);
    this.writeToFile(logMessage);
  }

  debug(...args: any[]): void {
    console.debug(...args);
    const logMessage = this.formatMessage('DEBUG', ...args);
    this.writeToFile(logMessage);
  }

  // 添加一個方法來記錄節點執行狀態
  nodeExecution(nodeName: string, state: any): void {
    const message = `執行節點: ${nodeName}`;
    console.log(message, state);
    const logMessage = this.formatMessage('NODE', message, state);
    this.writeToFile(logMessage);
  }

  // 記錄決策過程
  decision(decisionType: string, result: string, context?: any): void {
    const message = `決策: ${decisionType} -> ${result}`;
    console.log(message, context || '');
    const logMessage = this.formatMessage('DECISION', message, context || '');
    this.writeToFile(logMessage);
  }

  // 獲取日誌文件路徑
  getLogFilePath(): string {
    return this.logFilePath;
  }
}

// 創建單例實例
export const logger = new Logger('agent_try1.log');

// 為了向後兼容，也可以直接導出 log 函數
export const log = logger.log.bind(logger);
export const logError = logger.error.bind(logger);
export const logWarn = logger.warn.bind(logger);
export const logInfo = logger.info.bind(logger);
export const logDebug = logger.debug.bind(logger);