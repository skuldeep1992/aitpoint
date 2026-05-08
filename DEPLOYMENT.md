# Deployment Guide for AiTpoint

This guide explains how to host AiTpoint on a live domain.

## Recommended: Cloud Run (with GitHub)

The easiest way to take this app live is via **Google Cloud Run**, especially if you want a custom domain.

1.  **Push to GitHub**:
    -   Export your project to GitHub from the AI Studio menu (**Settings > Export to GitHub**).
2.  **Deploy to Cloud Run**:
    -   Go to the [Google Cloud Console](https://console.cloud.google.com/run).
    -   Click **Create Service**.
    -   Select **Continuously deploy from a repository**.
    -   Select your GitHub repo and the `main` branch.
    -   In the build settings, choose **Docker** (it will automatically use the `Dockerfile` I created).
3.  **Setup Custom Domain**:
    -   Once deployed, go to the **Manage Custom Domains** tab in the Cloud Run service settings.
    -   Follow the steps to map your domain (e.g., `aitpoint.com`) to the service.

## Option 2: Self-Hosting (Linux VPS)

If you have your own server (DigitalOcean, AWS EC2, etc.):

### 1. Prerequisites
- **Node.js**: Version 20 or higher.
- **Docker**: (Recommended) For easy setup of Puppeteer dependencies.

### 2. Using Docker (Easiest)
```bash
# Build the image
docker build -t aitpoint .

# Run the container
docker run -p 3000:3000 --env-file .env aitpoint
```

### 3. Without Docker (Manual Setup)
If you don't want to use Docker, you must install the system libraries for Puppeteer:
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 ... (see Dockerfile for full list)
```
Then:
```bash
npm install
npm run build
npm start
```

## Option 3: Vercel / Netlify
*Note: Because this app uses a custom Express server (`server.ts`) and Puppeteer, Vercel requires specific configuration for "Serverless Functions". Cloud Run is generally more reliable for this specific architecture.*

## Environment Variables
Ensure you set these in your production environment:
- `GEMINI_API_KEY`: Your Google AI API Key.
- `INDIAN_RAIL_API_KEY`: For the train status feature.
- `NODE_ENV`: `production`

## SSL and Security
- Cloud Run handles SSL (HTTPS) automatically for you.
- If self-hosting, use **Nginx** with **Certbot** (Let's Encrypt) to secure your domain.
