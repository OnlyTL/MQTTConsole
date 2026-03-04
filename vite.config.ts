import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite";
import * as path from "node:path";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            registerType: "autoUpdate",
            injectRegister: false,
            includeAssets: ["pwa-icon.png", "pwa-192.png", "pwa-512.png"],
            manifest: {
                id: "/",
                name: "MQTT Console",
                short_name: "MQTT",
                description: "Web-based MQTT test tool with local profiles and message inspection.",
                theme_color: "#10b981",
                background_color: "#0f172a",
                display: "standalone",
                start_url: "/",
                scope: "/",
                icons: [
                    {
                        src: "/pwa-192.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "/pwa-512.png",
                        sizes: "512x512",
                        type: "image/png",
                    },
                    {
                        src: "/pwa-512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable",
                    },
                ],
            },
            workbox: {
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: true,
                globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
                runtimeCaching: [
                    {
                        urlPattern: ({ request }) => request.destination === "document",
                        handler: "NetworkFirst",
                        options: {
                            cacheName: "page-cache",
                            networkTimeoutSeconds: 3,
                        },
                    },
                    {
                        urlPattern: ({ request }) =>
                            request.destination === "script" || request.destination === "style",
                        handler: "StaleWhileRevalidate",
                        options: {
                            cacheName: "asset-cache",
                        },
                    },
                    {
                        urlPattern: ({ url }) => url.origin === "https://api.github.com",
                        handler: "NetworkFirst",
                        options: {
                            cacheName: "github-api-cache",
                            networkTimeoutSeconds: 5,
                            expiration: {
                                maxEntries: 20,
                                maxAgeSeconds: 300,
                            },
                        },
                    },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        host: true
    }
})
