# StudySmartly - AI Agent Guidelines

## Core Stack
- React 19, TanStack Start, Tailwind CSS v4, Supabase, Vercel AI SDK, Zod.

## 🚨 Critical Rules (Do not violate)

### 1. Routing & Server Functions
- DO NOT create custom nested API routes (like `/api/tutor/stream`). The TanStack route generator often fails to register them, causing persistent Vercel 404 errors.
- ALWAYS use TanStack `createServerFn` for backend logic. If an API route is absolutely necessary, use a flat file format (`api.tutor.stream.ts`) and verify it appears in `routeTree.gen.ts`.
- NEVER manually edit `routeTree.gen.ts`. It is auto-generated.

### 2. String Escaping & Regex
- **LaTeX / JSON:** When writing system prompts containing LaTeX, ALWAYS wrap the prompt in `String.raw` template literals. Do NOT use regular strings with backslashes (e.g., `\frac`), as Vite will crash on invalid Unicode escapes.
- **Regex:** AVOID complex regular expressions for parsing strings. Use `.split()`, `.trim()`, or standard string methods instead to prevent Vercel build crashes (like the `ENOENT` regex failure).

### 3. Package Management
- DO NOT install new packages unless absolutely necessary. If you must, check `package.json` first. Vercel is configured with `--no-frozen-lockfile`, so it will not crash if the lockfile is out of sync.
- Use `pdfjs-dist` for client-side PDF extraction (already installed).

### 4. Mobile UI & Styling
- The app is mobile-first. 
- Chat containers must use `flex flex-col`, `min-h-0`, and `overflow-y-auto` to prevent input boxes from overlapping content.
- Long KaTeX equations must be wrapped in `overflow-x: auto` or split by the AI into multiple lines so they don't break the mobile screen width.

### 5. AI Tutor (Teaching Personas)
- The Tutor supports four teaching personas (Socratic, ELI5, Exam Focus, Direct Answer). Socratic is the default, but the AI dynamically injects the selected persona's instructions. Do not remove this selector.
- Preserve Markdown formatting (bullet points, bold) and KaTeX (`$...$` for block math). No square brackets `[ ]` around equations.

## Development Workflow
- Commit to `main` only when the code is verified to work.
- If a Vercel build fails, read the logs before guessing.
