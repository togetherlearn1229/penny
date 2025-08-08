import "dotenv/config";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

// Create client and connect to server
const client = new MultiServerMCPClient({
  // Global tool configuration options
  // Whether to throw on errors if a tool fails to load (optional, default: true)
  throwOnLoadError: true,
  // Whether to prefix tool names with the server name (optional, default: false)
  prefixToolNameWithServerName: false,
  // Optional additional prefix for tool names (optional, default: "")
  additionalToolNamePrefix: "",

  // Use standardized content block format in tool outputs
  useStandardContentBlocks: true,

  // Server configuration
  mcpServers: {
    // adds a STDIO connection to a server named "math"
    "MongoDB": {
      "command": "npx",
      "args": ["-y", "mongodb-mcp-server"],
      "env": {
        "MDB_MCP_CONNECTION_STRING": "mongodb+srv://togetherlearn1229:lRnBor9RiwnpjvdW@penny-dev.dlvcwmd.mongodb.net/penny-dev?retryWrites=true&w=majority"
      }
    }
  },
});

const tools = await client.getTools();

// Create an OpenAI model
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0,
});

// Create the React agent
const agent = createReactAgent({
  llm: model,
  tools,
});

// Run the agent
try {
  const res = await agent.invoke({
    messages: [{ role: "user", content: "列出所有penny-dev資料庫下的organizations表中所在城市位於南部的組織" }],
  });
  console.log(res);
} catch (error) {
  console.error("Error during agent execution:", error);
}

await client.close();