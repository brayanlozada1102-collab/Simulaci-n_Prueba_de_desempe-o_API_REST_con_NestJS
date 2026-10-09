# Commercial Requests REST API (NestJS)

REST API developed with NestJS to manage and track commercial requests submitted by advisors, audited by supervisors, and overseen by administrators. Built according to strict functional, technical, and security specifications with role-based authorization, multiple API Key support, and SQLite/PostgreSQL persistence.

---

## 1. Features & Business Rules

- **BR-01. Commercial Request Registration (`POST /requests`)**:
  - Any user with a valid role (`admin`, `supervisor`, `advisor`) can register requests.
  - The initial status is always set to `PENDING`.
  - When the registering user has the `advisor` role, the responsible advisor is automatically assigned to their own user (`x-user`).
- **BR-02. Commercial Request Query (`GET /requests` & `GET /requests/:id`)**:
  - `admin` and `supervisor`: can retrieve all requests in the system.
  - `advisor`: can strictly only retrieve requests assigned to their own user. This restriction is enforced directly in the database query (`where: { advisor: user.username }`).
  - Individual queries by ID validate ownership: an advisor attempting to access another advisor's request receives `403 Forbidden`.
- **BR-03. Status Transition (`PATCH /requests/:id/status`)**:
  - `admin` and `supervisor` can change the status of any request.
  - `advisor` can only change the status of requests assigned to them.
  - Allowed status lifecycle:
    - `PENDING` → `IN_PROGRESS`
    - `IN_PROGRESS` → `RESOLVED`
  - Direct transition from `PENDING` to `RESOLVED` is rejected (`400 Bad Request`).
  - Reopening or modifying a `RESOLVED` request is rejected (`400 Bad Request`).
- **BR-04. API Protection**:
  - All functional endpoints require the `x-api-key` header.
  - Supports multiple valid keys configured via environment variables (`API_KEYS=key1,key2`).
  - Requests missing an API Key or with an invalid key are rejected (`401 Unauthorized`).
- **BR-05. Input Validation**:
  - Global validation using `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`).
  - Required non-empty string validation for `client` and `description`. Strict enum validation for `status`.
- **BR-06. Standardized Responses and Errors**:
  - Global interceptor standardizes successful responses: `{ "success": true, "data": ... }`.
  - Global custom exception filter normalizes errors without hiding HTTP status codes:
    ```json
    {
      "success": false,
      "statusCode": 400,
      "message": "Error details",
      "timestamp": "2026-10-09T...",
      "path": "/requests"
    }
    ```

---

## 2. In-Memory Users & Roles (`x-user`)

Authentication in memory validates the user passed in the `x-user` header against the preconfigured system accounts:

| Username (`x-user`) | Role         | Description           | Permissions                                                     |
| :------------------ | :----------- | :-------------------- | :-------------------------------------------------------------- |
| `admin`             | `admin`      | Main Administrator    | Full access: queries all, creates, updates any status.          |
| `supervisor`        | `supervisor` | Commercial Supervisor | Queries all, creates, updates any status.                       |
| `advisor_john`      | `advisor`    | Commercial Advisor 1  | Creates (auto-assigned), queries and updates own requests only. |
| `advisor_mary`      | `advisor`    | Commercial Advisor 2  | Creates (auto-assigned), queries and updates own requests only. |

_Note: Backward-compatible aliases (`asesor_juan`, `asesor_maria`) and dual route aliases (`/solicitudes`) are also supported._

---

## 3. Environment Variables Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Example `.env` content:

```env
PORT=3000
CONTAINER_NAME=commercialization

# Multiple comma-separated API Keys
API_KEYS=clave_secreta_comercial_1,clave_secreta_comercial_2,empresa_key_3

# Database engine ('sqlite' or 'postgres')
DB_TYPE=sqlite
SQLITE_DATABASE=commercialization.sqlite

# PostgreSQL configuration (for Docker Compose)
POSTGRES_NAME=commercialization_db
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=test
POSTGRES_PASSWORD=test
POSTGRES_DB=riwi_commercialization
```

---

## 4. Installation & Execution

### Option A: Local Execution (SQLite or PostgreSQL)

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build the project:

   ```bash
   npm run build
   ```

3. Start in development mode:
   ```bash
   npm run start:dev
   ```

The application will start on `http://localhost:3000`.

### Option B: Docker Compose Execution (with PostgreSQL)

```bash
docker compose up --build -d
```

---

## 5. Interactive Swagger (OpenAPI) Documentation

When the application is running, open:
**[http://localhost:3000/docs](http://localhost:3000/docs)**

In Swagger UI:

- Click the **Authorize** button to configure headers:
  - `x-api-key`: `clave_secreta_comercial_1`
  - `x-user`: `admin`, `supervisor`, or `advisor_john`
- Test each endpoint interactively and explore DTO schemas and response codes.

---

## 6. Endpoints & `curl` Examples

### 1. Register a Commercial Request (`POST /requests`)

```bash
curl -X POST http://localhost:3000/requests \
  -H "Content-Type: application/json" \
  -H "x-api-key: clave_secreta_comercial_1" \
  -H "x-user: advisor_john" \
  -d '{
    "client": "Acme Corp",
    "description": "Request for quotation for cloud enterprise plan"
  }'
```

### 2. Retrieve Requests (`GET /requests`)

```bash
# As Advisor (only sees own assigned requests)
curl -X GET http://localhost:3000/requests \
  -H "x-api-key: clave_secreta_comercial_1" \
  -H "x-user: advisor_john"

# As Administrator (sees all requests)
curl -X GET http://localhost:3000/requests \
  -H "x-api-key: clave_secreta_comercial_1" \
  -H "x-user: admin"
```

### 3. Retrieve Individual Request (`GET /requests/:id`)

```bash
curl -X GET http://localhost:3000/requests/1 \
  -H "x-api-key: clave_secreta_comercial_1" \
  -H "x-user: advisor_john"
```

### 4. Update Request Status (`PATCH /requests/:id/status`)

```bash
# Advance from PENDING to IN_PROGRESS
curl -X PATCH http://localhost:3000/requests/1/status \
  -H "Content-Type: application/json" \
  -H "x-api-key: clave_secreta_comercial_1" \
  -H "x-user: advisor_john" \
  -d '{
    "status": "IN_PROGRESS"
  }'

# Advance from IN_PROGRESS to RESOLVED
curl -X PATCH http://localhost:3000/requests/1/status \
  -H "Content-Type: application/json" \
  -H "x-api-key: clave_secreta_comercial_1" \
  -H "x-user: advisor_john" \
  -d '{
    "status": "RESOLVED"
  }'
```

---

## 7. Automated Tests

The project includes unit tests and full End-to-End integration tests:

```bash
# Run unit tests (Guards, Filters, Interceptors, Services, Controllers)
npm run test

# Run End-to-End (E2E) integration tests against live endpoints
npm run test:e2e

# Run linter
npm run lint
```
