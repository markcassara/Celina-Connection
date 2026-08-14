import { createApp } from "../server/app";

let appInstance: any = null;

function getApp() {
  if (!appInstance) {
    try {
      appInstance = createApp();
    } catch (err) {
      console.error("Failed to initialize Express app:", err);
      throw err;
    }
  }
  return appInstance;
}

export default function handler(req: any, res: any) {
  try {
    const app = getApp();
    // Normalize request URL so Express routes matching /api/* match consistently
    if (req.url && !req.url.startsWith('/api') && !req.url.startsWith('/api/')) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
    return app(req, res);
  } catch (error: any) {
    console.error("Vercel API Handler Exception:", error);
    return res.status(500).json({
      error: "Server initialization error",
      details: error?.message || String(error),
    });
  }
}
