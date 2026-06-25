import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify(
        env.VITE_API_URL || process.env.VITE_API_URL || ""
      ),
      "import.meta.env.VITE_PAYMENT_RECEIVER_ADDRESS": JSON.stringify(
        env.VITE_PAYMENT_RECEIVER_ADDRESS ||
          process.env.VITE_PAYMENT_RECEIVER_ADDRESS ||
          ""
      ),
    },
    server: {
      port: 3000,
      strictPort: false,
    },
    preview: {
      port: Number(process.env.PORT) || 3003,
      strictPort: false,
    },
  };
});
