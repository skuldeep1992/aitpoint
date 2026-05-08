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

## Option 2: Self-Hosting (Hostinger VPS / Linux)

If you are using a **Hostinger VPS** (or any Ubuntu server):

### 1. Prerequisites
- **Plan:** Ensure you have a **VPS** plan (Shared hosting is not recommended for this app).
- **OS:** Ubuntu 22.04 or 24.04 is recommended.

### 2. Automatic Setup (Easiest)
We've included a script to install Node.js and all Chrome dependencies for you:

```bash
# 1. Upload the code to your server
# 2. Run the setup script
chmod +x hostinger-setup.sh
./hostinger-setup.sh
```

### 3. Manual Deployment
If the script doesn't fit your needs, follow these steps:
1.  **Install dependencies**: `npm install`
2.  **Build the app**: `npm run build`
3.  **Setup Environment**: Create a `.env` file with your `GEMINI_API_KEY`.
4.  **Start with PM2**:
    ```bash
    pm2 start npm --name aitpoint -- start
    ```

## Option 3: Docker (Recommended for VPS)
If your VPS has Docker installed, use it to avoid installing manual dependencies:
```bash
docker build -t aitpoint .
docker run -d -p 80:3000 --restart always --env-file .env aitpoint
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
