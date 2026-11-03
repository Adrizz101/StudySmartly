<div align="center">
  <img src="public/logo.jpg" alt="StudySmartly Logo" width="200" />
  
  # StudySmartly
  
  **The AI-Powered Visual & Adaptive Learning Platform**
  
  [![React 19](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://react.dev)
  [![TanStack Start](https://img.shields.io/badge/TanStack_Start-v1-black?style=for-the-badge&logo=react)](https://tanstack.com)
  [![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com)
  [![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?style=for-the-badge&logo=vercel)](https://vercel.com)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com)
  
  <p align="center">
    An independent, full-stack EdTech platform designed to make studying visual, interactive, and adaptive. Built entirely on free-tier infrastructure without sacrificing performance or security.
  </p>
</div>

---

## 🎯 The Vision
StudySmartly started as an experiment to escape proprietary no-code platforms. It evolved into a fully independent ecosystem designed to prove that enterprise-grade AI educational tools should be accessible to every student, regardless of budget.

## ✨ Core Features

*   **🎨 AI Whiteboard:** A visual, speaking AI tutor. Generates spatial JSON schemas rendered stroke-by-stroke on an Excalidraw canvas, synchronized with browser-native text-to-speech. Includes an interactive "Atom Popper" mini-game during AI generation.
*   **📅 Adaptive Study Planner:** A deterministic scheduling engine. Parses unstructured syllabus data (PDF/Text), extracts topics, and generates conflict-free revision time-blocks with spaced repetition.
*   **📝 PYQ Exam Arena:** Generates verified MCQs from past papers. Includes a **Mistake Analyzer** that diagnoses weak concepts and links directly to the Whiteboard for targeted explanations.
*   **🎴 Smart Flashcards:** AI-generated basic and multiple-choice flashcards with answer feedback and SuperMemo-2 (SM-2) spaced repetition.
*   **🎤 Lecture Transcriber:** Browser-native real-time audio-to-text for capturing live lectures.
*   **📊 Presentation Studio:** Generates structured slide decks from prompts or uploaded notes.\n*   **🔑 Bring Your Own Key (BYOK):** Save your own Gemini or OpenRouter API key in Settings. Keys are encrypted with AES-256-GCM on the server, stored in Supabase, and never returned to the browser after saving.\n*   **⚖️ Transparent AI limits:** Shared system keys include 15 AI actions per account per UTC day. BYOK bypasses StudySmartly’s shared cap; each AI provider’s own quotas, model availability, and terms still apply.

## 🏗️ Technical Architecture

StudySmartly is engineered for high availability and zero-cost scalability:

*   **Dynamic AI Key Routing:** Uses the Vercel AI SDK to select a user-provided Gemini or OpenRouter key when one is saved, otherwise falling back to server-level provider keys. User keys are AES-256-GCM encrypted before storage in Supabase and decrypted only in server-side code. Structured outputs are validated with Zod and provider failover is handled server-side.\n*   **Daily Usage Enforcement:** A Supabase RPC atomically tracks shared-key usage and enforces 15 AI actions per account per UTC day. User-key requests bypass the shared counter.\n*   **Privacy-Conscious Analytics:** Signed-in event metadata is written to `analytics_events` with owner-bound insert policies; free-text prompts, feedback, credentials, and direct identifiers are excluded.
*   **Imperative Canvas Rendering:** Bypasses React’s virtual DOM for high-performance drawing. Utilizes Excalidraw’s imperative API to execute batched, 30ms state-update loops.
*   **Serverless Edge Architecture:** Deployed on Vercel's edge network with TanStack Start for type-safe, SSR-optimized routing.
*   **Security & Data:** Powered by Supabase PostgreSQL, using Row-Level Security (RLS), authenticated server functions, PKCE authentication, and OTP sign-in. Encrypted BYOK records are user-scoped; daily usage counters are not directly accessible to clients.
*   **Premium UI/UX:** Built with React 19, Tailwind CSS, and Framer Motion. Features an Awwwards-level glassmorphic design system with 60FPS spring physics and optimistic UI state hydration.

## 🔐 Environment Variables

The names below match [`.env.example`](.env.example). Only the two `VITE_` Supabase variables are exposed to the browser. All other values are server-side only.

| Variable | Scope | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Client | Supabase project URL used by the browser client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Client | Supabase publishable key used by the browser client |
| `SUPABASE_URL` | Server | Supabase project URL for server functions |
| `SUPABASE_PUBLISHABLE_KEY` | Server | Supabase publishable key for authenticated server access |
| `GEMINI_API_KEY` | Server | Shared Gemini provider key |
| `GROQ_API_KEY` | Server | Optional server-side provider configuration; not part of the current Gemini/OpenRouter AI route |
| `OPENROUTER_API_KEY` | Server | Shared OpenRouter provider key |
| `USER_AI_KEYS_ENCRYPTION_KEY` | Server secret | 32-byte AES-GCM encryption key, encoded as 64 hexadecimal characters |
| `VITE_APP_URL` | Optional client | Public app URL when configured |

Generate the BYOK encryption secret locally with `openssl rand -hex 32` and add it as a sensitive server environment variable in Vercel. Never commit real API keys or encryption secrets. User-provided Gemini and OpenRouter keys are encrypted with this secret before they are stored in Supabase.

## 🛠️ Local Development

To run StudySmartly locally, you need Node.js and `pnpm` installed.

```bash
# 1. Clone the repository
git clone https://github.com/Adrizz101/StudySmartly.git
cd StudySmartly

# 2. Install dependencies
pnpm install

# 3. Set up Environment Variables
cp .env.example .env
# Configure the variables described below. Keep all provider and encryption
# secrets server-side; never add a VITE_ prefix to them.

# 4. Run the development server
pnpm run dev
