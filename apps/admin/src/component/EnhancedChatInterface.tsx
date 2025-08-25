import { useState } from "react";
import { ChatInterface, Message } from "./ChatInterface";


const thread_id = new Date().getTime().toString();
console.log('thread_id: ', thread_id);
async function streamMessage(
  input: string,
  onToken: (token: string) => void
): Promise<void> {
  const resp = await fetch("http://localhost:3001/api/agent/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input, thread_id }),
  });

  if (!resp.body) {
    throw new Error("No response body");
  }

  const reader = resp.body.getReader();
  const td = new TextDecoder();
  let buf = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) break;
    
    buf += td.decode(value, { stream: true });
    const chunks = buf.split("\n\n");

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
      
      try {
        const data = JSON.parse(dataL);
        
        if (event === 'on_chat_model_stream') {
          onToken(data.data.chunk.kwargs.content);
        } else if (data.metadata.langgraph_node === "generateNotRelevantResponse") {
          onToken(data.data.output.messages[0].kwargs.content);
        } else if (event === "error") {
          throw new Error(data.message || "Backend error");
        }
      } catch (parseError) {
        console.error("Failed to parse data:", parseError);
      }
    }
  }
}

export const EnhancedChatInterface = () => {
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const handleSendMessage = async (message: string): Promise<void> => {
    setIsStreaming(true);
    setCurrentAssistantMessage("");

    try {
      await streamMessage(message, (token: string) => {
        setCurrentAssistantMessage(prev => prev + token);
      });
    } catch (error) {
      setCurrentAssistantMessage("抱歉，發生了錯誤：" + (error as Error).message);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div>
      <ChatInterface 
        onSendMessage={handleSendMessage}
        currentAssistantMessage={currentAssistantMessage}
        isStreaming={isStreaming}
      />
    </div>
  );
};