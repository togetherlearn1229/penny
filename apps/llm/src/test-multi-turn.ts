import { app } from "./agent_try1";
import { HumanMessage } from "@langchain/core/messages";
import { logger } from "./logger";

async function testMultiTurnConversation() {
  const THREAD_ID = "test-multi-turn-" + Date.now();
  logger.log("=== 開始多輪對話測試 ===");
  logger.log("Thread ID:", THREAD_ID);

  // 第一輪對話
  logger.log("\n--- 第一輪對話 ---");
  const firstInput = { messages: [new HumanMessage("勞基法第五條是什麼內容？")] };
  
  for await (const output of await app.stream(firstInput, {
    configurable: { thread_id: THREAD_ID },
  })) {
    for (const [node, state] of Object.entries(output)) {
      const last = state.messages?.[state.messages.length - 1];
      const type = last?.getType();
      const content = typeof last?.content === "string" 
        ? last?.content.slice(0, 200) + (last?.content.length > 200 ? "..." : "")
        : JSON.stringify(last?.content)?.slice(0, 200);
      logger.log(`[第一輪][${node}] (${type}) ${content}`);
    }
  }

  // 等待一下
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 第二輪對話 - 應該能正確識別這個新問題
  logger.log("\n--- 第二輪對話 ---");
  const secondInput = { messages: [new HumanMessage("那第十條呢？")] };
  
  for await (const output of await app.stream(secondInput, {
    configurable: { thread_id: THREAD_ID },
  })) {
    for (const [node, state] of Object.entries(output)) {
      const last = state.messages?.[state.messages.length - 1];
      const type = last?.getType();
      const content = typeof last?.content === "string" 
        ? last?.content.slice(0, 200) + (last?.content.length > 200 ? "..." : "")
        : JSON.stringify(last?.content)?.slice(0, 200);
      logger.log(`[第二輪][${node}] (${type}) ${content}`);
    }
  }

  // 等待一下
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 第三輪對話 - 測試更複雜的問題
  logger.log("\n--- 第三輪對話 ---");
  const thirdInput = { messages: [new HumanMessage("加班費怎麼計算？")] };
  
  for await (const output of await app.stream(thirdInput, {
    configurable: { thread_id: THREAD_ID },
  })) {
    for (const [node, state] of Object.entries(output)) {
      const last = state.messages?.[state.messages.length - 1];
      const type = last?.getType();
      const content = typeof last?.content === "string" 
        ? last?.content.slice(0, 200) + (last?.content.length > 200 ? "..." : "")
        : JSON.stringify(last?.content)?.slice(0, 200);
      logger.log(`[第三輪][${node}] (${type}) ${content}`);
    }
  }

  logger.log("\n=== 多輪對話測試完成 ===");
}

// 執行測試
testMultiTurnConversation().catch(error => {
  logger.error("多輪對話測試失敗:", error);
  process.exit(1);
});