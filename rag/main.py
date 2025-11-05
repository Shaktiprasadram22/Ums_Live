import os
import json
from openai import OpenAI
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter  # ✅ Yeh correct hai
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

# Load env
load_dotenv()

# 1️⃣ OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# 2️⃣ Load knowledge base
with open('ums_paths.json', 'r', encoding='utf-8') as f:
    ums_data = json.load(f)

documents = []
for category, paths in ums_data["UMS_Chatbot_Paths"].items():
    documents.extend(paths)

print(f"✅ Total documents found: {len(documents)}")

# 3️⃣ Split text
splitter = RecursiveCharacterTextSplitter(
    chunk_size=200,
    chunk_overlap=20
)
texts = splitter.create_documents(documents)

# 4️⃣ Embeddings + Vector store
embeddings = OpenAIEmbeddings()
vectorstore = FAISS.from_documents(texts, embeddings)

print("✅ Vector store created and ready.")

# 5️⃣ FastAPI app
app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {
        "status": "Python FastAPI server is running",
        "vectorstore_ready": True,
        "total_documents": len(documents)
    }

@app.post("/api/query")
async def query(request: Request):
    body = await request.json()
    question = body.get("question", "")
    if not question:
        return {"answer": "❌ No question provided."}
    
    similar_docs = vectorstore.similarity_search_with_score(question, k=3)
    
    if similar_docs:
        answer = similar_docs[0][0].page_content
    else:
        answer = "Sorry, no relevant answer found."
    
    return {"answer": answer}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)