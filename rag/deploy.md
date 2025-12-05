# 🚀 STEP 1: Deploy RAG Server on Render

## ✅ Pre-Deployment Checklist

Make sure your `rag` folder has these files:

- ✅ `rag_server.js`
- ✅ `package.json`
- ✅ `ums_paths.json`
- ✅ `.env` (with your OPENAI_API_KEY)

---

## 📝 Step-by-Step Instructions

### 1. Push Your Code to GitHub

```bash
# Navigate to your project root (UMS-CHATBOT)
cd /path/to/UMS-CHATBOT

# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit - ready for deployment"

# Create a new GitHub repository and push
git remote add origin https://github.com/YOUR_USERNAME/UMS-CHATBOT.git
git branch -M main
git push -u origin main
```

---

### 2. Go to Render Dashboard

1. Open your browser and go to: **https://render.com**
2. Click **"Get Started"** or **"Sign In"**
3. Sign in with your **GitHub account**

---

### 3. Create New Web Service

1. Click the **"New +"** button (top right)
2. Select **"Web Service"**

---

### 4. Connect Your Repository

1. Click **"Connect a repository"**
2. Find and select **"UMS-CHATBOT"** repository
3. Click **"Connect"**

---

### 5. Configure Service Settings

Fill in these settings:

| Field              | Value                                |
| ------------------ | ------------------------------------ |
| **Name**           | `ums-rag-server`                     |
| **Root Directory** | `rag`                                |
| **Environment**    | `Node`                               |
| **Region**         | `Oregon (US West)` or closest to you |
| **Branch**         | `main`                               |
| **Build Command**  | `npm install`                        |
| **Start Command**  | `npm start`                          |
| **Instance Type**  | `Free`                               |

---

### 6. Add Environment Variables

Scroll down to **"Environment Variables"** section:

Click **"Add Environment Variable"** and add:

```
Key: OPENAI_API_KEY
Value: sk-proj-XXXXXXXXXXXXXXXXXXXXX (your actual key)
```

Click **"Add Environment Variable"** again:

```
Key: NODE_ENV
Value: production
```

---

### 7. Create Web Service

1. Click **"Create Web Service"** button at the bottom
2. **Wait 5-10 minutes** for deployment
3. Watch the logs in real-time

---

### 8. Check Deployment Status

You'll see logs like:

```
==> Cloning from https://github.com/YOUR_USERNAME/UMS-CHATBOT...
==> Checking out commit XXXXXX in branch main
==> Installing dependencies...
==> npm install
==> Starting service...
==> npm start

🔄 Loading knowledge base...
✅ Total documents found: 100+
✅ Vector store created and ready.

🚀 RAG Server: http://0.0.0.0:8000
```

When you see **"Live"** status with a green dot ✅, deployment is complete!

---

### 9. Get Your RAG Server URL

At the top of the page, you'll see your deployed URL:

```
https://ums-rag-server.onrender.com
```

**Copy this URL!** You'll need it for the next steps.

---

### 10. Test Your Deployed RAG Server

Open a new terminal and test:

```bash
# Test health check
curl https://ums-rag-server.onrender.com/health

# Expected response:
# {
#   "status": "Node.js Express server is running",
#   "vectorstore_ready": true,
#   "total_documents": 100+
# }
```

Test the query endpoint:

```bash
curl -X POST https://ums-rag-server.onrender.com/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "How to change password?"}'

# Expected response:
# {
#   "answer": "Login -> UmsHome -> Change Password -> Change UMS Password"
# }
```

---

## ✅ RAG Deployment Complete!

**Your RAG Server is LIVE at:**

```
https://ums-rag-server.onrender.com
```

**Save this URL!** We'll use it in the next steps.

---

## 🐛 Troubleshooting

### Issue: Build Failed

**Check**: Make sure `package.json` has all dependencies
**Fix**:

```bash
cd rag
npm install
git add package-lock.json
git commit -m "Add package-lock.json"
git push
```

### Issue: "OPENAI_API_KEY not found"

**Fix**: Go to Render Dashboard → Your Service → Environment → Add the key

### Issue: Service keeps restarting

**Check Logs**: Look for error messages in the "Logs" tab
**Common issue**: Missing `ums_paths.json` file

### Issue: "Module not found" error

**Fix**: Make sure you installed `@langchain/textsplitters`:

```bash
cd rag
npm install @langchain/textsplitters
git add package.json package-lock.json
git commit -m "Add missing dependency"
git push
```

---

## 🎯 Next Steps

Once your RAG server shows **"Live"** status and responds to health checks:

✅ **DONE:** RAG Server deployed  
⏳ **NEXT:** Deploy Server folder on Render  
⏳ **THEN:** Deploy Client on Vercel

---

## 📸 What You Should See

When deployment is successful, you'll see:

1. ✅ Green "Live" indicator
2. ✅ Logs showing "Vector store created and ready"
3. ✅ URL responding to `/health` endpoint
4. ✅ Deployment time: ~5-10 minutes

---

**Ready to move to Step 2 (Server deployment)?** Let me know when RAG is deployed! 🚀
