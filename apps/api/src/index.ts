import { createServer } from "./server.js";
import { connectDatabase } from "./lib/database.js";
import { log } from "console";

const port = process.env.PORT || 5001;
const server = createServer();

async function startServer() {
  await connectDatabase();
  
  server.listen(port, () => {
    log(`api running on ${port}`);
  });
}

startServer().catch((error) => {
  log("Failed to start server:", error);
  process.exit(1);
});
