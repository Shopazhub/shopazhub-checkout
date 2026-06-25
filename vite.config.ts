import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const apiUrl = env.VITE_API_URL || process.env.VITE_API_URL || "";
  const receiverAddress =
    env.VITE_PAYMENT_RECEIVER_ADDRESS ||
    process.env.VITE_PAYMENT_RECEIVER_ADDRESS ||
    "";

  console.log("==== Vite build env check ====");
  console.log("VITE_API_URL          :", apiUrl || "(NOT SET)");
  console.log("VITE_PAYMENT_RECEIVER_ADDRESS:", receiverAddress || "(NOT SET)");
  console.log("==============================");

  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_API_URL": JSON.stringify(apiUrl),
      "import.meta.env.VITE_PAYMENT_RECEIVER_ADDRESS": JSON.stringify(receiverAddress),
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
