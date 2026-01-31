import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 5000;

// ❗ Must exist in Render ENV
const RAG_API_URL = process.env.RAG_API_URL;

if (!RAG_API_URL) {
  console.error(
    "❌ ERROR: RAG_API_URL is missing in Render Environment Variables"
  );
}

//
// ------------------ FIXED CORS ------------------
//
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = [
        "https://ums-live.vercel.app", // Production Vercel
        "http://localhost:3000", // Local frontend
      ];

      // Allow ALL Vercel preview URLs
      if (
        !origin ||
        allowed.includes(origin) ||
        origin.endsWith(".vercel.app")
      ) {
        callback(null, true);
      } else {
        console.log("❌ BLOCKED ORIGIN:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

//
// ------------------ Health check ---------------
//
app.get("/health", (req, res) => {
  res.json({
    status: "Node.js server is running",
    timestamp: new Date().toISOString(),
    rag_url: RAG_API_URL,
  });
});

//
// --------------- Proxy query → RAG server ------
//
app.post("/api/query", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({
        error: "Question is required",
        answer: "Please provide a question to get an answer.",
      });
    }

    // Forward to RAG
    const response = await axios.post(`${RAG_API_URL}/api/query`, {
      question: question,
    });

    res.json(response.data);
  } catch (error) {
    console.error("❌ Error forwarding to RAG API:", error.message);

    if (error.response) {
      res.status(error.response.status).json({
        error: "Error from RAG API",
        answer:
          "Sorry, there was an error processing your question. Please try again.",
      });
    } else if (error.request) {
      res.status(503).json({
        error: "RAG API unavailable",
        answer:
          "The AI service is currently unavailable. Please try again later.",
      });
    } else {
      res.status(500).json({
        error: "Internal server error",
        answer: "An unexpected error occurred. Please try again.",
      });
    }
  }
});

//
// ---------- Check RAG server health ------------
//
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

//
// ------------------ Start server ---------------
//
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  console.log(`🔗 Using RAG API: ${RAG_API_URL}`);
});
