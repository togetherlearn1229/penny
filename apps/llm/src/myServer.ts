// server.ts
import express from "express";
import cors from "cors";
import { app as graphApp, checkpointer, store } from "./agent_try1";
import { HumanMessage } from "@langchain/core/messages";
import { logger } from "./logger";
import { Command } from "@langchain/langgraph";

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
    const isInterrupt = Boolean(req.body?.isInterrupt ?? false);

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

    const inputs = [
      new HumanMessage({
        content: userText,
        // additional_kwargs: { test: 1111 },
      }),
    ];

    for await (const event of graphApp.streamEvents(
      isInterrupt
        ? new Command({ resume: userText })
        : { messages: inputs, chatHistory: inputs },
      {
        version: "v2",
        configurable: { thread_id: thread_id },
      }
    )) {
      const kind = event.event;
      logger.log(`****========== kind:${event}`, event);

      const isOnChainStream =
        kind === "on_chain_stream" && "__interrupt__" in event.data.chunk;

      // console.log(`${kind}: ${event.name}`);
      const isNotStreaming =
        kind === "on_chain_end" &&
        event.metadata.langgraph_node === "generateNotRelevantResponse" &&
        !event.tags?.includes("langsmith:hidden");

      if (
        (kind === "on_chat_model_stream" &&
          (event.metadata.langgraph_node === "generate" ||
            event.metadata.langgraph_node === "agent")) ||
        isNotStreaming ||
        isOnChainStream
      ) {
        console.log("event:", event);
        sse(res, kind, event);
      }
    }
  } catch (err: any) {
    console.log("err", err);
    sse(res, "error", { message: err?.message ?? String(err) });
  } finally {
    res.end();
  }
});

server.post("/connect", async (req, res) => {
  try {
    const thread_id = String(req.body?.thread_id ?? "");

    const org_id = String(req.body?.org_id ?? "org1");
    const user_id = String(req.body?.user_id ?? "user1");

    const readConfig = {
      version: "v2",
      configurable: { thread_id: thread_id },
    };

    store.put([org_id, user_id], [org_id, user_id].join("/"), {
      test: "調教penny",
      yes: "123",
    });

    const allCheckpoints = [];
    for await (const state of graphApp.getStateHistory(readConfig)) {
      allCheckpoints.push(state);
    }

    logger.log("allCheckpoints", allCheckpoints);

    return res.json(allCheckpoints);
  } catch (err: any) {
    console.log("err", err);
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
