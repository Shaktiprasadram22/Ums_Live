import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "fs/promises";
import { OpenAIEmbeddings } from "@langchain/openai";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";

const app = express();
const PORT = 8000; // 🔥 Same port as your Python FastAPI server

// Middleware
app.use(cors());
app.use(express.json());

// Global vector store
let vectorstore = null;
let totalDocuments = 0;

// Initialize RAG system
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
      (text) => new Document({ pageContent: text })
    );
    const splitDocs = await splitter.splitDocuments(langchainDocs);

    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    vectorstore = await FaissStore.fromDocuments(splitDocs, embeddings);

    console.log("✅ Vector store created and ready.");
  } catch (error) {
    console.error("❌ Error initializing RAG:", error.message);
    process.exit(1);
  }
}

// Routes
app.get("/health", (req, res) => {
  res.json({
    status: "Node.js Express server is running",
    vectorstore_ready: vectorstore !== null,
    total_documents: totalDocuments,
  });
});

app.post("/api/query", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question) {
      return res.json({ answer: "❌ No question provided." });
    }

    if (!vectorstore) {
      return res
        .status(503)
        .json({ answer: "❌ Vector store not initialized." });
    }

    const similarDocs = await vectorstore.similaritySearchWithScore(
      question,
      3
    );

    let answer;
    if (similarDocs.length > 0) {
      answer = similarDocs[0][0].pageContent;
    } else {
      answer = "Sorry, no relevant answer found.";
    }

    res.json({ answer });
  } catch (error) {
    console.error("Error processing query:", error);
    res.status(500).json({ answer: "❌ Error processing your query." });
  }
});

// Start server
async function startServer() {
  await initializeRAG();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`💬 Query endpoint: POST http://localhost:${PORT}/api/query`);
  });
}

startServer();
