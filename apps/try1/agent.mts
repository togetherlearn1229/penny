import "dotenv/config";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

// 模型：使用 OpenAI GPT
const agentModel = new ChatOpenAI({
  temperature: 0,
  model: "gpt-4.1",
  //   apiKey: process.env.OPENAI_API_KEY,
});

// 記憶體：讓 agent 記住上下文
const agentCheckpointer = new MemorySaver();

// // 建立 ReAct 代理
const agent = createReactAgent({
  llm: agentModel,
  tools: [],
  checkpointSaver: agentCheckpointer,
});

// // 第一次提問
const agentFinalState = await agent.invoke(
  { messages: [new HumanMessage("請問我的爸爸是他的弟弟，我叫她要叫什麼?")] },
  { configurable: { thread_id: "42" } }
);

console.log(
  agentFinalState.messages[agentFinalState.messages.length - 1].content
);

// // 第二次提問（有上下文）
// const agentNextState = await agent.invoke(
//   { messages: [new HumanMessage("what about ny")] },
//   { configurable: { thread_id: "42" } }
// );

// console.log(
//   agentNextState.messages[agentNextState.messages.length - 1].content
// );
