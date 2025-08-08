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
    messages: [
      {
        role: "system",
        content:
          "在 penny-dev 資料庫中，有三個主要的集合：`bsrs`、`users` 和 organizations`。以下是這些集合的欄位結構及其關聯性分析：\n\n### 1. `bsrs 集合\n- 欄位:\n  - _id: ObjectId\n  - createdDate: Date\n  - score: Number\n  - patient: ObjectId (關聯到 users 集合)\n  - questions: Document (包含 Q1 到 Q6)\n  - user: ObjectId (關聯到 users 集合)\n  - organization: ObjectId (關聯到 organizations 集合)\n  - unassessable: Null\n  - __v: Number\n\n### 2. users 集合\n- 欄位:\n  - _id: ObjectId\n  - salt: String\n  - displayName: String\n  - provider: String\n  - organization: ObjectId (關聯到 organizations 集合)\n  - username: String\n  - created: Date\n  - roles: Array of Strings\n  - password: String\n  - enable: Boolean\n  - lastName: String\n  - firstName: String\n  - __v: Number\n  - sex: String\n  - birthday: Date\n  - employeeNumber: String\n  - lineStatus: Boolean\n  - staffStatus: String\n  - preference: Document (包含多個子欄位)\n  - jobTitle: String\n  - staffContPhone: String\n  - resignDate: Date or Null\n  - accountEnable: String\n  - passwordExpiredDate: Date\n  - passwordLastUpdateDate: Date\n  - notificationLastOpenedDate: Date\n  - employType: String\n  - jobType: String\n  - juboAdmin: Boolean\n  - classCertificationUpload: Array\n  - competencyCertification: Array\n  - employDate: Date\n  - holiday: Array\n  - idNumber: String\n  - nativeLanguage: Array\n  - offDay: Array\n  - paymentRule: Array\n  - religion: Array\n  - serviceLimit: Array\n  - traffic: Array\n  - OAuthService: Array of ObjectId\n  - ContactMobileNumber: String\n  - ContactPhoneNumber: String\n  - RelationshipWithContacts: String\n  - contactPersonName: String\n  - degree: String\n  - department: String\n  - education: String\n  - graduatedSchool: String\n  - mainTakeCarerAddress: String\n  - mainTakeCarerAddressArea: String\n  - mainTakeCarerAddressCity: String\n  - mobilePhone: String\n  - dbUpdatedDate: Date\n  - userGroup: ObjectId\n\n### 3. organizations 集合\n- 欄位:\n  - _id: ObjectId\n  - owner: ObjectId (關聯到 users 集合)\n  - name: String\n  - apps: Array of Strings\n  - type: String\n  - address: String\n  - tel: String\n  - __v: Number\n  - branch: Array of Strings\n  - preference: Document (包含多個子欄位)\n\n### 關聯分析\n- `bsrs` 集合:\n  - patient 和 user 欄位都關聯到 users 集合，表示每個 bsrs 文檔都與一個使用者相關聯。\n  - organization 欄位關聯到 organizations 集合，表示每個 bsrs 文檔都與一個組織相關聯。\n\n- `users` 集合:\n  - organization 欄位關聯到 organizations 集合，表示每個使用者都屬於一個組織。\n\n- `organizations` 集合:\n  - owner 欄位關聯到 users 集合，表示每個組織都有一個擁有者。\n\n### 總結\n這三個集合之間的關聯性顯示出一個清晰的結構：每個 bsrs 文檔都與一個使用者和一個組織相關聯，而每個使用者也屬於一個組織。這樣的設計有助於在資料庫中維護使用者、組織和相關評估的關聯性。",
      },
      {
        role: "user",
        content:
          "統計用戶職業類型 回傳我json格式",
      },
    ],
  });
  console.log(res);
} catch (error) {
  console.error("Error during agent execution:", error);
}

await client.close();