# AGENTS.md

Agents operating in this repository **must follow the rules in this file**. Violations will cause runs to be blocked or reverted.

# Rule Priority

When rules conflict, follow this order:

1. Correctness & safety
2. Maintainability
3. Readability
4. Consistency with existing codebase
5. Style preferences in this document

# Style Guidelines

- Strictly follow existing code style in the codebase.
- Use Svelte 5 runes (`$state`, `$derived`, `$effect`) for all component-level reactive state.
- Use `$props()` destructuring for component props.
- Use TypeScript strict mode throughout — no `any` types.
- Write JSDoc comments for exported utility functions and types.
- Keep code concise and elegant — don't over-engineer.
- Adhere to SOLID principles, especially Single Responsibility.
- Always import from `$lib` aliases, not relative paths from route files.

## Component Conventions

- PascalCase file names for Svelte components (e.g., `AddExpenseModal.svelte`).
- camelCase for utility modules (e.g., `api.ts`, `auth.ts`).
- Always key `{#each}` blocks: `{#each items as item (item.id)}`.
- Use scoped `<style>` blocks for component-specific styles.
- Use `.btn`, `.btn-primary`, `.card` utility classes from `app.css` — don't reinvent them.
- Handle `Escape` key in modals via `onkeydown` on the backdrop element.
- Modals receive `onClose` and `onSuccess` callbacks — always call them appropriately.

## TypeScript & Data Handling

- Prefer typed interfaces over `Record<string, any>`.
- Use `Record<string, string>` for validation error maps.
- All GraphQL responses must be typed — define interfaces in `src/lib/types.ts`.
- Avoid silent failure patterns — always surface errors via the toast store.
- Never discard a thrown error without handling it.
- Use `errors` objects for form validation, not untyped state.

## GraphQL Conventions

- Use the `query<T>()` wrapper in `src/lib/api.ts` for all API calls.
- Define typed request variables and response shapes in `src/lib/types.ts`.
- Do not introduce a separate GraphQL client library — the custom wrapper is intentional.
- Handle 401 and 429 responses explicitly; both can come as HTTP status or as GQL errors.

## Documentation

The `docs/` directory holds living reference documents. Update them incrementally as you explore, plan, and implement.

| File | Purpose |
|------|---------|
| `docs/architecture.md` | High-level system design — routing, auth flow, data flow |
| `docs/modules.md` | Per-module summaries — what each file owns and its public interface |
| `docs/decisions.md` | ADRs — why things are the way they are |
| `docs/gotchas.md` | Traps, quirks, things not to change without care |

- Append new findings; do not overwrite existing content without good reason.
- Keep entries short and factual — a few sentences per item is enough.

# Security

- Never hard-code secrets, tokens, or API base URLs in component files.
- JWT tokens must stay in `localStorage` under the existing `dutch_auth` key — do not change the key name.
- Do not store user credentials in component state.
- Apply the least-privilege principle: don't broaden data access beyond what the task requires.

# Decision Framework

When multiple approaches are possible:

1. Prefer the simplest solution that satisfies requirements
2. Prefer Svelte 5 runes over writable stores for local component state
3. Prefer explicit TypeScript types over inference for function signatures
4. Avoid premature abstraction
5. Prefer existing design system classes (`app.css`) over new inline styles

# Planning Rules

Before starting a **non-trivial task**, create a plan at:

```
agent_logs/YYYYMMDD_HHMMSS_<descriptive_name>_plan.md
```

- Each plan must be standalone: define inputs, constraints, and success criteria.
- Plans must be executable without prior context.
- Must list `files_to_change` and `new_files`.
- Must describe a concise, coherent technical approach.
- Planning output must not modify repository code.

## Confirmation Gate

After the plan file is written, **stop and do the following before any implementation**:

1. Present a concise summary of the plan to the user.
2. Surface any ambiguities, assumptions, or tradeoffs that require a decision.
3. Ask the user to confirm they are happy with the plan.
4. **Do not begin implementation until explicit confirmation is received.**

If the user requests changes, update the plan file and repeat the confirmation step.

## Scope Control

- Do not expand scope beyond explicit requirements.
- If improvements are identified, list them under "future work" only.

# Implementation Rules

- Implement complete features end-to-end; no partial implementations should remain.
- Never stop midway through a defined phase.
- Preserve existing inline comments; do not remove useful historical context.
- Other agents/humans may modify the repository concurrently — never undo unrelated changes.
- Do NOT commit or push without explicit approval.

# Formatting

Run at the end of full implementation:

```bash
npm run format
npm run lint
```

# Type Checking

```bash
npm run check
```

- Fix all type errors before proceeding.
- Never bypass `svelte-check` failures.

# Testing Rules

This project has no automated test suite. Verify changes manually in the browser:

```bash
npm run dev
```

- Ensure the backend is running at `http://localhost:8080/query`.
- Test the golden path and relevant edge cases after any change.

# Definition of Done

A task is complete when:

- Plan is fully executed
- No partial implementations remain
- Type check passes: `npm run check`
- Lint passes: `npm run lint`
- `docs/` updated wherever relevant
- Changes are consistent with repository standards

# Suggesting Future Work

When you identify improvements beyond the current task's scope:
- Document them clearly in the relevant log or doc file.
- DO NOT implement unless explicitly instructed.

# Environment Instructions

## Setup

```bash
npm install
npm run dev    # starts dev server at http://localhost:5173
```

The frontend expects a GraphQL backend at `http://localhost:8080/query` (dev) — see `src/lib/api.ts` for the base URL logic.

## Key Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Production build to `build/` |
| `npm run check` | Type-check all Svelte + TS files |
| `npm run lint` | Run Prettier check + ESLint |
| `npm run format` | Auto-format all files with Prettier |
| `npm run preview` | Preview production build locally |

## Dependency Inspection

- Check `package.json` for declared versions.
- Before implementing new functionality, check if `src/lib/` already covers the need.
- Do not install new dependencies without explicit approval — keep the bundle small.
- For the internal utility `src/lib/api.ts`, always check its current interface before adding new query wrappers.
