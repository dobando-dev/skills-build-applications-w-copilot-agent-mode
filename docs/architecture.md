# OctoFit Tracker architecture

OctoFit Tracker is a three-tier application for a school fitness program. The starter code includes API contracts and intentionally incomplete implementation points so you can use GitHub Copilot agent mode in a test-driven loop.

![Three-tier OctoFit architecture](../.github/images/octofit-architecture.svg)

## Tier boundaries

- **Presentation tier**: React 19, Vite, React Router, Bootstrap, and a shared API client in `octofit-tracker/frontend/src`.
- **Logic tier**: Express and TypeScript routes/services in `octofit-tracker/backend/src` expose `/api/*` behavior on port `8000`.
- **Data tier**: Mongoose models and seed data in `octofit-tracker/backend/src/models` and `src/scripts/seed.ts` persist to MongoDB on port `27017`.

## Ports and environment rules

- MongoDB: `27017`
- Express API: `8000`
- Vite frontend: `5173`
- The browser calls relative `/api` paths. Vite proxies them to `http://localhost:8000`, so the unauthenticated API port stays private in Codespaces. `VITE_API_BASE_URL` can override the base URL.

## API contract

| Capability | Method and path | Expected behavior |
| --- | --- | --- |
| Activity tracking | `GET /api/activities`, `POST /api/activities` | List and create valid activity records. POST accepts `userId`, `teamId`, `type`, and `minutes`; `userId` and `teamId` must be well-formed IDs for an existing user and team; otherwise respond with a deliberate 4xx (never a 500 from a cast error). A created activity stores the submitted `user`, `team`, `type`, and `minutes` plus computed `points` and `occurredAt`. |
| Teams | `GET /api/teams`, `POST /api/teams` | List and create teams with members. Created and listed teams keep the submitted `name` and `mascot`. Reject a team without a name with `400`. |
| Leaderboard | `GET /api/leaderboard` | Return teams ordered by the sum of their activity points, highest first. Each entry has `teamName`, `totalPoints`, and a 1-based `rank`. |
| Workout suggestions | `GET /api/workouts/suggestions/:userEmail` | Recommend workouts from recent activity patterns for the matching seeded user's email address. The first suggestion's `focus` matches that user's goal or recent activity, with a `reason` explaining why. An email with no matching user returns a deliberate 4xx (for example, `404`). |

## Implementation decisions

Implementation plan:

- Presentation tier decision: Keep route components focused on presentation and use the shared API client for all `/api` requests. Each capability page handles loading, empty, and request-error states accessibly.
- Logic tier decision: Keep HTTP parsing, validation, status codes, and response shapes in Express routes, with persistence and capability behavior in the service layer. Return deliberate 4xx responses for invalid or missing resources; do not expose cast errors as 500s.
- Data tier decision: Use Mongoose models for required-field and relationship-reference validation, and keep seed data idempotent without deleting or rewriting unrelated records.
- Activity tracking approach: Validate `userId`, `teamId`, `type`, and positive `minutes`; verify both referenced documents exist before creating an activity. Store the resolved user/team references, submitted activity details, computed points, and an occurrence timestamp.
- Team management approach: Require a non-empty name, preserve the submitted name and mascot, and default members to an empty array. Validate member references when supplied.
- Leaderboard approach: Aggregate activity points by team, include teams with no activity at zero points, sort by total points descending, and assign 1-based ranks.
- Workout suggestions approach: Find the requested user by email, use their fitness goal and recent activity to prioritize matching workouts, and include a concise reason for the leading suggestion. Return a 4xx response when the user does not exist.

## Test plan

Run the focused contracts first, followed by both builds. A failed data/API test indicates a persistence or service/HTTP contract regression; a failed frontend test indicates a request, rendering, or visible-state regression. A build failure indicates a TypeScript or bundling error.

- Data-tier tests: `npm run test:data --prefix octofit-tracker/backend` — checks model validation and idempotent, non-destructive seeding.
- API tests: `npm run test:api --prefix octofit-tracker/backend` — checks request validation, response codes and shapes, and all four capability behaviors against MongoDB.
- Frontend tests: `npm test --prefix octofit-tracker/frontend` — checks API-backed rendering, user-specific workout requests, and accessible loading, empty, and error states.
- Backend build: `npm run build --prefix octofit-tracker/backend` — type-checks the Express application.
- Frontend build: `npm run build --prefix octofit-tracker/frontend` — type-checks and bundles the Vite application.

The backend contract tests use `mongodb-memory-server`; run them in an environment where it can start a supported MongoDB binary. The current Alpine environment is unsupported by that dependency, so its startup failure is an environment limitation rather than an application test result.
