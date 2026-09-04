// Vite projects expose Vercel Functions from /api. Keep the Express app in the
// server package so local Node and Vercel execute the same routes/middleware.
export { default } from '../server/app.js';
