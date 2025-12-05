import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 5000; // ✅ Use Render's PORT
const RAG_API_URL = process.env.RAG_API_URL || "http://localhost:8000"; // ✅ Environment variable

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "Node.js server is running",
    timestamp: new Date().toISOString(),
    rag_url: RAG_API_URL,
  });
});

// Query endpoint - proxy to RAG server
app.post("/api/query", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({
        error: "Question is required",
        answer: "Please provide a question to get an answer.",
      });
    }

    // Forward request to RAG server
    const response = await axios.post(`${RAG_API_URL}/api/query`, {
      question: question,
    });

    // Return the response from RAG server
    res.json(response.data);
  } catch (error) {
    console.error("Error forwarding to RAG API:", error.message);

    if (error.response) {
      // RAG server responded with an error
      res.status(error.response.status).json({
        error: "Error from RAG API",
        answer:
          "Sorry, there was an error processing your question. Please try again.",
      });
    } else if (error.request) {
      // RAG server is not responding
      res.status(503).json({
        error: "RAG API unavailable",
        answer:
          "The AI service is currently unavailable. Please try again later.",
      });
    } else {
      // Other error
      res.status(500).json({
        error: "Internal server error",
        answer: "An unexpected error occurred. Please try again.",
      });
    }
  }
});

// Check RAG API health
app.get("/api/rag-health", async (req, res) => {
  try {
    const response = await axios.get(`${RAG_API_URL}/health`);
    res.json({
      status: "RAG API is connected",
      ragResponse: response.data,
    });
  } catch (error) {
    res.status(503).json({
      status: "RAG API is unavailable",
      error: error.message,
    });
  }
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Node.js server running on http://localhost:${PORT}`);
  console.log(`🔗 Proxying to RAG API at ${RAG_API_URL}`);
});
