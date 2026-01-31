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

// ----------------- DEVELOPMENT CORS (Permissive) -----------------
// Use this for local development, tighten for production
const isDevelopment = process.env.NODE_ENV !== "production";

if (isDevelopment) {
  // Permissive CORS for development
  app.use(
    cors({
      origin: true, // Allow all origins in development
      credentials: true,
    }),
  );
  console.log("⚠️  DEVELOPMENT MODE: CORS allowing all origins");
} else {
  // Strict CORS for production
  app.use(
    cors({
      origin: ["https://ums-live.onrender.com"],
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  console.log("🔒 PRODUCTION MODE: CORS restricted");
}

app.use(express.json());

let vectorstore = null;
let totalDocuments = 0;

// ----------------- LOAD VECTORSTORE -----------------
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

// ----------------- HEALTH CHECK -----------------
app.get("/health", (req, res) => {
  console.log(
    "📡 Health check requested from:",
    req.headers.origin || "no origin",
  );
  res.json({
    status: "RAG server is running",
    vectorstore_ready: vectorstore !== null,
    total_documents: totalDocuments,
    timestamp: new Date().toISOString(),
  });
});

// ----------------- QUERY ENDPOINT -----------------
app.post("/api/query", async (req, res) => {
  try {
    const { question } = req.body;

    console.log(
      "📥 Received question from:",
      req.headers.origin || "no origin",
    );
    console.log("📝 Question:", question);

    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({
        answer: "Please provide a valid question.",
      });
    }

    if (!vectorstore) {
      return res.status(503).json({
        answer:
          "The knowledge base is still loading. Please try again in a moment.",
      });
    }

    const similarDocs = await vectorstore.similaritySearchWithScore(
      question,
      3,
    );

    console.log(`📊 Found ${similarDocs.length} similar documents`);

    let answer =
      similarDocs.length > 0
        ? similarDocs[0][0].pageContent
        : "Sorry, I couldn't find relevant information about that. Could you try rephrasing your question?";

    console.log("✅ Sending response");
    res.json({ answer });
  } catch (error) {
    console.error("❌ Query Error:", error);
    res.status(500).json({
      answer:
        "I encountered an error processing your question. Please try again.",
    });
  }
});

// ----------------- ERROR HANDLER -----------------
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: err.message,
  });
});

// ----------------- START SERVER -----------------
async function startServer() {
  await initializeRAG();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 RAG Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔍 Query endpoint: http://localhost:${PORT}/api/query`);
    console.log(
      `🌍 Environment: ${isDevelopment ? "DEVELOPMENT" : "PRODUCTION"}\n`,
    );
  });
}

startServer().catch((error) => {
  console.error("❌ Failed to start server:", error);
  process.exit(1);
});
