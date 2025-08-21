import "./styles.css";
import { CounterButton } from "@repo/ui/counter-button";
import { Link } from "@repo/ui/link";
import { useState } from "react";
import { EnhancedChatInterface } from "../component";

async function ask(input: string, onToken: (t: string) => void, setText) {
  const resp = await fetch("http://localhost:3001/api/agent/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });
  const reader = resp.body!.getReader();
  const td = new TextDecoder();
  let buf = "";

  while (true) {
    const { value, done } = await reader.read();

    // console.log("value", value);

    if (done) break;
    buf += td.decode(value, { stream: true });
    const chunks = buf.split("\n\n"); // SSE frame

    buf = chunks.pop() ?? "";
    for (const c of chunks) {
      const event = c
        .split("\n")
        .find((l) => l.startsWith("event:"))
        ?.slice(6)
        .trim();
      const dataL = c
        .split("\n")
        .find((l) => l.startsWith("data:"))
        ?.slice(5);
      if (!dataL) continue;
      const data = JSON.parse(dataL);
      // console.log("Received event:", event, data);
      console.log("data", data);
      setText((t: string) => (t += data.data.chunk.kwargs.content));

      if (event === "token" && data.chunk) {
        onToken(data.chunk);
      } else if (event === "error") {
        // console.error("Backend error:", data);
        setText(`Error: ${data.message}`);
      }
    }
    // console.log("buf", buf);
  }
}

function App() {
  // const [text, setText] = useState<string>("");
  return (
    <div className="container">
      <EnhancedChatInterface />
      {/* <h1 className="title">
        Admin <br />
        <span>Kitchen Sink</span>
      </h1>
      <CounterButton />
      <p className="description">
        Built With{" "}
        <Link href="https://turborepo.com" newTab>
          Turborepo
        </Link>
        {" & "}
        <Link href="https://vitejs.dev/" newTab>
          Vite
        </Link> */}
      {/* <button
          type="button"
          onClick={() => {
            ask("請問勞基法第11條的內容?", () => {}, setText);
          }}
        >
          try
        </button>
        <p>{text}</p> */}
      {/* </p> */}
    </div>
  );
}

export default App;
