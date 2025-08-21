import { useState, useRef, useEffect } from "react";
import "./ChatInterface.css";

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
  isStreaming = false 
}: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
          addMessage("這是一個模擬回應。請實現 onSendMessage 屬性來連接真實的 API。", "assistant");
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <h2>AI 助手</h2>
      </div>
      
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>開始對話吧！</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.role === "user" ? "message-user" : "message-assistant"}`}
            >
              <div className="message-content">
                <p>{message.content}</p>
                <span className="message-time">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))
        )}
        {(isLoading || isStreaming) && (
          <div className="message message-assistant">
            <div className="message-content">
              {isStreaming && currentAssistantMessage ? (
                <p>{currentAssistantMessage}</p>
              ) : (
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <div className="input-container">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="輸入您的訊息..."
            className="message-input"
            disabled={isLoading}
            rows={1}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading || isStreaming}
            className="send-button"
          >
            發送
          </button>
        </div>
      </div>
    </div>
  );
};