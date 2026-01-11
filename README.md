# Dutch Frontend

A modern, lightweight alternative to Splitwise for managing group expenses and settling balances. This repository contains the frontend application built with SvelteKit.

## Features
- **Group Management:** Create groups and invite members via unique tokens.
- **Expense Tracking:** Log expenses with detailed descriptions, multi-payer support, and customizable shares.
- **Auto-Settlement:** Clear visualization of who owes whom and quick settlement options.
- **Multi-Currency:** Support for various currencies with persistent local caching.
- **Offline-First (Read):** Uses IndexedDB to cache currency data for a smoother experience.
- **Reactive UI:** Built with Svelte 5 for high performance and responsiveness.

## Tech Stack
- **Framework:** [SvelteKit](https://kit.svelte.dev/) (Svelte 5)
- **Language:** TypeScript
- **Storage:** [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) (via `idb` library)
- **Styling:** CSS3 with modern features (Grid, Flexbox, CSS Variables)
- **Build Tool:** Vite
- **Deployment:** Static Site Hosting (GitHub Pages)

## Project Structure
- `src/routes/`: Page components and routing logic.
- `src/lib/`: Reusable components, types, and utility functions.
- `src/lib/components/`: UI components (Modals, Toasts, etc.).
- `src/lib/api.ts`: Centralized GraphQL client logic.
- `src/lib/types.ts`: Shared TypeScript interfaces.

## Local Development

### Prerequisites
- Node.js 20+
- npm

### Setup
1. **Clone the repo:**
   ```bash
   git clone https://github.com/raythx98/go-dutch.git
   cd go-dutch
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure API:**
   The frontend expects the backend to be running at `http://localhost:8080/query`. You can change this in `src/lib/api.ts` if needed.

4. **Run Development Server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`.

## Commands
- `npm run dev`: Start development server.
- `npm run build`: Build for production (outputs to `build/`).
- `npm run check`: Run Svelte-check for type and syntax errors.
- `npm run format`: Format code using Prettier.
- `npm run lint`: Run ESLint and Prettier checks.

## Backend Integration
This frontend is designed to work with the [Dutch Backend](https://github.com/raythx98/go-dutch) (Go/GraphQL). Ensure the backend is running and accessible for full functionality.

## License
MIT