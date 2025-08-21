// server.ts
import express from "express";
import cors from "cors";
import { app as graphApp } from "./agent_try1";
import { HumanMessage, BaseMessage } from "@langchain/core/messages";
import { threadId } from "node:worker_threads";

const server = express();
server.use(cors());
server.use(express.json());

// SSE helper：把 JSON 事件用 SSE 格式送出
function sse(res: express.Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

server.post("/api/agent/stream", async (req, res) => {
  // SSE headers
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.(); // 部分框架需要這個才能立刻送出 header

  const controller = new AbortController();
  req.on("close", () => controller.abort());

  try {
    const userText = String(req.body?.input ?? "");
    const thread_id = String(req.body?.thread_id ?? "");

    // const input = {
    //   messages: [new HumanMessage({ content: userText })],
    // };
    // console.log("input", input);

    // const output = await graphApp.invoke(
    //   {
    //     messages: [new HumanMessage("請問勞基法第11條的內容?")],
    //   },
    //   { configurable: { thread_id: "test" } }
    // );

    // console.log("output", output);

    const inputs = [new HumanMessage({ content: userText })];

    for await (const event of graphApp.streamEvents(
      { messages: inputs },
      { version: "v2", configurable: { thread_id: thread_id } }
    )) {
      const kind = event.event;
      console.log('kind: ', kind); 
      // console.log(`${kind}: ${event.name}`);
      if (kind === "on_chat_model_stream") {
        sse(res, kind, event);
      }
    }

    // // 串 LangGraph 事件（v2 事件模型最穩）
    // for await (const ev of graphApp.streamEvents(input, {
    //   version: "v2",
    //   signal: controller.signal,
    //   configurable: { thread_id: "test" },
    // })) {
    //   // for (const [node, state] of Object.entries(output)) {
    //   //   const last = state.messages?.[state.messages.length - 1];
    //   //   const type = last?.getType();
    //   //   const content =
    //   //     typeof last?.content === "string"
    //   //       ? last?.content
    //   //       : JSON.stringify(last?.content);
    //   //   console.log(`\n[node:${node}] (${type})\n${content}\n`);
    //   //   sse(res, `\n[node:${node}] (${type})`, `\n${content}\n`);
    //   // }

    //   // console.log("ev", ev);
    //   // console.log("ev.event", ev.event);

    //   // // 你可以：原封不動丟所有事件
    //   sse(res, ev.event, ev);

    //   // // 或是只挑「對前端有用」的事件精簡後丟出
    //   // // 1) 新增的訊息（多半是 AI/工具/系統訊息）
    //   // if (ev.event === "messages/created") {
    //   //   sse(res, "message", ev.data);
    //   // }

    //   // // 2) token 級別的模型輸出（LangChain LLM 流）
    //   // if (ev.event === "on_chat_model_stream") {
    //   //   // ev.data.chunk?.content 可能是一段 token/文字塊
    //   //   sse(res, "token", { chunk: ev.data?.chunk?.content ?? "" });
    //   // }

    //   // // 3) 工具呼叫與結果
    //   // if (ev.event === "tool/start") sse(res, "tool_start", ev.data);
    //   // if (ev.event === "tool/end") sse(res, "tool_end", ev.data);

    //   // // 4) 結束訊號（可選）
    //   // if (ev.event === "end") sse(res, "end", {});
    // }
  } catch (err: any) {
    console.log("err", err);
    sse(res, "error", { message: err?.message ?? String(err) });
  } finally {
    res.end();
  }
});

// 心跳（避免中間代理切線，選用）
server.get("/api/agent/health", (_, res) => res.status(200).send("ok"));

server.listen(3001, () => {
  console.log("SSE server on http://localhost:3001");
  console.log("SSE server on   ");
});
