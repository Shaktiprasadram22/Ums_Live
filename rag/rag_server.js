import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs/promises";
import { OpenAIEmbeddings } from "@langchain/openai";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";

const app = express();
const PORT = process.env.PORT || 8000;

// ✅ CORS - Allow your frontend to access this server
app.use(
  cors({
    origin: [
      "https://ums-live.vercel.app", // Production frontend
      "https://ums-live.onrender.com", // Production backend
      "http://localhost:3000", // Local React dev server
      "http://localhost:5000", // Local backend
    ],
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

let vectorstore = null;
let totalDocuments = 0;

// ✅ Initialize RAG system
async function initializeRAG() {
  try {
    console.log("🔄 Loading knowledge base...");

    const rawData = await fs.readFile("ums_paths.json", "utf-8");
    const umsData = JSON.parse(rawData);

    const documents = [];
    for (const [category, paths] of Object.entries(umsData.UMS_Chatbot_Paths)) {
      documents.push(...paths);
    }

    totalDocuments = documents.length;
    console.log(`✅ Total documents found: ${totalDocuments}`);

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 200,
      chunkOverlap: 20,
    });

    const langchainDocs = documents.map(
      (text) => new Document({ pageContent: text }),
    );
    const splitDocs = await splitter.splitDocuments(langchainDocs);

    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    vectorstore = await FaissStore.fromDocuments(splitDocs, embeddings);

    console.log("✅ Vector store ready.");
  } catch (error) {
    console.error("❌ Initialization Error:", error.message);
    console.error("Full error:", error);
    process.exit(1);
  }
}

// ✅ Root route for browser testing
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>UMS RAG Server</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          max-width: 700px; 
          margin: 50px auto; 
          padding: 20px;
          background: linear-gradient(135deg, #fff5f0 0%, #ffffff 100%);
        }
        h1 { color: #ea580c; }
        .status { 
          padding: 15px; 
          background: #f0fdf4; 
          border-left: 4px solid #22c55e;
          border-radius: 5px; 
          margin: 15px 0; 
        }
        .test-box {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          margin: 20px 0;
        }
        input { 
          width: 100%; 
          padding: 12px; 
          margin: 10px 0; 
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
        }
        button { 
          background: #ea580c; 
          color: white; 
          padding: 12px 24px; 
          border: none; 
          cursor: pointer;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
        }
        button:hover { background: #c2410c; }
        #result {
          margin-top: 20px;
          padding: 15px;
          background: #f9fafb;
          border-radius: 8px;
          min-height: 50px;
          border: 1px solid #e5e7eb;
        }
      </style>
    </head>
    <body>
      <h1>🤖 UMS RAG Server</h1>
      <div class="status">
        <strong>Status:</strong> ${vectorstore ? "✅ Online & Ready" : "⏳ Loading..."}<br>
        <strong>Documents Loaded:</strong> ${totalDocuments}<br>
        <strong>Timestamp:</strong> ${new Date().toLocaleString()}
      </div>
      
      <div class="test-box">
        <h3>Test Query</h3>
        <input 
          type="text" 
          id="question" 
          placeholder="Ask a question about UMS..." 
          value="What courses are available?"
        >
        <button onclick="testQuery()">Send Query</button>
        <div id="result"></div>
      </div>

      <script>
        async function testQuery() {
          const question = document.getElementById('question').value;
          const resultDiv = document.getElementById('result');
          
          resultDiv.innerHTML = '⏳ Processing...';
          
          try {
            const response = await fetch('/api/query', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ question })
            });
            
            const data = await response.json();
            resultDiv.innerHTML = '<strong>✅ Answer:</strong><br><br>' + data.answer;
          } catch (error) {
            resultDiv.innerHTML = '<strong>❌ Error:</strong><br>' + error.message;
          }
        }
      </script>
    </body>
    </html>
  `);
});

// ✅ Health check endpoint
app.get("/health", (req, res) => {
  console.log("📡 Health check from:", req.headers.origin || "direct");
  res.json({
    status: "online",
    vectorstore_ready: vectorstore !== null,
    total_documents: totalDocuments,
    timestamp: new Date().toISOString(),
  });
});

// ✅ Query endpoint
app.post("/api/query", async (req, res) => {
  try {
    const { question } = req.body;

    console.log("📥 Query from:", req.headers.origin || "direct");
    console.log("📝 Question:", question);

    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({
        answer: "Please provide a valid question.",
      });
    }

    if (!vectorstore) {
      return res.status(503).json({
        answer:
          "Knowledge base is loading. Please wait a moment and try again.",
      });
    }

    const similarDocs = await vectorstore.similaritySearchWithScore(
      question,
      3,
    );

    console.log(`📊 Found ${similarDocs.length} relevant documents`);

    const answer =
      similarDocs.length > 0
        ? similarDocs[0][0].pageContent
        : "Sorry, I couldn't find relevant information. Try rephrasing your question.";

    console.log("✅ Sending response");
    res.json({ answer });
  } catch (error) {
    console.error("❌ Query Error:", error);
    res.status(500).json({
      answer: "Error processing your question. Please try again.",
    });
  }
});

// ✅ 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Cannot ${req.method} ${req.path}`,
    availableEndpoints: ["GET /", "GET /health", "POST /api/query"],
  });
});

// ✅ Error handler
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

// ✅ Start server
async function startServer() {
  await initializeRAG();

  app.listen(PORT, "0.0.0.0", () => {
    console.log("\n" + "=".repeat(50));
    console.log("🚀 RAG Server Started Successfully!");
    console.log("=".repeat(50));
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`🏥 Health: http://localhost:${PORT}/health`);
    console.log(`🔍 API: http://localhost:${PORT}/api/query`);
    console.log(`📚 Documents: ${totalDocuments}`);
    console.log(`✅ Status: ${vectorstore ? "Ready" : "Loading..."}`);
    console.log("=".repeat(50) + "\n");
  });
}

startServer().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});
