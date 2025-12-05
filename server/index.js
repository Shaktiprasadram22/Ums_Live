import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 5000;

// ❗ Must exist in Render ENV
const RAG_API_URL = process.env.RAG_API_URL;

if (!RAG_API_URL) {
  console.error(
    "❌ CRITICAL ERROR: RAG_API_URL is missing in Environment Variables"
  );
  console.error("Please set RAG_API_URL in Render dashboard or .env file");
  console.error("Example: RAG_API_URL=https://ums-rag-server.onrender.com");
}

//
// ------------------ CORS CONFIGURATION ------------------
//
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = [
        "https://ums-live.vercel.app", // Production Vercel
        "http://localhost:3000", // Local frontend
      ];

      // Allow ALL Vercel preview URLs + no origin (for tools like Postman)
      if (
        !origin ||
        allowed.includes(origin) ||
        (origin && origin.endsWith(".vercel.app"))
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

// ✅ Body parsing middleware (MUST come before routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n📥 [${timestamp}] ${req.method} ${req.path}`);
  console.log(`   Origin: ${req.get("origin") || "No origin"}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`   Body:`, JSON.stringify(req.body));
  }
  next();
});

//
// ------------------ ROOT ROUTE ------------------
//
app.get("/", (req, res) => {
  res.json({
    message: "UMS Chatbot Backend Server",
    status: "running",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "GET /health",
      query: "POST /api/query",
      ragHealth: "GET /api/rag-health",
    },
  });
});

//
// ------------------ HEALTH CHECK ------------------
//
app.get("/health", (req, res) => {
  console.log("✅ Health check requested");
  res.json({
    status: "healthy",
    service: "UMS Backend Server",
    timestamp: new Date().toISOString(),
    rag_url: RAG_API_URL || "NOT CONFIGURED",
    environment: process.env.NODE_ENV || "development",
  });
});

//
// ------------------ PROXY QUERY TO RAG SERVER ------------------
//
app.post("/api/query", async (req, res) => {
  console.log("🔍 Query request received");

  try {
    const { question } = req.body;

    // Validate question
    if (!question || typeof question !== "string" || !question.trim()) {
      console.log("❌ Invalid or missing question");
      return res.status(400).json({
        error: "Question is required",
        answer: "Please provide a valid question to get an answer.",
      });
    }

    // Check if RAG_API_URL is configured
    if (!RAG_API_URL) {
      console.error("❌ RAG_API_URL not configured");
      return res.status(500).json({
        error: "Server configuration error",
        answer:
          "The server is not properly configured. Please contact support.",
      });
    }

    console.log(`📤 Forwarding to RAG: ${RAG_API_URL}/api/query`);
    console.log(`   Question: "${question}"`);

    // Forward to RAG server with timeout
    const response = await axios.post(
      `${RAG_API_URL}/api/query`,
      { question: question.trim() },
      {
        timeout: 30000, // 30 second timeout
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Response received from RAG");
    console.log(`   Answer length: ${response.data.answer?.length || 0} chars`);

    res.json(response.data);
  } catch (error) {
    console.error("\n❌ ERROR in /api/query:");
    console.error(`   Message: ${error.message}`);

    // Handle timeout
    if (error.code === "ECONNABORTED") {
      console.error("   Type: Request timeout");
      return res.status(504).json({
        error: "Request timeout",
        answer:
          "The request took too long to process. Please try again with a simpler question.",
      });
    }

    // Handle RAG server errors
    if (error.response) {
      console.error(`   Type: RAG server error`);
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);

      return res.status(error.response.status).json({
        error: "Error from RAG API",
        answer:
          "Sorry, there was an error processing your question. Please try again.",
        details:
          process.env.NODE_ENV === "development"
            ? error.response.data
            : undefined,
      });
    }

    // Handle connection errors
    if (error.request) {
      console.error("   Type: No response from RAG server");
      return res.status(503).json({
        error: "RAG API unavailable",
        answer:
          "The AI service is currently unavailable. Please try again in a moment.",
      });
    }

    // Handle other errors
    console.error("   Type: Unexpected error");
    console.error("   Stack:", error.stack);

    res.status(500).json({
      error: "Internal server error",
      answer: "An unexpected error occurred. Please try again.",
    });
  }
});

//
// ------------------ CHECK RAG SERVER HEALTH ------------------
//
app.get("/api/rag-health", async (req, res) => {
  console.log("🏥 RAG health check requested");

  try {
    if (!RAG_API_URL) {
      return res.status(500).json({
        status: "error",
        message: "RAG_API_URL not configured",
      });
    }

    console.log(`   Checking: ${RAG_API_URL}/health`);

    const response = await axios.get(`${RAG_API_URL}/health`, {
      timeout: 10000, // 10 second timeout
    });

    console.log("✅ RAG server is healthy");

    res.json({
      status: "connected",
      message: "RAG API is healthy and reachable",
      ragResponse: response.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ RAG health check failed");
    console.error(`   Error: ${error.message}`);

    res.status(503).json({
      status: "unavailable",
      message: "RAG API is not reachable",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

//
// ------------------ 404 HANDLER (MUST BE LAST) ------------------
//
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: "Route not found",
    path: req.path,
    method: req.method,
    availableRoutes: [
      "GET /",
      "GET /health",
      "POST /api/query",
      "GET /api/rag-health",
    ],
    message: "The requested endpoint does not exist",
  });
});

//
// ------------------ ERROR HANDLER ------------------
//
app.use((err, req, res, next) => {
  console.error("\n❌ UNHANDLED ERROR:");
  console.error(err.stack);

  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "An unexpected error occurred",
  });
});

//
// ------------------ START SERVER ------------------
//
app.listen(PORT, "0.0.0.0", () => {
  console.log("\n╔═══════════════════════════════════════════════════╗");
  console.log("║     🚀 UMS CHATBOT BACKEND SERVER STARTED       ║");
  console.log("╚═══════════════════════════════════════════════════╝\n");
  console.log(`📍 Server URL:  http://localhost:${PORT}`);
  console.log(`🔗 RAG Server:  ${RAG_API_URL || "⚠️  NOT CONFIGURED"}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`⏰ Started at:  ${new Date().toLocaleString()}\n`);
  console.log("Available endpoints:");
  console.log(`  • GET  /              - API info`);
  console.log(`  • GET  /health        - Health check`);
  console.log(`  • POST /api/query     - Send query to RAG`);
  console.log(`  • GET  /api/rag-health - Check RAG status\n`);

  if (!RAG_API_URL) {
    console.log("⚠️  WARNING: RAG_API_URL is not set!");
    console.log("   Set it in Render dashboard Environment Variables");
    console.log(
      "   Example: RAG_API_URL=https://ums-rag-server.onrender.com\n"
    );
  }
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("\n👋 SIGTERM received, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("\n👋 SIGINT received, shutting down gracefully...");
  process.exit(0);
});
