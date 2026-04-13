# Deployment Guide for AiTpoint

This guide explains how to host AiTpoint on your own server.

## Prerequisites

- **Node.js**: Version 18 or higher.
- **npm** or **yarn**: Package manager.
- **Linux Server**: (Recommended) Ubuntu 22.04 or similar.

## 1. Get the Code

Export your project from AI Studio as a ZIP file or push it to a GitHub repository.

## 2. Install System Dependencies (Linux)

Puppeteer requires several system libraries to run Chromium. On Ubuntu/Debian, run:

```bash
sudo apt-get update
sudo apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils
```

## 3. Setup the Project

1.  **Extract/Clone** the code to your server.
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Build the frontend**:
    ```bash
    npm run build
    ```

## 4. Environment Variables

Create a `.env` file in the root directory:

```env
NODE_ENV=production
PORT=3000
```

## 5. Running the Application

### Option A: Direct (For testing)
```bash
npm start
```

### Option B: Using PM2 (Recommended for Production)
PM2 keeps your app running in the background and restarts it if it crashes.

1.  **Install PM2**:
    ```bash
    sudo npm install -g pm2
    ```
2.  **Start the app**:
    ```bash
    pm2 start server.ts --interpreter ./node_modules/.bin/tsx --name documorph
    ```
    *Note: Since we use `server.ts` directly with `tsx`, we tell PM2 to use the local `tsx` interpreter.*

3.  **Save the process list**:
    ```bash
    pm2 save
    ```

## 6. Reverse Proxy (Nginx)

It is recommended to use Nginx as a reverse proxy to handle SSL and port 80/443.

Example Nginx config (`/etc/nginx/sites-available/documorph`):

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    }
}
```

## Important Notes

- **Max File Size**: The current limit is 50MB. If you change this in `server.ts`, also update your Nginx `client_max_body_size`.
- **Puppeteer Performance**: Puppeteer launches a new browser instance for each conversion. Ensure your server has at least 2GB of RAM for stable performance.
