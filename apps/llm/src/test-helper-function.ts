import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { logger } from "./logger";

// 模擬 getLatestHumanMessage 函數（從 agent_try1.ts 複製）
function getLatestHumanMessage(messages: any[]): string {
  // 從後往前找最新的 HumanMessage
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.getType() === "human") {
      return message.content as string;
    }
  }
  // 如果找不到 HumanMessage，回退到第一個訊息
  logger.warn("未找到 HumanMessage，回退到使用第一個訊息");
  return messages[0]?.content as string || "";
}

// 測試用例
function testGetLatestHumanMessage() {
  logger.log("=== 測試 getLatestHumanMessage 函數 ===");

  // 測試案例 1: 單一人類訊息
  const case1 = [new HumanMessage("第一個問題")];
  const result1 = getLatestHumanMessage(case1);
  logger.log("案例1結果:", result1);
  console.assert(result1 === "第一個問題", "案例1失敗");

  // 測試案例 2: 多個訊息，最新的是人類訊息
  const case2 = [
    new HumanMessage("第一個問題"),
    new AIMessage("AI回答"),
    new HumanMessage("第二個問題")
  ];
  const result2 = getLatestHumanMessage(case2);
  logger.log("案例2結果:", result2);
  console.assert(result2 === "第二個問題", "案例2失敗");

  // 測試案例 3: 複雜的多輪對話
  const case3 = [
    new HumanMessage("勞基法第五條是什麼？"),
    new AIMessage("AI正在思考..."),
    new ToolMessage("搜索結果...", "tool_call_id"),
    new AIMessage("勞基法第五條內容是..."),
    new HumanMessage("那第十條呢？"),
    new AIMessage("正在查詢第十條...")
  ];
  const result3 = getLatestHumanMessage(case3);
  logger.log("案例3結果:", result3);
  console.assert(result3 === "那第十條呢？", "案例3失敗");

  // 測試案例 4: 更複雜的對話
  const case4 = [
    new HumanMessage("勞基法第五條是什麼？"),
    new AIMessage("AI回答1"),
    new HumanMessage("那第十條呢？"), 
    new AIMessage("AI回答2"),
    new ToolMessage("工具調用結果", "tool_id"),
    new HumanMessage("加班費怎麼計算？"),
    new AIMessage("正在處理...")
  ];
  const result4 = getLatestHumanMessage(case4);
  logger.log("案例4結果:", result4);
  console.assert(result4 === "加班費怎麼計算？", "案例4失敗");

  logger.log("=== 所有測試案例通過！===");

  // 展示修復前後的差異
  logger.log("\n=== 修復前後對比 ===");
  logger.log("修復前 - 總是使用 messages[0]:", case4[0].content);
  logger.log("修復後 - 使用最新人類訊息:", result4);
}

// 執行測試
testGetLatestHumanMessage();

export { getLatestHumanMessage };