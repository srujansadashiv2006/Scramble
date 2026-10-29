import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Frontend dev server runs on 5173 (the port the FastAPI CORS config allows).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
