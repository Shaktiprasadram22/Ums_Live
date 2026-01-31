import React, { useState, useEffect, useRef } from "react";
import { Send, MessageCircle, Bot, User } from "lucide-react";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";

// ✅ API URL from environment variables
const API_BASE_URL = (process.env.REACT_APP_API_URL || "http://localhost:8000")
  .trim()
  .replace(/\/+$/, "");

console.log("🔗 API Base URL:", API_BASE_URL); // Debug log

const initialMessages = [
  {
    id: 1,
    text: "Hello! I'm your UMS Chatbot assistant. I can help you with course registration, prerequisites, schedules, and other university-related questions. What would you like to know?",
    sender: "bot",
    timestamp: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  },
];

function App() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    checkServerConnection();
    // Check connection every 30 seconds
    const interval = setInterval(checkServerConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkServerConnection = async () => {
    try {
      console.log("🔍 Checking server connection...");
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Server connected:", data);
        setIsConnected(true);
      } else {
        console.warn("⚠️ Server responded with error:", response.status);
        setIsConnected(false);
      }
    } catch (error) {
      console.warn("❌ Server connection failed:", error?.message || error);
      setIsConnected(false);
    }
  };

  const sendMessageToRAG = async (question) => {
    try {
      console.log(`📤 Sending to: ${API_BASE_URL}/api/query`);
      console.log("📝 Question:", question);

      const response = await fetch(`${API_BASE_URL}/api/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ HTTP ${response.status}:`, errorText);
        throw new Error(`Server error (${response.status})`);
      }

      const data = await response.json();
      console.log("✅ Received response:", data);

      return (
        data.answer ||
        "Sorry, I couldn't process your question. Please try again."
      );
    } catch (error) {
      console.error("❌ Error querying RAG:", error);

      // More helpful error messages
      if (error.message.includes("Failed to fetch")) {
        return "🔴 Cannot connect to the server. Please make sure the RAG server is running on port 8000.";
      } else if (error.message.includes("Server error")) {
        return "⚠️ The server encountered an error. Please try again.";
      }

      return `Error: ${error.message}`;
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userMessage = {
      id: messages.length + 1,
      text: message,
      sender: "student",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentMessage = message;
    setMessage("");
    setIsLoading(true);

    // Get response from RAG
    const botResponse = await sendMessageToRAG(currentMessage);

    const botMessage = {
      id: messages.length + 2,
      text: botResponse,
      sender: "bot",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, botMessage]);
    setIsLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white flex flex-col">
      <header className="bg-white shadow-sm border-b border-orange-100 p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-full">
            <MessageCircle className="h-6 w-6 text-orange-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">UMS Chatbot</h1>
          <div className="ml-auto">
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  isConnected ? "bg-green-500" : "bg-red-500"
                }`}
              ></div>
              <span className="text-sm text-gray-600">
                {isConnected ? "Online" : "Offline"}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender === "student" ? "justify-end" : "justify-start"
                } items-end gap-2`}
              >
                {msg.sender === "bot" && (
                  <div className="p-1 bg-orange-100 rounded-full mb-2">
                    <Bot className="h-4 w-4 text-orange-600" />
                  </div>
                )}
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm ${
                    msg.sender === "student"
                      ? "bg-orange-500 text-white rounded-br-md"
                      : "bg-white text-gray-800 rounded-bl-md border border-gray-200"
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-line">
                    {msg.text}
                  </p>
                  <p
                    className={`text-xs mt-2 ${
                      msg.sender === "student"
                        ? "text-orange-100"
                        : "text-gray-500"
                    }`}
                  >
                    {msg.timestamp}
                  </p>
                </div>
                {msg.sender === "student" && (
                  <div className="p-1 bg-blue-100 rounded-full mb-2">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start items-end gap-2">
                <div className="p-1 bg-orange-100 rounded-full mb-2">
                  <Bot className="h-4 w-4 text-orange-600" />
                </div>
                <div className="bg-white text-gray-800 rounded-2xl rounded-bl-md border border-gray-200 px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                    <span className="text-xs text-gray-500">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      <div className="bg-white border-t border-orange-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <TextField
                variant="outlined"
                size="small"
                fullWidth
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me about courses, prerequisites, schedules..."
                disabled={isLoading}
                InputProps={{
                  sx: { borderRadius: "1rem", backgroundColor: "#fafafa" },
                }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    paddingRight: "8px",
                  },
                }}
              />
            </div>
            <Button
              variant="contained"
              color="warning"
              size="large"
              onClick={handleSendMessage}
              disabled={!message.trim() || isLoading}
              sx={{
                borderRadius: "1rem",
                height: "48px",
                minWidth: "48px",
                padding: 0,
                boxShadow: "none",
                "&:hover": {
                  backgroundColor: "#ea580c",
                },
              }}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Press Enter to send • UMS Chatbot v1.0 •{" "}
            {isConnected ? "Connected to Server" : "Disconnected"}
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
