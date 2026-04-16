import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        halal: {
          green: "#16a34a",
          "green-light": "#dcfce7",
          red: "#dc2626",
          "red-light": "#fee2e2",
          amber: "#d97706",
          "amber-light": "#fef3c7",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
