# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Code style

Use comments sparingly. Only comment complex code.

## Commands

```bash
npm run setup          # First-time setup: install deps, generate Prisma client, run migrations
npm run dev            # Start dev server with Turbopack at localhost:3000
npm run dev:daemon     # Start dev server in background, logs to logs.txt
npm run build          # Production build
npm run lint           # Run ESLint
npm test               # Run all tests
npm test -- path/to/test.test.tsx  # Run a single test file
npm run db:reset       # Drop and recreate the database
```

After changing the Prisma schema, run `npx prisma migrate dev` to apply migrations and regenerate the client.

## Environment

Copy `.env` and set `ANTHROPIC_API_KEY`. If the key is missing or still set to `your-api-key-here`, the app falls back to a `MockLanguageModel` that returns canned components — this is intentional and useful for development without API credits.

**Do not run `npm audit fix`** — dependencies are pinned to specific compatible versions.

## Architecture

UIGen is a Next.js 15 App Router application where users describe React components in a chat and see them rendered live. There is no real file system involved; all generated code lives in an in-memory `VirtualFileSystem`.

### Data flow

1. User types a prompt → `ChatProvider` (wraps `useAIChat`) sends `POST /api/chat` with the current message history and the serialized virtual file system.
2. `app/api/chat/route.ts` reconstructs the VFS, calls `streamText` with two tools (`str_replace_editor`, `file_manager`), and streams the response back.
3. As tool calls arrive on the client, `ChatProvider.onToolCall` delegates to `FileSystemContext.handleToolCall`, which applies the file operations (create, str_replace, insert, rename, delete) to the in-memory VFS.
4. `PreviewFrame` watches `refreshTrigger` from `FileSystemContext`. On every change it reads all files, runs them through `jsx-transformer.ts` (Babel standalone + import map), and writes the result into an `<iframe srcdoc>`.

### Key abstractions

- **`VirtualFileSystem`** (`src/lib/file-system.ts`) — in-memory tree of `FileNode` objects. `serialize()` / `deserializeFromNodes()` convert it to/from a plain `Record<string, FileNode>` for JSON transport. Every AI-generated file lives here; nothing is written to disk.
- **`FileSystemContext`** (`src/lib/contexts/file-system-context.tsx`) — React context that wraps `VirtualFileSystem`, exposes file operations, and owns `refreshTrigger` (an integer that increments on every change to signal the preview to re-render).
- **`ChatContext`** (`src/lib/contexts/chat-context.tsx`) — thin wrapper around Vercel AI SDK's `useAIChat`. Bridges incoming tool calls to `FileSystemContext.handleToolCall`.
- **`jsx-transformer.ts`** — transforms JSX/TSX files with Babel standalone in the browser, builds an ES module import map (resolving `@/` aliases to blob URLs of other files in the VFS), and produces the full HTML injected into the preview iframe. Unknown third-party package imports are resolved to `https://esm.sh/<package>`. CSS imports are stripped and inlined into a `<style>` tag. Babel syntax errors are displayed inside the iframe rather than crashing it.
- **`provider.ts`** — exports `getLanguageModel()`. Returns `anthropic("claude-haiku-4-5")` when a real API key is present, or `MockLanguageModel` otherwise. To change the model, edit the `MODEL` constant in this file.
- **`generationPrompt`** (`src/lib/prompts/generation.tsx`) — system prompt injected at the start of every chat request. Specifies that every project must have `/App.jsx` as the root entry point and that imports use the `@/` alias.

### AI tools

Two tools are registered with `streamText` in `app/api/chat/route.ts` and handled client-side in `FileSystemContext.handleToolCall`:

- **`str_replace_editor`** — commands: `view` (read file or list directory), `create` (new file with content), `str_replace` (replace first matching string), `insert` (insert text at a line number). The `undo_edit` command is accepted by the schema but returns an error — the AI should use `str_replace` to revert changes instead.
- **`file_manager`** — commands: `rename` (move a file/directory, creates parent dirs), `delete` (remove a file or directory recursively).

Tool calls arrive on the client as streaming events; `ChatContext` routes them through `FileSystemContext.handleToolCall` which mutates the VFS and increments `refreshTrigger`.

### Testing

Tests use Vitest with jsdom. Test files live in `__tests__` directories next to the code they test. Run a single test file with `npm test -- src/lib/__tests__/file-system.test.ts`.

### UI components

shadcn/ui components live in `src/components/ui/`. Add new ones with `npx shadcn add <component>`. The main layout (`MainContent`) is a resizable split panel: chat on the left (35%), preview/code editor on the right (65%).

### Auth & persistence

- Auth is JWT-based via `jose`, stored in an httpOnly cookie. `src/lib/auth.ts` handles token creation/verification; `src/middleware.ts` protects `/api/projects` and `/api/filesystem` routes.
- Authenticated users get their messages and VFS state persisted to a SQLite database (Prisma). Anonymous users get session-storage tracking via `anon-work-tracker.ts` so their work can be offered for saving upon sign-up.
- The database schema is defined in `prisma/schema.prisma` — reference it whenever you need to understand the structure of data stored in the database.
- Prisma client is generated into `src/generated/prisma/` (not the default location).

### Routing

- `/` — anonymous landing page or redirect to most recent project for authenticated users.
- `/[projectId]` — loads a saved project's messages and VFS data, renders the same `MainContent` with initial state hydrated from the database.
