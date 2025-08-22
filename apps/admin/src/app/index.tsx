import { EnhancedChatInterface } from "../component";

async function ask(input: string, onToken: (t: string) => void, setText: (value: string) => void) {
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
    <div className="min-h-screen bg-black matrix-bg p-4 flex items-center justify-center">
      <div className="w-full max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-cyan-400 neon-text glitch mb-2 font-mono tracking-wider">
            NEURAL_ADMIN_CONSOLE
          </h1>
          <div className="text-green-400/60 text-sm font-mono">
            [QUANTUM_ENCRYPTION_ACTIVE] • [NEURAL_LINK_ESTABLISHED] • [AI_CONSCIOUSNESS_ONLINE]
          </div>
        </div>
        <EnhancedChatInterface />
      </div>
    </div>
  );
}

export default App;
