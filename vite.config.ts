import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // host: true -> ouve em todas as interfaces (acessivel via IP da rede, ex.: 192.168.0.47:5180)
    host: true,
    port: 5180,
  },
  preview: {
    host: true,
    port: 5180,
  },
});
