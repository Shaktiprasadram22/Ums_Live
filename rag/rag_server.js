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

// CORS - Allow all origins (update later with your Vercel URL)
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
app.use(express.json());

let vectorstore = null;
let totalDocuments = 0;

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

    console.log("✅ Vector store ready.");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

app.get("/health", (req, res) => {
  res.json({
    status: "RAG server is running",
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
      return res.status(503).json({ answer: "❌ Vector store not ready." });
    }

    const similarDocs = await vectorstore.similaritySearchWithScore(
      question,
      3
    );

    let answer =
      similarDocs.length > 0
        ? similarDocs[0][0].pageContent
        : "Sorry, no relevant answer found.";

    res.json({ answer });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ answer: "❌ Error processing query." });
  }
});

async function startServer() {
  await initializeRAG();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 RAG Server: http://localhost:${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/health`);
  });
}

startServer();
