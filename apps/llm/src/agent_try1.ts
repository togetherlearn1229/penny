import "dotenv/config";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import {
  MemorySaver,
  Annotation,
  END,
  StateGraph,
  START,
  interrupt,
  Command,
} from "@langchain/langgraph";
import {
  HumanMessage,
  BaseMessage,
  AIMessage,
  AIMessageChunk,
  ChatMessage,
} from "@langchain/core/messages";
import { createReactAgent, ToolNode } from "@langchain/langgraph/prebuilt";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import { createRetrieverTool } from "langchain/tools/retriever";
import { pull } from "langchain/hub";
import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import readline from "node:readline";
import { logger } from "./logger";
import fs from "node:fs";
// import { InMemoryStore } from "@langchain/langgraph";
import { MongoClient } from "mongodb";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { InMemoryStore } from "./store/memory";

// 顯示日誌文件路徑
console.log(`日誌文件位置: ${logger.getLogFilePath()}`);

// 連上 PineconeStore 並將其作為 retriever
const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-large",
  dimensions: 1024,
});

const pinecone = new PineconeClient();

const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);

const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
  pineconeIndex,
  maxConcurrency: 5,
});

const retriever = vectorStore.asRetriever();

// 將 retriever 封裝為 tool
const tool = createRetrieverTool(retriever, {
  name: "labor_law_retriever",
  description: "Search and return information about 勞基法法條資訊",
});
const tools = [tool];

const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  userFeedback: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  chatHistory: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});

/**
 * 獲取最新的人類訊息內容
 * @param messages - 訊息數組
 * @returns 最新的人類訊息內容
 */
function getLatestHumanMessage(messages: BaseMessage[]): string {
  // 從後往前找最新的 HumanMessage
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.getType() === "human") {
      return message.content as string;
    }
  }
  // 如果找不到 HumanMessage，回退到第一個訊息
  logger.warn("未找到 HumanMessage，回退到使用第一個訊息");
  return (messages[0]?.content as string) || "";
}

const toolNode = new ToolNode<typeof GraphState.State>(tools);

// // 第二次提問（有上下文）
// const agentNextState = await agent.invoke(
//   { messages: [new HumanMessage("what about ny")] },
//   { configurable: { thread_id: "42" } }
// );

// console.log(
//   agentNextState.messages[agentNextState.messages.length - 1].content
// );

/**
 * Decides whether the agent should retrieve more information or end the process.
 * This function checks the last message in the state for a function call. If a tool call is
 * present, the process continues to retrieve information. Otherwise, it ends the process.
 * @param {typeof GraphState.State} state - The current state of the agent, including all messages.
 * @returns {string} - A decision to either "continue" the retrieval process or "end" it.
 */
function shouldRetrieve(state: typeof GraphState.State): string {
  const { messages } = state;
  logger.decision("DECIDE TO RETRIEVE", "檢查是否需要檢索", {
    messagesCount: messages.length,
    messages,
  });
  const lastMessage = messages[messages.length - 1];

  if (
    "tool_calls" in lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls.length
  ) {
    logger.decision("DECISION", "RETRIEVE", "需要檢索更多信息");
    return "retrieve";
  }
  // If there are no tool calls then we finish.
  return END;
}

/**
 * Determines whether the Agent should continue based on the relevance of retrieved documents.
 * This function checks if the last message in the conversation is of type FunctionMessage, indicating
 * that document retrieval has been performed. It then evaluates the relevance of these documents to the user's
 * initial question using a predefined model and output parser. If the documents are relevant, the conversation
 * is considered complete. Otherwise, the retrieval process is continued.
 * @param {typeof GraphState.State} state - The current state of the agent, including all messages.
 * @returns {Promise<Partial<typeof GraphState.State>>} - The updated state with the new message added to the list of messages.
 */
async function gradeDocuments(
  state: typeof GraphState.State
): Promise<Partial<typeof GraphState.State>> {
  const { messages } = state;
  logger.nodeExecution("GET RELEVANCE 開始評估文檔相關性", messages);
  const tool = {
    name: "give_relevance_score",
    description: "Give a relevance score to the retrieved documents.",
    schema: z.object({
      binaryScore: z.string().describe("Relevance score 'yes' or 'no'"),
    }),
  };

  const prompt = ChatPromptTemplate.fromTemplate(
    `You are a grader assessing relevance of retrieved docs to a user question.
  Here are the retrieved docs:
  \n ------- \n
  {context} 
  \n ------- \n
  Here is the user question: {question}
  If the content of the docs are relevant to the users question, score them as relevant.
  Give a binary score 'yes' or 'no' score to indicate whether the docs are relevant to the question.
  Yes: The docs are relevant to the question.
  No: The docs are not relevant to the question.`
  );

  const model = new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0,
  }).bindTools([tool], {
    tool_choice: tool.name,
  });

  const chain = prompt.pipe(model);

  const lastMessage = messages[messages.length - 1];

  const latestQuestion = getLatestHumanMessage(messages);
  logger.log("gradeDocuments 使用的問題:", latestQuestion);

  const score = await chain.invoke({
    question: latestQuestion,
    context: lastMessage.content as string,
  });
  logger.log(`相關性評分:`, { score, messages });
  return {
    messages: [score],
  };
}

/**
 * Check the relevance of the previous LLM tool call.
 *
 * @param {typeof GraphState.State} state - The current state of the agent, including all messages.
 * @returns {string} - A directive to either "yes" or "no" based on the relevance of the documents.
 */
function checkRelevance(state: typeof GraphState.State): string {
  const { messages } = state;
  logger.nodeExecution("CHECK RELEVANCE 檢查文檔相關性", messages);
  const lastMessage = messages[messages.length - 1];
  if (!("tool_calls" in lastMessage)) {
    throw new Error(
      "The 'checkRelevance' node requires the most recent message to contain tool calls."
    );
  }
  const toolCalls = (lastMessage as AIMessage).tool_calls;
  if (!toolCalls || !toolCalls.length) {
    throw new Error("Last message was not a function message");
  }

  if (toolCalls[0].args.binaryScore === "yes") {
    logger.decision("RELEVANCE", "DOCS RELEVANT", "文檔相關，繼續生成回答");
    return "yes";
  }

  logger.decision("RELEVANCE", "DOCS NOT RELEVANT", "文檔不相關，需要重寫查詢");
  return "no";
}

// Nodes

/**
 * 檢查用戶問題是否與勞基法相關
 * @param {typeof GraphState.State} state - The current state of the agent, including all messages.
 * @returns {Promise<Partial<typeof GraphState.State>>} - The updated state with the relevance check result
 */
async function checkLaborLawRelevance(
  state: typeof GraphState.State
): Promise<Partial<typeof GraphState.State>> {
  const { messages } = state;
  logger.nodeExecution("CHECK LABOR LAW RELEVANCE 檢查勞基法相關性", messages);

  const latestQuestion = getLatestHumanMessage(messages);
  logger.log("checkLaborLawRelevance 使用的問題:", latestQuestion);

  const prompt = ChatPromptTemplate.fromTemplate(
    `你是一個專門判斷問題是否與勞基法相關的專家。
    
    以下是用戶的問題:
    {question}
    
    請判斷這個問題是否與以下勞基法相關主題有關：
    - 工作時間與休息時間
    - 加班費與薪資
    - 請假制度（病假、特休、產假等）
    - 勞動契約與職場權益
    - 職場安全與健康
    - 解僱與離職
    - 其他勞工權益相關議題
    
    請嚴格按照以下格式回答（不要添加其他內容）：
    RELEVANT: [yes/no]
    REASON: [你的判斷理由]
    
    如果問題與勞基法相關，回答 yes；如果完全不相關（如：天氣、美食、娛樂、技術問題等），回答 no。`
  );

  const model = new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0,
  });

  const chain = prompt.pipe(model);
  const result = await chain.invoke({ question: latestQuestion });

  logger.log("勞基法相關性檢查結果:", result);

  return {
    messages: [result],
  };
}

/**
 * 檢查勞基法相關性檢查的結果
 * @param {typeof GraphState.State} state - The current state of the agent
 * @returns {string} - 返回 "relevant" 或 "not_relevant"
 */
function decideLaborLawRelevance(state: typeof GraphState.State): string {
  const { messages } = state;
  logger.nodeExecution("DECIDE LABOR LAW RELEVANCE 決定勞基法相關性", messages);

  const lastMessage = messages[messages.length - 1];
  const content = lastMessage.content as string;

  logger.log("勞基法相關性檢查的原始回應:", content);

  // 解析回應格式: RELEVANT: [yes/no] REASON: [理由]
  const relevantMatch = content.match(/RELEVANT:\s*(yes|no)/i);
  const reasonMatch = content.match(/REASON:\s*([\s\S]+)/i); // 使用 [\s\S] 匹配包括換行符的所有字符

  logger.log("解析結果:", {
    relevantMatch: relevantMatch?.[1],
    reasonMatch: reasonMatch?.[1],
  });

  if (!relevantMatch) {
    logger.error("無法解析勞基法相關性檢查結果，原始內容:", content);
    // 如果無法解析，嘗試使用關鍵字判斷
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes("yes") || lowerContent.includes("相關")) {
      logger.decision("LABOR LAW RELEVANCE", "RELEVANT", "關鍵字判斷：相關");
      return "relevant";
    } else if (
      lowerContent.includes("no") ||
      lowerContent.includes("不相關") ||
      lowerContent.includes("無關")
    ) {
      logger.decision(
        "LABOR LAW RELEVANCE",
        "NOT_RELEVANT",
        "關鍵字判斷：不相關"
      );
      return "not_relevant";
    }
    // 最後預設為相關，避免意外阻擋用戶
    logger.decision("LABOR LAW RELEVANCE", "RELEVANT", "無法判斷，預設為相關");
    return "relevant";
  }

  const isRelevant = relevantMatch[1].toLowerCase() === "yes";
  const reason = reasonMatch ? reasonMatch[1].trim() : "無法獲取判斷理由";

  if (isRelevant) {
    logger.decision(
      "LABOR LAW RELEVANCE",
      "RELEVANT",
      `問題與勞基法相關: ${reason}`
    );
    return "relevant";
  } else {
    logger.decision(
      "LABOR LAW RELEVANCE",
      "NOT_RELEVANT",
      `問題與勞基法不相關: ${reason}`
    );
    return "not_relevant";
  }
}

/**
 * 生成勞基法不相關的回應
 * @param {typeof GraphState.State} state - The current state of the agent
 * @returns {Promise<Partial<typeof GraphState.State>>} - 包含拒絕回應的更新狀態
 */
async function generateNotRelevantResponse(
  state: typeof GraphState.State
): Promise<Partial<typeof GraphState.State>> {
  const { messages } = state;
  logger.nodeExecution(
    "GENERATE NOT RELEVANT RESPONSE 生成非相關回應",
    messages
  );

  console.log("===== 正在生成非相關回應 =====");

  const res = new AIMessage({
    content: `
    我可以幫助您解答以下勞基法相關問題：
       • 工作時間與休息時間規定
       • 加班費計算與薪資問題
       • 各種請假制度（病假、特休、產假等）
       • 勞動契約與職場權益
       • 職場安全與健康
       • 解僱與離職相關規定
       • 其他勞工權益議題`,
  });

  return {
    messages: [res],
    chatHistory: [res],
  };
}

/**
 * Invokes the agent model to generate a response based on the current state.
 * This function calls the agent model to generate a response to the current conversation state.
 * The response is added to the state's messages.
 * @param {typeof GraphState.State} state - The current state of the agent, including all messages.
 * @returns {Promise<Partial<typeof GraphState.State>>} - The updated state with the new message added to the list of messages.
 */
async function agent(
  state: typeof GraphState.State
): Promise<Partial<typeof GraphState.State>> {
  const { messages } = state;
  logger.nodeExecution("CALL AGENT 調用主要代理", messages);
  // Find the AIMessage which contains the `give_relevance_score` tool call,
  // and remove it if it exists. This is because the agent does not need to know
  // the relevance score.
  const filteredMessages = messages.filter((message) => {
    if (
      "tool_calls" in message &&
      Array.isArray(message.tool_calls) &&
      message.tool_calls.length > 0
    ) {
      return message.tool_calls[0].name !== "give_relevance_score";
    }
    return true;
  });

  const model = new ChatOpenAI({
    model: "gpt-4.1",
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
    streaming: true,
  }).bindTools(tools);

  const response = await model.invoke(filteredMessages);

  return {
    messages: [response],
  };
}

const humanInterrupt = (state: typeof GraphState.State) => {
  logger.nodeExecution("HUMAN INTERRUPT 等待使用者輸入", state.messages);
  const feedback: string = interrupt({
    message: "請選擇是否接續執行",
    options: ["yes", "no"],
  });

  const interruptMessage = new AIMessage({
    content: JSON.stringify({
      message: "請選擇是否接續執行",
      options: ["yes", "no"],
    }),
  });

  const feedbackMessage = new HumanMessage({
    content: feedback,
  });

  if (feedback === "yes") {
    return new Command({
      goto: "checkLaborLawRelevance",
      update: {
        userFeedback: [feedback],
        chatHistory: [interruptMessage, feedbackMessage],
      },
    });
  } else {
    return new Command({
      goto: END,
      update: {
        userFeedback: [feedback],
        chatHistory: [interruptMessage, feedbackMessage],
      },
    });
  }

  // return { userFeedback: [feedback] };
};

/**
 * Transform the query to produce a better question.
 * @param {typeof GraphState.State} state - The current state of the agent, including all messages.
 * @returns {Promise<Partial<typeof GraphState.State>>} - The updated state with the new message added to the list of messages.
 */
async function rewrite(
  state: typeof GraphState.State
): Promise<Partial<typeof GraphState.State>> {
  const { messages } = state;
  logger.nodeExecution("TRANSFORM QUERY 重寫查詢以改善檢索", messages);
  const question = getLatestHumanMessage(messages);
  logger.log("rewrite 使用的問題:", question);
  const prompt = ChatPromptTemplate.fromTemplate(
    `Look at the input and try to reason about the underlying semantic intent / meaning. \n 
Here is the initial question:
\n ------- \n
{question} 
\n ------- \n
Formulate an improved question:`
  );

  // Grader
  const model = new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0,
    streaming: true,
  });

  const response = await prompt.pipe(model).invoke({ question });
  return {
    messages: [response],
  };
}

/**
 * Generate answer
 * @param {typeof GraphState.State} state - The current state of the agent, including all messages.
 * @returns {Promise<Partial<typeof GraphState.State>>} - The updated state with the new message added to the list of messages.
 */
async function generate(
  state: typeof GraphState.State
): Promise<Partial<typeof GraphState.State>> {
  const { messages } = state;
  logger.nodeExecution("GENERATE 生成最終回答", messages);
  const question = getLatestHumanMessage(messages);
  logger.log("generate 使用的問題:", question);
  // Extract the most recent ToolMessage
  const lastToolMessage = messages
    .slice()
    .reverse()
    .find((msg) => msg.getType() === "tool");
  if (!lastToolMessage) {
    throw new Error("No tool message found in the conversation history");
  }

  const docs = lastToolMessage.content as string;

  const prompt = await pull<ChatPromptTemplate>("rlm/rag-prompt");

  const llm = new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0,
    streaming: true,
  });

  const ragChain = prompt.pipe(llm);

  const response = await ragChain.invoke({
    context: docs,
    question,
  });

  return {
    messages: [response],
    chatHistory: [response],
  };
}

// Define the graph
const workflow = new StateGraph(GraphState)
  // Define the nodes which we'll cycle between.
  .addNode("humanInterrupt", humanInterrupt)
  .addNode("checkLaborLawRelevance", checkLaborLawRelevance)
  .addNode("generateNotRelevantResponse", generateNotRelevantResponse)
  .addNode("agent", agent)
  .addNode("retrieve", toolNode)
  .addNode("gradeDocuments", gradeDocuments)
  .addNode("rewrite", rewrite)
  .addNode("generate", generate);

// 從 START 開始先檢查勞基法相關性
workflow.addEdge(START, "humanInterrupt");
// workflow.addEdge(START, "checkLaborLawRelevance");

// 開始先檢查勞基法相關性 有這行上面command 流程會失效以這裡優先跑graph
// workflow.addEdge("humanInterrupt", "checkLaborLawRelevance");

// 根據勞基法相關性決定後續流程
workflow.addConditionalEdges(
  "checkLaborLawRelevance",
  // 評估問題是否與勞基法相關
  decideLaborLawRelevance,
  {
    // 如果相關，繼續到 agent 節點
    relevant: "agent",
    // 如果不相關，生成拒絕回應並結束
    not_relevant: "generateNotRelevantResponse",
  }
);

// 不相關的問題直接結束
workflow.addEdge("generateNotRelevantResponse", END);

// Decide whether to retrieve
workflow.addConditionalEdges(
  "agent",
  // Assess agent decision
  shouldRetrieve
);

workflow.addEdge("retrieve", "gradeDocuments");

// Edges taken after the `action` node is called.
workflow.addConditionalEdges(
  "gradeDocuments",
  // Assess agent decision
  checkRelevance,
  {
    // Call tool node
    yes: "generate",
    no: "rewrite", // placeholder
  }
);

workflow.addEdge("generate", END);
workflow.addEdge("rewrite", "agent");

// Compile
// const app = workflow.compile();

// const inputs = {
//   messages: [new HumanMessage("勞基法第五條是在說什麼內容?")],
// };
// let finalState;
// for await (const output of await app.stream(inputs)) {
//   for (const [key, value] of Object.entries(output)) {
//     const lastMsg = output[key].messages[output[key].messages.length - 1];
//     logger.nodeExecution(key, {
//       type: lastMsg._getType(),
//       content: lastMsg.content,
//       tool_calls: lastMsg.tool_calls,
//     });
//     finalState = value;
//   }
// }

// console.log(JSON.stringify(finalState, null, 2));

const writeConfig = {
  configurable: {
    thread_id: "1",
    checkpoint_ns: "",
  },
};
const readConfig = {
  configurable: {
    thread_id: "1",
  },
};

const client = new MongoClient(process.env.MDB_MCP_CONNECTION_STRING!);

export const checkpointer = new MongoDBSaver({ client });
// const checkpointer = new MemorySaver();

export const store = new InMemoryStore({ client });

export const app = workflow.compile({ checkpointer, store });

/** drawMermaidPng 好像有 bug 輸出的 png 多了很多條不知何存在的虛線 */
const getGraphPng = async () => {
  try {
    const drawableGraphGraphState = await app.getGraphAsync();
    const graphStateImage = await drawableGraphGraphState.drawMermaidPng({});
    const m = await drawableGraphGraphState.drawMermaid();
    console.log(m);
    const graphStateArrayBuffer = await graphStateImage.arrayBuffer();

    fs.writeFile(
      "graph.png",
      new Uint8Array(graphStateArrayBuffer),
      function (err) {
        if (err) console.log(err);
        else console.log("Write operation complete.");
      }
    );
  } catch (error) {
    console.error("Failed to display graph:", error);
  }
};

// getGraphPng();
const useGetGraphPng = async () => {
  const config = { configurable: { thread_id: "1" } };
  await app.invoke(
    {
      messages: [new HumanMessage({ content: "勞基法第五條是在說什麼內容?" })],
    },
    config
  );
  const state = await app.getState(config);
  console.log("--------------------------");
  logger.warn("state", state);

  const history = await app.getStateHistory(config);
  console.log("--------------------------");
  for await (const historyState of history) {
    logger.warn("history item", historyState);
  }
};

// useGetGraphPng();

// const inputs = [new HumanMessage({ content: "勞基法第五條是在說什麼內容?" })];

// for await (const event of app.streamEvents(
//   { messages: inputs },
//   { version: "v2", configurable: { thread_id: "THREAD_ID" } }
// )) {
//   const kind = event.event;
//   logger.log(`${kind}: ${event.name}`);
// }apps\llm\src\agent_try1.ts

// // 建一個共用 thread id（你也可以在 UI 端為每個聊天室生成一個）
// const THREAD_ID = "chat-1";

// async function runTurn(userText: string) {
//   const input = { messages: [new HumanMessage(userText)] };

//   // ★ 一回合一回合送進去；.stream 會把各節點輸出逐步吐出來
//   for await (const output of await app.stream(input, {
//     configurable: { thread_id: THREAD_ID },
//   })) {
//     for (const [node, state] of Object.entries(output)) {
//       const last = state.messages?.[state.messages.length - 1];
//       const type = last?.getType();
//       const content =
//         typeof last?.content === "string"
//           ? last?.content
//           : JSON.stringify(last?.content);
//       logger.nodeExecution(node, { type, content });
//     }
//   }
// }

// const rl = readline.createInterface({
//   input: process.stdin,
//   output: process.stdout,
//   prompt: "> ",
// });
// logger.log("已啟動互動模式，輸入問題按 Enter：");
// rl.prompt();
// rl.on("line", async (line) => {
//   const text = line.trim();
//   if (!text) return rl.prompt();
//   try {
//     await runTurn(text);
//   } catch (e) {
//     logger.error("執行錯誤：", e);
//   }
//   rl.prompt();
// });
