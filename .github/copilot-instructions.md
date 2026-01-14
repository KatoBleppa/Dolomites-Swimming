# Copilot Instructions for Dolomites Swimming

## Project Overview
- This is a modern React (TypeScript) web application for managing swimming club data, including athletes, meets, attendance, and personal bests.
- Uses Vite for build tooling, Tailwind CSS for styling, and Supabase for backend/database integration.
- The main app code is in `src/`, with subfolders for components, pages, contexts, and database scripts.

## Key Architectural Patterns
- **Pages**: Each major feature (Athletes, Attendance, Meets, PB, etc.) is a separate file in `src/pages/`. These are routed and rendered as main views.
- **Components**: Reusable UI elements are in `src/components/`, with further organization into `ui/` (generic UI), `layout/` (app structure), and feature-specific components.
- **Context**: Shared state (e.g., season info) is managed via React Context in `src/contexts/`.
- **Database**: SQL scripts and JSON schema files for Supabase are in `src/database/`. Data access is abstracted in `src/lib/supabase.ts`.
- **Types**: All shared types/interfaces are in `src/types/database.ts`.

## Developer Workflows
- **Install dependencies**: `npm install`
- **Start dev server**: `npm run dev`
- **Build for production**: `npm run build`
- **Preview production build**: `npm run preview`
- **Lint**: `npm run lint`
- **Tailwind CSS**: Configured via `tailwind.config.js` and `postcss.config.js`.

## Project-Specific Conventions
- Use TypeScript for all React components and logic.
- Prefer functional components and hooks.
- Use context for cross-page state (see `SeasonContext.tsx`).
- All database access should go through `lib/supabase.ts`.
- UI components should be composed from `src/components/ui/` when possible.
- SQL and schema changes should be reflected in both the Supabase dashboard and the local `src/database/` scripts.

## Integration Points
- **Supabase**: All backend data is managed via Supabase; see `lib/supabase.ts` for API usage.
- **OpenAPI**: The `openapi-schema.json` may be used for API typing or validation.

## Examples
- To add a new page, create a file in `src/pages/` and add routing logic as needed.
- To add a new database table, update Supabase and add a matching SQL/JSON schema in `src/database/`.

## References
- Main entry: `src/main.tsx`, `src/App.tsx`
- Layout: `src/components/layout/`
- UI primitives: `src/components/ui/`
- Context: `src/contexts/`
- Database: `src/database/`
- Types: `src/types/database.ts`

---
For more details, inspect the referenced files and follow the established patterns. When in doubt, prefer explicit, typed, and modular code.