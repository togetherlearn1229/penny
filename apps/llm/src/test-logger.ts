import { logger } from "./logger";

// 測試日誌功能
console.log("=== 測試日誌功能 ===");

logger.log("這是一個普通日誌訊息");
logger.info("這是一個信息訊息");
logger.warn("這是一個警告訊息");
logger.error("這是一個錯誤訊息");

// 測試物件記錄
logger.log("測試物件記錄:", { 
  user: "測試用戶", 
  action: "查詢", 
  timestamp: new Date() 
});

// 測試節點執行記錄
logger.nodeExecution("TEST_NODE", {
  messages: ["測試訊息1", "測試訊息2"],
  status: "success"
});

// 測試決策記錄
logger.decision("TEST_DECISION", "POSITIVE", "基於測試條件做出正面決策");

console.log(`\n日誌已寫入文件: ${logger.getLogFilePath()}`);
console.log("測試完成！");