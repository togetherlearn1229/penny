import { useState, useRef, useEffect } from "react";

// const thread_id = new Date().getTime().toString();
export const thread_id = "2";
console.log("thread_id: ", thread_id);

export interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
}

interface ChatInterfaceProps {
  onSendMessage?: (message: string) => Promise<void>;
  currentAssistantMessage?: string;
  isStreaming?: boolean;
}

export const ChatInterface = ({
  onSendMessage,
  currentAssistantMessage = "",
  isStreaming = false,
}: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    async function connect(): Promise<void> {
      const resp = await fetch("http://localhost:3001/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id }),
      }).then((res) => res.json());

      console.log(resp);

      const data = resp?.[0].values.chatHistory.map(
        ({ kwargs: { content }, id }: any) => ({
          content,
          role: id[2] === "HumanMessage" ? "user" : "assistant",
          timestamp: new Date(),
        })
      );

      console.log(data);

      setMessages(data);
    }
    connect();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 自動調整 textarea 高度
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "44px"; // 重置為最小高度
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 100; // 最大高度 100px
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue]);

  const addMessage = (content: string, role: "user" | "assistant") => {
    const newMessage: Message = {
      id: Date.now().toString(),
      content,
      role,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || isStreaming) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    addMessage(userMessage, "user");

    try {
      if (onSendMessage) {
        await onSendMessage(userMessage);
      } else {
        // 預設的模擬回應
        setTimeout(() => {
          addMessage(
            "這是一個模擬回應。請實現 onSendMessage 屬性來連接真實的 API。",
            "assistant"
          );
        }, 1000);
      }
    } catch (error) {
      addMessage("發生錯誤，請稍後再試。", "assistant");
    } finally {
      setIsLoading(false);
    }
  };

  // 當串流完成時，將當前助手訊息添加到歷史記錄
  useEffect(() => {
    if (!isStreaming && currentAssistantMessage && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "user") {
        addMessage(currentAssistantMessage, "assistant");
      }
    }
  }, [isStreaming, currentAssistantMessage]);

  return (
    <div className="cyber-border min-h-[600px] max-w-4xl mx-auto overflow-hidden">
      <div className="bg-black p-6 flex flex-col h-[598px]">
        <div className="bg-gradient-to-r from-cyan-500/20 to-pink-500/20 p-4 text-center border-b border-cyan-400/30">
          <h2 className="text-cyan-400 font-bold text-xl neon-text glitch tracking-wider">
            {">"} AI_NEURAL_INTERFACE_v2.1 {"<"}
          </h2>
          <div className="text-xs text-green-400/60 mt-1 font-mono">
            [STATUS: ONLINE] [ENCRYPTION: AES-256] [NEURAL_LINK: ACTIVE]
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 matrix-bg bg-black/90 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-cyan-400 text-lg neon-text mb-2">
                  {">>>"} NEURAL_INTERFACE_READY {"<<<"}
                </div>
                <div className="text-green-400/70 text-sm font-mono">
                  Establishing connection to AI consciousness...
                </div>
                <div className="flex justify-center mt-4">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-150"></div>
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse delay-300"></div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`mb-6 flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] ${message.role === "user" ? "order-1" : "order-2"}`}
                >
                  <div
                    className={`p-4 rounded-lg border ${
                      message.role === "user"
                        ? "bg-gradient-to-r from-pink-900/50 to-purple-900/50 border-pink-400/30 text-pink-100"
                        : "bg-gradient-to-r from-green-900/30 to-cyan-900/30 border-cyan-400/30 text-cyan-100"
                    } shadow-lg neon-glow`}
                  >
                    <div
                      className={`text-xs font-mono mb-2 opacity-60 ${
                        message.role === "user"
                          ? "text-pink-300"
                          : "text-cyan-300"
                      }`}
                    >
                      {message.role === "user"
                        ? "[USER_INPUT]"
                        : "[AI_RESPONSE]"}
                    </div>
                    <p className="font-mono leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </p>
                    <span
                      className={`text-xs opacity-50 block mt-2 font-mono ${
                        message.role === "user"
                          ? "text-pink-300"
                          : "text-cyan-300"
                      }`}
                    >
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
          {(isLoading || isStreaming) && (
            <div className="mb-6 flex justify-start">
              <div className="max-w-[80%]">
                <div className="p-4 rounded-lg border bg-gradient-to-r from-green-900/30 to-cyan-900/30 border-cyan-400/30 text-cyan-100 shadow-lg neon-glow">
                  <div className="text-xs font-mono mb-2 opacity-60 text-cyan-300">
                    [AI_PROCESSING...]
                  </div>
                  {isStreaming && currentAssistantMessage ? (
                    <p className="font-mono leading-relaxed whitespace-pre-wrap">
                      {currentAssistantMessage}
                    </p>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className="text-cyan-400 font-mono">Thinking</span>
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce typing-animation"></div>
                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce typing-animation delay-150"></div>
                        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce typing-animation delay-300"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-cyan-400/30 bg-gradient-to-r from-black to-gray-900 p-4">
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="[輸入神經指令...]"
                className="w-full bg-black/80 border border-green-400/30 rounded-lg px-4 py-3 pr-20 text-green-400 placeholder-green-400/50 font-mono text-sm resize-none focus:outline-none focus:border-cyan-400 focus:shadow-lg focus:shadow-cyan-400/20 neon-glow overflow-y-hidden"
                disabled={isLoading}
                rows={1}
                style={{ minHeight: "44px", maxHeight: "100px" }}
              />
              <div className="absolute inset-y-0 right-2 flex items-center text-xs text-green-400/40 font-mono">
                {isLoading ? "[PROCESSING]" : "[READY]"}
              </div>
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading || isStreaming}
              className="bg-gradient-to-r from-cyan-600 to-pink-600 hover:from-cyan-500 hover:to-pink-500 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold px-6 rounded-lg font-mono text-sm transition-all duration-200 neon-glow disabled:opacity-50 disabled:cursor-not-allowed h-[44px] flex items-center justify-center"
            >
              {isLoading ? "..." : "SEND"}
            </button>
          </div>
          <div className="mt-2 text-xs text-green-400/40 font-mono text-center">
            Press [ENTER] to transmit • [SHIFT+ENTER] for new line
          </div>
        </div>
      </div>
    </div>
  );
};
