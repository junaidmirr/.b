# Standalone AI Microservice for Google Cloud Run

This folder contains an optional, standalone containerized service for the AI Assistant, ready for Google Cloud Run deployment.

> **Note**: You do NOT need to deploy this if your portfolio is hosted on Vercel. The portfolio already handles this natively via the Vercel serverless function `api/chat.js` with zero server management or extra cost!

### One-Command Deployment to Google Cloud Run

If you ever wish to host this service independently on Google Cloud Run:

```bash
cd server-cloudrun
gcloud run deploy junaid-ai-service \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```
