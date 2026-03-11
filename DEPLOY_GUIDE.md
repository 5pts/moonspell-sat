# Moonspell Full Stack Deployment Guide

To get a **permanent URL** with working backend (data sync + admin panel), you need to deploy the Node.js server.

The easiest free option is **Render.com**.

## 1. Deploy to Render (Free)

1.  Push this project to a **GitHub Repository** (private or public).
2.  Sign up at [render.com](https://render.com).
3.  Click **New +** -> **Web Service**.
4.  Connect your GitHub repo.
5.  Render will auto-detect Node.js.
    - **Build Command**: `npm install && npm run build`
    - **Start Command**: `npm start`
6.  Click **Create Web Service**.

Wait a few minutes, and Render will give you a permanent URL like:
`https://moonspell-sat.onrender.com`

- **Main App**: `https://.../`
- **Admin**: `https://.../admin.html` (Password: `admin`)

## 2. Local Run (Testing)

Double-click `START_FULL_STACK.cmd` to run the full stack locally at `http://localhost:3000`.

## 3. Data Persistence Note

On free tiers of Render/Glitch, the SQLite database file might reset if the server restarts (ephemeral filesystem).
To keep data permanently on Render, you need to add a **Disk** (paid feature) or switch the database code to use a managed database service (like Supabase or Render PostgreSQL).

For a quick permanent URL with persistence on free tier, consider **Glitch.com** or **Fly.io** with volumes, or use **Supabase** as the database backend.

## 4. Alternative: Surge (Frontend Only)

If you only want the frontend (no cross-device sync, data stored in browser only), run `DEPLOY_NOW.cmd`.
This deploys to Surge.sh (Free, Permanent, Static).
