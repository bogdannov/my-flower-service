# Autowatering Backend — Implementation Tasks

This document contains a complete breakdown of all implementation tasks. Each task includes a self-contained prompt that can be handed to a developer or AI agent, a detailed description with context, acceptance criteria, and file references. Tasks are ordered to minimize blockers.

**Conventions used in this document:**

- `[DEPENDS: X.Y]` — this task cannot start until task X.Y is complete.
- `[FILES]` — lists every file that must be created or modified.
- `[PROMPT]` — a copy-pasteable instruction for execution.
- `[ACCEPTANCE CRITERIA]` — the definition of done; every item must pass.

---

---

## Task 1.3 — Configuration Module ✅ COMPLETED

> Updated `src/module/config/Config.ts` with full Zod schema for all required env vars (STAGE, table names, Auth0, TTL, LOG_LEVEL, DYNAMODB_ENDPOINT). Exported `ConfigType`. Updated `logger.factory.ts` to use `LOG_LEVEL` and `STAGE`.

**Depends on:** 1.1

**Files to create:**
```
src/module/config/
└── Config.ts
```

### Prompt

```
Create the configuration module for the autowatering backend. This is the ONLY file in the entire project that is allowed to access process.env. All other modules receive configuration via dependency injection.

File: src/module/config/Config.ts

Requirements:

1. Define a ConfigSchema using Zod with these fields:
   - STAGE: z.enum(["dev", "staging", "prod"])
   - AWS_REGION: z.string().default("eu-central-1")
   - COLLECTIONS_TABLE: z.string()
   - USER_FLOWERS_TABLE: z.string()
   - WATERING_EVENTS_TABLE: z.string()
   - SENSOR_READINGS_TABLE: z.string()
   - DEVICES_TABLE: z.string()
   - PAIRING_CODES_TABLE: z.string()
   - AUTH0_DOMAIN: z.string()
   - AUTH0_AUDIENCE: z.string()
   - SENSOR_READINGS_TTL_DAYS: z.coerce.number().default(30)
   - PAIRING_CODE_TTL_MINUTES: z.coerce.number().default(10)
   - LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info")
   - DYNAMODB_ENDPOINT: z.string().optional()   // Used for LocalStack in tests

2. Export type Config = z.infer<typeof ConfigSchema>

3. Export a class Config that:
   - Has a private static instance (lazy singleton within the class)
   - Has a static load() method that parses process.env through ConfigSchema
   - Has a get() method that returns the parsed config object
   - Throws a descriptive error if validation fails, listing all missing/invalid fields

4. The class should be designed to work with the BaseFactory pattern:

export class ConfigFactory extends BaseFactory<Config> {
  // This factory will be implemented in Task 1.6
}

For now, just export the Config class and ConfigSchema. The factory will be created during DI setup.

IMPORTANT:
- process.env must ONLY be accessed inside the static load() method
- The parsed config is immutable after loading
- Zod's error formatting should be used for clear error messages on missing env vars
- Do NOT use "any" type anywhere
```

### Description

The Config module is a foundational constraint — by centralizing all environment variable access, we ensure that no service or handler reaches into `process.env` directly. This makes the application fully testable (tests inject config) and prevents the common bug of typos in env var names going unnoticed until runtime.

The `DYNAMODB_ENDPOINT` optional field is specifically for LocalStack — when set, the DynamoDB client connects to the local endpoint instead of AWS.

### Acceptance Criteria

- [ ] `Config.load()` succeeds when all required env vars are set
- [ ] `Config.load()` throws a Zod error listing all missing required fields when env is empty
- [ ] `DYNAMODB_ENDPOINT` is optional — config loads successfully without it
- [ ] Default values work: `SENSOR_READINGS_TTL_DAYS` defaults to 30, `LOG_LEVEL` defaults to "info"
- [ ] `z.coerce.number()` correctly converts string env vars to numbers
- [ ] Config type is exported and usable by other modules
- [ ] `process.env` is accessed ONLY inside this file — grep confirms no other usage
- [ ] No `any` type in the code

---

## Task 1.4 — DynamoDB Client and Base Repository ✅ COMPLETED

> Created `src/module/db/dynamo-client.ts` (DynamoDBDocumentClient factory supporting LocalStack via DYNAMODB_ENDPOINT) and `src/module/db/base.repository.ts` (abstract `BaseRepository<T>` with get, put, putWithCondition, query, delete, batchGet with retries, update).

**Depends on:** 1.3

**Files to create:**
```
src/module/db/
├── dynamo-client.ts
└── base.repository.ts
```

### Prompt

```
Create the DynamoDB client wrapper and a generic BaseRepository that all domain repositories will extend. This is the ONLY place where raw DynamoDB SDK calls are made. Domain repositories inherit these methods and add table-specific access patterns.

=== File 1: src/module/db/dynamo-client.ts ===

Create a function that builds a DynamoDB Document Client:

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { Config } from "../config/Config";

export function createDynamoDBClient(config: Config): DynamoDBDocumentClient {
  // If config.DYNAMODB_ENDPOINT is set, use it (LocalStack)
  // Otherwise, use default AWS SDK config with config.AWS_REGION
  // Return DynamoDBDocumentClient.from(client) with marshallOptions:
  //   removeUndefinedValues: true
  //   convertEmptyValues: false
}

=== File 2: src/module/db/base.repository.ts ===

Create an abstract generic BaseRepository<T> class:

import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand,
         DeleteCommand, UpdateCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";

Generic type parameter T represents the entity type stored in the table.

Constructor:
  - protected readonly client: DynamoDBDocumentClient
  - protected readonly tableName: string

Define these interfaces (exported):

interface QueryOptions {
  indexName?: string;
  scanIndexForward?: boolean;   // true = ascending (oldest first), false = descending (newest first)
  limit?: number;
  exclusiveStartKey?: Record<string, unknown>;
  filterExpression?: string;
  expressionAttributeValues?: Record<string, unknown>;
  expressionAttributeNames?: Record<string, string>;
  keyConditionExpression?: string;
}

interface PaginatedResult<T> {
  items: T[];
  lastEvaluatedKey?: Record<string, unknown>;
}

Protected methods (available to all domain repositories):

1. get(key: Record<string, string>): Promise<T | null>
   - Uses GetCommand
   - Returns null if item not found (not undefined)
   - Key is passed directly (e.g., { PK: "user123", SK: "col_abc" })

2. put(item: Record<string, unknown>): Promise<void>
   - Uses PutCommand
   - Writes the item as-is

3. putWithCondition(item: Record<string, unknown>, conditionExpression: string, expressionAttributeNames?: Record<string, string>): Promise<{ success: boolean }>
   - Uses PutCommand with ConditionExpression
   - Returns { success: true } on success
   - Catches ConditionalCheckFailedException and returns { success: false }
   - Re-throws all other errors

4. query(keyCondition: string, expressionValues: Record<string, unknown>, options?: QueryOptions): Promise<PaginatedResult<T>>
   - Uses QueryCommand
   - Applies all options if provided
   - Returns items as T[] and optional lastEvaluatedKey for pagination

5. delete(key: Record<string, string>): Promise<void>
   - Uses DeleteCommand
   - Key is passed directly

6. batchGet(keys: Record<string, string>[]): Promise<T[]>
   - Uses BatchGetCommand
   - Handles DynamoDB limit of 100 items per batch by chunking
   - Handles unprocessed keys by retrying (up to 3 retries with exponential backoff)
   - Returns empty array for empty input
   - Preserves order is NOT guaranteed (DynamoDB doesn't guarantee order in BatchGet)

7. update(key: Record<string, string>, updateExpression: string, expressionValues: Record<string, unknown>, expressionNames?: Record<string, string>): Promise<T>
   - Uses UpdateCommand with ReturnValues: "ALL_NEW"
   - Returns the full updated item

Private helper:
- chunkArray<U>(array: U[], size: number): U[][] — splits array into chunks of given size

IMPORTANT:
- Do NOT hardcode key names like "PK" and "SK" in the base repository — let domain repositories pass the full key object
- Do NOT use "any" — use Record<string, unknown> or generic T
- All methods must handle errors gracefully — let SDK errors bubble up unless there's specific handling (like ConditionalCheckFailedException in putWithCondition)
- batchGet must handle UnprocessedKeys
```

### Description

The BaseRepository is the most important reuse mechanism in the project. Every DynamoDB operation goes through these methods. Domain repositories like `CollectionsRepository` or `WateringRepository` extend this class and expose domain-specific methods (e.g., `findByUser`, `getHistory`) that internally call the protected base methods.

The key design decision is that base methods accept raw key objects (`Record<string, string>`) rather than hardcoding "PK"/"SK" — this gives domain repositories flexibility in how they structure their keys.

The `putWithCondition` method is essential for idempotent writes — for example, preventing duplicate device pairing.

### Acceptance Criteria

- [ ] `createDynamoDBClient` returns a working client when `DYNAMODB_ENDPOINT` is set (LocalStack)
- [ ] `createDynamoDBClient` returns a working client when `DYNAMODB_ENDPOINT` is not set (real AWS)
- [ ] `get` returns `null` (not `undefined`) when item doesn't exist
- [ ] `batchGet` correctly chunks arrays larger than 100 items
- [ ] `batchGet` returns empty array for empty input without making API calls
- [ ] `batchGet` handles UnprocessedKeys with retries
- [ ] `putWithCondition` returns `{ success: false }` when condition fails, not throws
- [ ] `query` correctly passes all options (indexName, limit, scanIndexForward, etc.)
- [ ] `update` returns the full updated item (ReturnValues: "ALL_NEW")
- [ ] No `any` type anywhere
- [ ] `chunkArray` is private and not exported
- [ ] `marshallOptions.removeUndefinedValues` is `true` on the document client

---

## Task 1.5 — Error Classes ✅ COMPLETED

> Created `src/module/errors/app.error.ts` with `AppError` (abstract), `NotFoundError` (404), `ValidationError` (400, with optional details), `UnauthorizedError` (401), `ForbiddenError` (403), `ConflictError` (409), `GoneError` (410). Re-exported from `src/module/errors/index.ts`.

**Depends on:** Nothing

**Files to create:**
```
src/module/errors/
├── app.error.ts
└── index.ts
```

### Prompt

```
Create the application error hierarchy for the autowatering backend. These errors are thrown by services and mapped to HTTP responses by handlers. Services NEVER reference HTTP status codes — they throw semantic errors.

File: src/module/errors/app.error.ts

Create an abstract base class and concrete error classes:

1. AppError (abstract, extends Error):
   - abstract readonly statusCode: number
   - abstract readonly code: string
   - constructor(message: string) — calls super(message), sets this.name to constructor.name

2. NotFoundError (extends AppError):
   - statusCode: 404
   - code: "NOT_FOUND"
   - constructor(resource: string) — message: `${resource} not found`

3. ValidationError (extends AppError):
   - statusCode: 400
   - code: "VALIDATION_ERROR"
   - readonly details: Record<string, unknown> | undefined
   - constructor(message: string, details?: Record<string, unknown>)

4. UnauthorizedError (extends AppError):
   - statusCode: 401
   - code: "UNAUTHORIZED"

5. ForbiddenError (extends AppError):
   - statusCode: 403
   - code: "FORBIDDEN"

6. ConflictError (extends AppError):
   - statusCode: 409
   - code: "CONFLICT"

7. GoneError (extends AppError):
   - statusCode: 410
   - code: "GONE"
   - Use case: expired pairing code

File: src/module/errors/index.ts
Re-export all error classes.

Note: The statusCode property is named for convenience of the handler mapping layer. Services themselves do not know or care about HTTP — they just throw NotFoundError("Collection") and the handler layer converts it to a 404 response. This is why the handler mapping function (created in a later task) is the bridge between domain errors and HTTP.

Do NOT use "any" — use Record<string, unknown> for error details.
```

### Description

The error hierarchy provides a clean contract between the service layer and the handler layer. Services express business-rule violations as typed errors; handlers map them to HTTP without any business logic. The `GoneError` is specifically for expired pairing codes — the code existed but has expired, which is semantically different from "not found."

### Acceptance Criteria

- [ ] All error classes extend `AppError`
- [ ] `new NotFoundError("Collection").message` equals `"Collection not found"`
- [ ] `new NotFoundError("Collection").statusCode` equals `404`
- [ ] `new NotFoundError("Collection").code` equals `"NOT_FOUND"`
- [ ] `error instanceof AppError` returns `true` for all concrete error classes
- [ ] `ValidationError` accepts optional `details` parameter
- [ ] No `any` type anywhere
- [ ] All classes are exported from `index.ts`

---

## Task 1.6 — Dependency Injection Container ✅ COMPLETED

> Created `src/bootstrap/factory/module/dynamodb-client.factory.ts` (DynamoDBClientFactory depends on ConfigFactory). Updated `src/bootstrap/inject.ts` to register DynamoDBClientFactory and expose `resetContainer()`. Removed obsolete HealthServiceFactory.

**Depends on:** 1.3, 1.4, 1.5

**Files to create:**
```
src/bootstrap/
├── factory/
│   ├── base.factory.ts
│   └── module/
│       ├── config.factory.ts
│       ├── logger.factory.ts
│       └── dynamodb-client.factory.ts
└── inject.ts
```

### Prompt

```
Create the dependency injection infrastructure for the autowatering backend. We use a factory pattern with lazy initialization. Each dependency is created once and cached.

=== File 1: src/bootstrap/factory/base.factory.ts ===

export abstract class BaseFactory<T> {
  private instance: T | null = null;
  private initPromise: Promise<T> | null = null;

  async make(): Promise<T> {
    if (this.instance) return this.instance;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._make().then((result) => {
      this.instance = result;
      return result;
    });

    return this.initPromise;
  }

  protected abstract _make(): Promise<T>;

  // For testing — resets the cached instance
  reset(): void {
    this.instance = null;
    this.initPromise = null;
  }
}

=== File 2: src/bootstrap/factory/module/config.factory.ts ===

import { BaseFactory } from "../base.factory";
import { Config, loadConfig } from "../../module/config/Config";

export class ConfigFactory extends BaseFactory<Config> {
  protected async _make(): Promise<Config> {
    return loadConfig();
  }
}

=== File 3: src/bootstrap/factory/module/logger.factory.ts ===

LET'S USE WINSTON AS THE LOGGER and setup it so we can simply use it.

=== File 4: src/bootstrap/factory/module/dynamodb-client.factory.ts ===

DynamoDBClientFactory depends on ConfigFactory. In _make(), it calls createDynamoDBClient(config).

=== File 5: src/bootstrap/inject.ts ===

This is the DI container. It creates all factories and wires their dependencies.

Structure:

const configFactory = new ConfigFactory();
const loggerFactory = new LoggerFactory(configFactory);
const dynamoDBClientFactory = new DynamoDBClientFactory(configFactory);

// Repository and service factories will be added in later tasks
// For now, export only the foundation factories

export function inject() {
  return {
    Config: () => configFactory.make(),
    Logger: () => loggerFactory.make(),
    DynamoDBClient: () => dynamoDBClientFactory.make(),
  };
}

// For testing — reset all factories
export function resetContainer(): void {
  configFactory.reset();
  loggerFactory.reset();
  dynamoDBClientFactory.reset();
}

IMPORTANT:
- Factories are instantiated ONCE at module load time
- .make() is async and lazy — the actual instance is created on first call
- Subsequent .make() calls return the cached instance
- The inject() function returns an object with async getters
- resetContainer() is for tests only
- Do NOT use "any" type
- Logger factory must depend on ConfigFactory (injected via constructor)
```

### Description

The DI container is intentionally simple — no framework, just factories with lazy initialization. The `BaseFactory<T>` ensures thread-safe (Promise-safe) initialization: if two Lambda handlers call `make()` simultaneously, only one `_make()` runs, and both get the same instance.

Repository and service factories will be added to `inject.ts` in later tasks. This task establishes the pattern.

The `resetContainer()` function is critical for testing — it ensures each test gets fresh instances.

### Acceptance Criteria

- [ ] `inject().Config()` returns the same Config instance on repeated calls
- [ ] `inject().DynamoDBClient()` returns a working DynamoDB client
- [ ] `inject().Logger()` returns a logger that outputs JSON
- [ ] Logger respects LOG_LEVEL — debug messages are suppressed when level is "info"
- [ ] `resetContainer()` forces re-creation of all dependencies on next `make()` call
- [ ] `BaseFactory.make()` is safe for concurrent calls (same Promise returned)
- [ ] No `any` type anywhere
- [ ] All factories follow the pattern: `constructor(dependencies...) → _make() → return instance`

---

## Task 1.7 — Integration Test Setup ✅ COMPLETED

> Installed `vitest` and `testcontainers`. Created `tests/integration/setup/tables.ts` (6 table definitions + TEST_TABLE_NAMES), `tests/integration/setup/global-setup.ts` (starts LocalStack via testcontainers, creates all tables, sets env vars), `tests/integration/setup/test-helpers.ts` (`clearTable`, `getTestDynamoDBClient`, `seedItem`). Created `vitest.config.ts`. Added `test:unit` and `test:integration` npm scripts. Created `tsconfig.test.json` for test type resolution.

**Depends on:** 1.1, 1.4

**Files to create:**
```
tests/
├── integration/
│   └── setup/
│       ├── global-setup.ts
│       ├── tables.ts
│       └── test-helpers.ts
└── unit/
    └── hello.test.ts  (a simple test to verify unit test setup works)
```

**Files to modify:**
```
vitest.config.ts
```

### Prompt

```
Set up the integration testing infrastructure using LocalStack in Docker via the testcontainers library. Integration tests run against a real DynamoDB (in LocalStack), not mocks.

=== File 1: tests/integration/setup/tables.ts ===

Export an array of CreateTableInput objects for all 6 DynamoDB tables. Table definitions must match the serverless.yml resource definitions exactly:

1. Collections table:
   - TableName: "test-collections"
   - PK (HASH): string, SK (RANGE): string
   - BillingMode: PAY_PER_REQUEST

2. UserFlowers table:
   - TableName: "test-user-flowers"
   - PK (HASH): string, SK (RANGE): string
   - BillingMode: PAY_PER_REQUEST
   - GSI "DeviceIndex": deviceId (HASH), Projection ALL

3. WateringEvents table:
   - TableName: "test-watering-events"
   - PK (HASH): string, SK (RANGE): string
   - BillingMode: PAY_PER_REQUEST

4. SensorReadings table:
   - TableName: "test-sensor-readings"
   - PK (HASH): string, SK (RANGE): string
   - BillingMode: PAY_PER_REQUEST
   - TTL on "ttl" attribute

5. Devices table:
   - TableName: "test-devices"
   - PK (HASH): string (deviceId)
   - BillingMode: PAY_PER_REQUEST
   - Note: NO sort key — single-item table keyed by deviceId

6. PairingCodes table:
   - TableName: "test-pairing-codes"
   - PK (HASH): string (code)
   - BillingMode: PAY_PER_REQUEST
   - TTL on "ttl" attribute
   - Note: NO sort key — single-item table keyed by code

Export as: export const tableDefinitions: CreateTableInput[]
Also export a map of table names:
export const TEST_TABLE_NAMES = {
  collections: "test-collections",
  userFlowers: "test-user-flowers",
  wateringEvents: "test-watering-events",
  sensorReadings: "test-sensor-readings",
  devices: "test-devices",
  pairingCodes: "test-pairing-codes",
} as const;

=== File 2: tests/integration/setup/global-setup.ts ===

Vitest globalSetup that:
1. Starts a LocalStack container using testcontainers:
   - Image: localstack/localstack:3
   - Exposed port: 4566
   - Environment: SERVICES=dynamodb, DEFAULT_REGION=eu-central-1
   - Wait strategy: wait for port 4566

2. Sets environment variables for all tests:
   - DYNAMODB_ENDPOINT = http://localhost:<mapped-port>
   - AWS_REGION = eu-central-1
   - AWS_ACCESS_KEY_ID = test
   - AWS_SECRET_ACCESS_KEY = test
   - STAGE = dev
   - AUTH0_DOMAIN = test.auth0.com
   - AUTH0_AUDIENCE = test-audience
   - All table name env vars pointing to test-* tables
   - LOG_LEVEL = error (suppress logs in tests)

3. Creates all DynamoDB tables using the definitions from tables.ts

4. Returns a teardown function that stops the container

IMPORTANT: The globalSetup must export setup() and teardown() functions as Vitest expects.

=== File 3: tests/integration/setup/test-helpers.ts ===

Export helper functions for integration tests:

1. clearTable(tableName: string): Promise<void>
   - Scans all items in the table and deletes them
   - Used in beforeEach to ensure clean state between tests

2. getTestDynamoDBClient(): DynamoDBDocumentClient
   - Creates a DynamoDB client pointing at LocalStack using process.env.DYNAMODB_ENDPOINT
   - Used by tests to create repository instances

3. seedItem(tableName: string, item: Record<string, unknown>): Promise<void>
   - Puts a single item into a table
   - Used for test data setup

=== Modify: vitest.config.ts ===

Add globalSetup pointing to the global setup file:
  globalSetup: ["./tests/integration/setup/global-setup.ts"]

Configure test projects or environments so unit and integration tests can run separately:
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,   // Container startup can be slow
  }

Do NOT use "any" type. Use proper types from @aws-sdk.

In the end run all tests to verify the setup works:
- `npm run test:integration` should start LocalStack, create tables, and pass tests
- `npm run test:unit` should run without starting a container
```

### Description

Integration tests are the primary quality gate for this project. Since we use DynamoDB extensively, testing against mocks would give false confidence — index behavior, TTL, and conditional writes can only be tested against a real DynamoDB (or LocalStack emulation).

The `clearTable` helper is crucial — it ensures each test starts with a clean slate. Without it, tests would interfere with each other.

The global setup uses testcontainers rather than docker-compose because it manages the container lifecycle within Vitest's own process — no external `docker compose up` needed.

### Acceptance Criteria

- [ ] `npm run test:integration` starts a LocalStack container automatically
- [ ] All 6 DynamoDB tables are created before tests run
- [ ] `clearTable` successfully removes all items from a table
- [ ] `getTestDynamoDBClient()` returns a working client connected to LocalStack
- [ ] `seedItem` successfully writes an item that can be read back
- [ ] Container is stopped after tests complete (even if tests fail)
- [ ] `npm run test:unit` does NOT start a container
- [ ] Tests timeout is set to 30s, hook timeout to 60s
- [ ] No `any` type in test helpers

---

## Task 1.8 — Health Endpoint ✅ COMPLETED

> Updated `src/handler/health.ts` to use `inject().Config()` and `inject().DynamoDBClient()`, returning `{ status, stage, timestamp }` on 200 or `{ status: "error", message }` on 500. Updated `serverless.yml` with proper service name, all env var declarations, DynamoDB table resources (Collections, UserFlowers with DeviceIndex GSI, WateringEvents, SensorReadings with TTL, Devices, PairingCodes with TTL).

**Depends on:** 1.6

**Files to create:**
```
src/handler/
└── health.ts
```

**Files to modify:**
```
serverless.yml (add health function)
```

### Prompt

```
Create a health check endpoint that verifies the application can start, load configuration, and connect to DynamoDB. This is the first end-to-end handler and serves as a reference implementation for the handler pattern.

=== File: src/handler/health.ts ===

import { APIGatewayProxyHandler, APIGatewayProxyResult } from "aws-lambda";
import { inject } from "../bootstrap/inject";

Handler: GET /health

Implementation:
1. Call inject().Config() to verify config loads
2. Call inject().DynamoDBClient() to verify DynamoDB client initializes
3. Return 200 with body:
   {
     "status": "ok",
     "stage": config.STAGE,
     "timestamp": new Date().toISOString()
   }
4. If any step fails, return 500 with body:
   {
     "status": "error",
     "message": "Service unhealthy"
   }
   (Do NOT expose internal error details in the response)

Export: export const handler: APIGatewayProxyHandler = async (event) => { ... }

=== Modify: serverless.yml ===

Add function:
  health:
    handler: src/handler/health.handler
    events:
      - httpApi:
          path: /health
          method: GET

This endpoint has NO authentication — it must be accessible without a JWT.

Response headers:
- Content-Type: application/json

IMPORTANT:
- This handler is intentionally simple — no service layer, just DI verification
- It serves as the pattern for how handlers call inject() and return APIGatewayProxyResult
- Do NOT use "any" type
```

### Description

The health endpoint is the first "full stack" test of the framework: Serverless function → handler → DI container → Config → DynamoDB client. If this works, the foundation is solid.

It also serves as the simplest reference implementation for the handler pattern that will be used in all subsequent handlers.

### Acceptance Criteria

- [ ] `GET /health` returns 200 with status "ok" when everything is configured
- [ ] Response includes `stage` and `timestamp`
- [ ] If Config fails to load, returns 500 (not an unhandled exception)
- [ ] No authentication required
- [ ] Response Content-Type is application/json
- [ ] Handler uses `inject()` pattern consistently
- [ ] No `any` type

---

# PHASE 2 — Core Domain

This phase implements the primary user-facing entities: UserFlowers and Collections, plus the Auth0 JWT middleware.

---

## Task 2.1 — Auth0 JWT Middleware ✅ COMPLETED

> Created `src/module/auth/extract-user-id.ts` (extracts `sub` claim from API Gateway v2 JWT authorizer context) and `src/module/auth/jwt.middleware.ts` (local-dev JWT verification via `jose` using JWKS endpoint). `extractUserId` throws `UnauthorizedError` for missing/invalid claims.

**Depends on:** 1.3, 1.5, 1.6

**Files to create:**
```
src/module/auth/
├── jwt.middleware.ts
└── extract-user-id.ts
```

### Prompt

```
Create the Auth0 JWT verification middleware for the User API. This middleware extracts the userId (Auth0 sub claim) from the Authorization header and makes it available to handlers.

=== File 1: src/module/auth/extract-user-id.ts ===

A pure function that extracts userId from an API Gateway event. This is used by handlers — NOT a middleware in the traditional sense (Lambda doesn't have middleware). Instead, handlers call this function at the top.

import { APIGatewayProxyEventV2 } from "aws-lambda";

export function extractUserId(event: APIGatewayProxyEventV2): string {
  // API Gateway HTTP API v2 with JWT authorizer puts claims in:
  // event.requestContext.authorizer.jwt.claims.sub
  
  // Extract the "sub" claim
  // If missing, throw UnauthorizedError
  // Return the sub claim as a string
}

NOTE: When using API Gateway HTTP API with a JWT authorizer, the JWT is already verified by API Gateway. We do NOT need to verify it again in the Lambda. API Gateway handles token validation, signature verification, audience/issuer checks, and expiration. The Lambda just reads the claims.

=== File 2: src/module/auth/jwt.middleware.ts ===

For local development and testing, create a function that can verify JWTs manually (when not behind API Gateway):

import { Config } from "../config/Config";

export interface JwtPayload {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
}

export async function verifyJwt(token: string, config: Config): Promise<JwtPayload> {
  // Use jwks-rsa to fetch signing keys from Auth0
  // Verify the token against the JWKS endpoint: https://${config.AUTH0_DOMAIN}/.well-known/jwks.json
  // Validate audience matches config.AUTH0_AUDIENCE
  // Validate issuer matches https://${config.AUTH0_DOMAIN}/
  // Return decoded payload
  // Throw UnauthorizedError on any failure
}

This is a fallback for when running with serverless-offline (local development). In production, API Gateway handles JWT verification.

IMPORTANT:
- In production handlers, use extractUserId() — it reads already-verified claims from API Gateway context
- verifyJwt() is only for local dev / serverless-offline / testing
- Do NOT use "any" — define JwtPayload interface properly
- Import errors from src/module/errors
```

### Description

The separation between `extractUserId` (production) and `verifyJwt` (local dev) is important. In production, API Gateway's built-in JWT authorizer handles all cryptographic verification before the Lambda even runs. Re-verifying in the Lambda would waste time and add a dependency on the JWKS endpoint.

The `extractUserId` function is intentionally simple — it just reads from the event context. This keeps handlers thin.

### Acceptance Criteria

- [ ] `extractUserId` returns the `sub` claim from API Gateway v2 event context
- [ ] `extractUserId` throws `UnauthorizedError` when claims are missing
- [ ] `verifyJwt` validates token against Auth0 JWKS
- [ ] `verifyJwt` rejects expired tokens
- [ ] `verifyJwt` rejects tokens with wrong audience
- [ ] `JwtPayload` interface has all standard JWT claims typed
- [ ] No `any` type

---

## Task 2.2 — UserFlowers Module ✅ COMPLETED

> Created `UserFlowerSchema`/types in `src/types/entities/user-flower.ts`, API request/response schemas in `src/types/api/user-flowers.api.ts`. Implemented `UserFlowersRepository` (extends `BaseRepository<UserFlower>`, GSI query for `findByDeviceId`, null-deviceId omission for GSI key safety) and `UserFlowersService` (CRUD, settings merge, snapshot updates, userId stripped from responses). Factories registered in `src/bootstrap/inject.ts`. Handlers in `src/handler/user-flowers.ts`. Unit tests (11) and integration tests (7) all pass.

**Files to create:**
```
handler/
├── user-flowers.ts

src/module/user-flowers/
├── user-flowers.repository.ts
├── user-flowers.service.ts

src/bootstrap/factory/module/
├── user-flowers-repository.factory.ts
└── user-flowers-service.factory.ts

tests/unit/
└── user-flowers.service.test.ts

tests/integration/
└── user-flowers.integration.test.ts
```

**Files to modify:**
```
src/bootstrap/inject.ts (add UserFlowers factories)
serverless.yml (add UserFlowers endpoints)
```

### Prompt

```
Implement the UserFlowers module: repository, service, handler, factories, and tests. UserFlower is the central entity — a plant owned by a user with sensor data, watering settings, and optional device pairing.

=== Repository: src/module/user-flowers/user-flowers.repository.ts ===

Extends BaseRepository<UserFlower>.

Constructor receives: DynamoDBDocumentClient, tableName (string)

Methods:
1. findByUser(userId: string): Promise<UserFlower[]>
   - query PK = userId, returns all flowers

2. findOne(userId: string, userFlowerId: string): Promise<UserFlower | null>
   - get by PK = userId, SK = userFlowerId

3. findByDeviceId(deviceId: string): Promise<UserFlower | null>
   - query GSI "DeviceIndex", PK = deviceId, limit 1
   - Returns first result or null

4. create(flower: UserFlower): Promise<void>
   - put with PK = userId, SK = userFlowerId, plus all fields

5. update(userId: string, userFlowerId: string, fields: Partial<UserFlower>): Promise<UserFlower>
   - Build dynamic UpdateExpression from the fields object
   - Always set updatedAt to current timestamp
   - Return updated item
   - IMPORTANT: build SET expression dynamically — do NOT hardcode field names. Iterate over the fields object, skip userId/userFlowerId (key fields), generate "SET #field1 = :val1, #field2 = :val2, ..."

6. remove(userId: string, userFlowerId: string): Promise<void>
   - delete by PK, SK

7. batchGetByIds(userId: string, userFlowerIds: string[]): Promise<UserFlower[]>
   - Use base batchGet with keys: userFlowerIds.map(id => ({ PK: userId, SK: id }))

=== Service: src/module/user-flowers/user-flowers.service.ts ===

Constructor receives: UserFlowersRepository, Logger

Methods:

1. create(userId: string, request: CreateUserFlowerRequest): Promise<UserFlowerResponse>
   - Generate userFlowerId: "uf_" + ulid()
   - Merge request.settings with WateringSettingsSchema defaults
   - Set createdAt/updatedAt to now
   - Call repository.create()
   - Return mapped response (exclude userId)

2. list(userId: string): Promise<UserFlowerListResponse>
   - Call repository.findByUser(userId)
   - Map to response objects

3. getOne(userId: string, userFlowerId: string): Promise<UserFlowerResponse>
   - Call repository.findOne()
   - Throw NotFoundError if null
   - Map to response

4. update(userId: string, userFlowerId: string, request: UpdateUserFlowerRequest): Promise<UserFlowerResponse>
   - Verify flower exists (throw NotFoundError if not)
   - Call repository.update() with only the provided fields
   - If request.settings is provided, merge with existing settings (partial update)
   - Map to response

5. remove(userId: string, userFlowerId: string): Promise<void>
   - Verify flower exists
   - Call repository.remove()
   - NOTE: In Phase 4, this should also unpair device and remove from collections. For now, just delete.

6. updateSnapshot(userId: string, userFlowerId: string, snapshot: { lastMoisturePercent?: number; lastReadingAt?: string; lastWateredAt?: string }): Promise<void>
   - Internal method called by WateringService and SensorReadingsService
   - Calls repository.update() with only the snapshot fields

Private helper:
- toResponse(flower: UserFlower): UserFlowerResponse — maps entity to response (strips userId)

=== Handler: src/handler/user-flowers.ts ===

Thin handlers that parse input, validate with Zod, call service, and return HTTP responses.

Export these handler functions:

1. createUserFlower: APIGatewayProxyHandler
   - Extract userId from event (extractUserId)
   - Parse and validate body with CreateUserFlowerRequestSchema.safeParse()
   - If validation fails, return 400 with Zod error details
   - Call service.create(userId, parsed.data)
   - Return 201 with response body

2. listUserFlowers: APIGatewayProxyHandler
   - Extract userId
   - Call service.list(userId)
   - Return 200

3. getUserFlower: APIGatewayProxyHandler
   - Extract userId
   - Extract userFlowerId from event.pathParameters
   - Call service.getOne(userId, userFlowerId)
   - Return 200

4. updateUserFlower: APIGatewayProxyHandler
   - Extract userId, userFlowerId
   - Validate body with UpdateUserFlowerRequestSchema
   - Call service.update()
   - Return 200

5. deleteUserFlower: APIGatewayProxyHandler
   - Extract userId, userFlowerId
   - Call service.remove()
   - Return 204 with empty body

All handlers must use a shared error handler function:
- handleError(error: unknown): APIGatewayProxyResult
  - If error instanceof AppError → return { statusCode: error.statusCode, body: JSON.stringify({ code: error.code, message: error.message }) }
  - Else → log the error, return 500 with generic message

Create this handleError in a shared file: src/handler/error-handler.ts — it will be reused by ALL handlers.

Each handler wraps its entire body in try/catch and delegates to handleError in the catch block.

=== Factories ===

Create UserFlowersRepositoryFactory (depends on: DynamoDBClientFactory, ConfigFactory):
  - _make(): creates new UserFlowersRepository(client, config.USER_FLOWERS_TABLE)

Create UserFlowersServiceFactory (depends on: UserFlowersRepositoryFactory, LoggerFactory):
  - _make(): creates new UserFlowersService(repository, logger)

=== inject.ts ===

Add:
- UserFlowersRepository factory
- UserFlowersService factory
Register them in the inject() return object.

=== serverless.yml ===

Add functions:
  createUserFlower:
    handler: src/handler/user-flowers.createUserFlower
    events:
      - httpApi:
          path: /api/v1/user-flowers
          method: POST
          authorizer: auth0Authorizer

  listUserFlowers:
    handler:src/handler/user-flowers.listUserFlowers
    events:
      - httpApi:
          path: /api/v1/user-flowers
          method: GET
          authorizer: auth0Authorizer

  getUserFlower:
    handler: src/handler/user-flowers.getUserFlower
    events:
      - httpApi:
          path: /api/v1/user-flowers/{userFlowerId}
          method: GET
          authorizer: auth0Authorizer

  updateUserFlower:
    handler: src/handler/user-flowers.updateUserFlower
    events:
      - httpApi:
          path: /api/v1/user-flowers/{userFlowerId}
          method: PATCH
          authorizer: auth0Authorizer

  deleteUserFlower:
    handler: src/handler/user-flowers.deleteUserFlower
    events:
      - httpApi:
          path: /api/v1/user-flowers/{userFlowerId}
          method: DELETE
          authorizer: auth0Authorizer

=== Unit Tests: tests/unit/user-flowers.service.test.ts ===

Test the service layer with mocked repository. Use vitest mock:

Test cases:
1. create — should generate userFlowerId with "uf_" prefix, merge settings defaults, call repository.create
2. create — should use default settings when none provided
3. list — should return mapped responses without userId
4. getOne — should throw NotFoundError when flower doesn't exist
5. getOne — should return mapped response when found
6. update — should throw NotFoundError when flower doesn't exist
7. update — should call repository.update with only provided fields
8. update — should merge partial settings with existing settings
9. remove — should throw NotFoundError when flower doesn't exist
10. remove — should call repository.remove
11. updateSnapshot — should call repository.update with snapshot fields only

=== Integration Tests: tests/integration/user-flowers.integration.test.ts ===

Test against LocalStack DynamoDB:

beforeEach: clear the UserFlowers table

Test cases:
1. Create a flower and retrieve it — verify all fields
2. List flowers for a user — should return only that user's flowers
3. Update flower name — verify name changed, updatedAt changed, other fields unchanged
4. Update flower settings partially — verify only changed settings updated, rest preserved
5. Delete flower — verify it's gone
6. Get non-existent flower — should throw NotFoundError
7. findByDeviceId — seed a flower with deviceId, verify GSI query works

Do NOT use "any" type anywhere in tests. Create typed test fixtures.
```

### Description

This is the largest single task and establishes the pattern for all subsequent domain modules. The handler pattern (parse → validate → service call → response), the service pattern (business logic + response mapping), and the repository pattern (BaseRepository extension) are all demonstrated here.

The dynamic `update` method on the repository is particularly important — it builds the UpdateExpression from whatever fields are provided, avoiding separate update methods for each field combination. This pattern is reused by all other repositories.

### Acceptance Criteria

- [ ] All 5 CRUD endpoints work correctly (create returns 201, delete returns 204, etc.)
- [ ] Zod validation rejects invalid requests with 400 and descriptive errors
- [ ] NotFoundError is correctly thrown and mapped to 404
- [ ] `createUserFlower` generates a unique `userFlowerId` with "uf_" prefix
- [ ] Default watering settings are applied when not provided in create request
- [ ] Partial settings update preserves non-updated settings
- [ ] Response objects never contain `userId`
- [ ] `handleError` in error-handler.ts correctly maps all AppError subclasses
- [ ] All unit tests pass
- [ ] All integration tests pass against LocalStack
- [ ] Factories are registered in inject.ts
- [ ] Serverless functions are defined in serverless.yml
- [ ] No `any` type anywhere
- [ ] `npm run tsc` passes
- [ ] `npm run lint` passes

---

## Task 2.3 — Collections Module ✅ COMPLETED

> Created `CollectionSchema`/types in `src/types/entities/collection.ts`, API schemas in `src/types/api/collections.api.ts`. Implemented `CollectionsRepository` (findByUser, findOne, findDefault, CRUD) and `CollectionsService` (create, list with auto-default-collection on empty, getDetail with batch-get enrichment, update, remove with ValidationError guard for default, addFlower idempotent, removeFlower, ensureDefaultCollection). Factories registered in `src/bootstrap/inject.ts`. Handlers in `src/handler/collections.ts`. Unit tests (10) and integration tests (6) all pass.

**Depends on:** 2.2 (needs UserFlowersRepository for batch-get enrichment)

**Files to create:**
```
src/module/collections/
├── collections.repository.ts
├── collections.service.ts
└── collections.handler.ts

src/bootstrap/factory/module/
├── collections-repository.factory.ts
└── collections-service.factory.ts

tests/unit/
└── collections.service.test.ts

tests/integration/
└── collections.integration.test.ts
```

**Files to modify:**
```
src/bootstrap/inject.ts
serverless.yml
```

### Prompt

```
Implement the Collections module. A Collection is a named group of UserFlowers owned by a user. Collections store an array of userFlowerIds. When a collection is fetched with detail, the flowers are enriched via batch-get from the UserFlowers table.

=== Repository: src/module/collections/collections.repository.ts ===

Extends BaseRepository<Collection>.

Methods:
1. findByUser(userId: string): Promise<Collection[]>
2. findOne(userId: string, collectionId: string): Promise<Collection | null>
3. create(collection: Collection): Promise<void>
4. update(userId: string, collectionId: string, fields: Partial<Collection>): Promise<Collection>
   - Dynamic UpdateExpression, same pattern as UserFlowersRepository
5. remove(userId: string, collectionId: string): Promise<void>
6. findDefault(userId: string): Promise<Collection | null>
   - query PK = userId with filterExpression "isDefault = :true"
   - Return first result or null

=== Service: src/module/collections/collections.service.ts ===

Constructor: CollectionsRepository, UserFlowersRepository, Logger

Methods:

1. create(userId: string, request: CreateCollectionRequest): Promise<CollectionResponse>
   - Generate collectionId: "col_" + ulid()
   - Set isDefault: false, userFlowerIds: []
   - Set timestamps

2. list(userId: string): Promise<CollectionListResponse>
   - If user has no collections, call ensureDefaultCollection first
   - Return all collections

3. getDetail(userId: string, collectionId: string): Promise<CollectionDetailResponse>
   - Fetch collection, throw NotFoundError if not found
   - If userFlowerIds is non-empty, call userFlowersRepository.batchGetByIds(userId, userFlowerIds)
   - Map flowers to UserFlowerResponse
   - Return collection with enriched flowers array

4. update(userId: string, collectionId: string, request: UpdateCollectionRequest): Promise<CollectionResponse>
   - Verify exists
   - Prevent updating isDefault to false on the default collection
   - Prevent deleting the default collection
   - Call repository.update

5. remove(userId: string, collectionId: string): Promise<void>
   - Verify exists
   - If collection.isDefault, throw ValidationError("Cannot delete default collection")
   - Call repository.remove
   - NOTE: This does NOT delete the flowers in the collection — just the grouping

6. addFlower(userId: string, collectionId: string, userFlowerId: string): Promise<CollectionResponse>
   - Verify collection exists
   - Verify flower exists (call userFlowersRepository.findOne)
   - If userFlowerId already in userFlowerIds, return as-is (idempotent)
   - Append to userFlowerIds array
   - Call repository.update

7. removeFlower(userId: string, collectionId: string, userFlowerId: string): Promise<CollectionResponse>
   - Verify collection exists
   - Filter out userFlowerId from array
   - Call repository.update

8. ensureDefaultCollection(userId: string): Promise<void>
   - Call repository.findDefault(userId)
   - If exists, return
   - If not, create default collection with name "My Collection", isDefault: true

=== Handler: src/module/collections/collections.handler.ts ===

Export handlers:
1. createCollection: POST /api/v1/collections → 201
2. listCollections: GET /api/v1/collections → 200
3. getCollection: GET /api/v1/collections/{collectionId} → 200 (returns detail with flowers)
4. updateCollection: PATCH /api/v1/collections/{collectionId} → 200
5. deleteCollection: DELETE /api/v1/collections/{collectionId} → 204
6. addFlowerToCollection: POST /api/v1/collections/{collectionId}/flowers/{userFlowerId} → 200
7. removeFlowerFromCollection: DELETE /api/v1/collections/{collectionId}/flowers/{userFlowerId} → 200

All handlers follow the same pattern as UserFlowers: extractUserId → validate → service → respond. Use the shared handleError.

=== Factories, inject.ts, serverless.yml ===

Follow the same pattern as Task 2.2:
- CollectionsRepositoryFactory depends on DynamoDBClientFactory + ConfigFactory
- CollectionsServiceFactory depends on CollectionsRepositoryFactory + UserFlowersRepositoryFactory + LoggerFactory
- Register in inject.ts
- Add all 7 functions to serverless.yml with auth0Authorizer

=== Tests ===

Unit tests (collections.service.test.ts):
1. create — generates collectionId with "col_" prefix
2. list — calls ensureDefaultCollection if no collections exist
3. getDetail — returns enriched flowers via batch-get
4. getDetail — returns empty flowers array when userFlowerIds is empty (no batch-get call)
5. remove — throws ValidationError when trying to delete default collection
6. addFlower — is idempotent (adding same flower twice doesn't duplicate)
7. addFlower — throws NotFoundError when flower doesn't exist
8. removeFlower — removes flowerId from array
9. ensureDefaultCollection — creates default only when none exists
10. ensureDefaultCollection — does nothing when default already exists

Integration tests (collections.integration.test.ts):
1. Create collection and retrieve it
2. Add flower to collection, get detail → verify flower data is enriched
3. Remove flower from collection → verify it's removed but flower still exists
4. Default collection auto-created on first list call
5. Cannot delete default collection → returns 400
6. Delete non-default collection → succeeds

Do NOT use "any" type anywhere.
```

### Description

Collections are the user-facing grouping mechanism. The key complexity is the `getDetail` method that enriches flower IDs into full flower objects via batch-get. This is where the architectural decision to use IDs + batch-get pays off — the batch-get is efficient (up to 100 items in a single DynamoDB call) and avoids data duplication.

The `ensureDefaultCollection` is called lazily on first `list` call rather than eagerly at user registration. This avoids the need for a registration webhook and simplifies the flow.

### Acceptance Criteria

- [ ] All 7 endpoints work correctly
- [ ] Default collection is auto-created on first list call
- [ ] Cannot delete default collection (returns 400)
- [ ] getDetail returns enriched flower data
- [ ] getDetail with empty collection returns empty flowers array (no unnecessary batch-get)
- [ ] addFlower is idempotent
- [ ] addFlower validates that the flower exists
- [ ] removeFlower removes from collection but doesn't delete the flower
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] No `any` type anywhere
- [ ] `npm run tsc` and `npm run lint` pass

---

# PHASE 3 — Watering & Sensors

---

## Task 3.1 — Watering Module ✅ COMPLETED

> Created `WateringEventSchema`/types in `src/types/entities/watering-event.ts`, API schemas in `src/types/api/watering.api.ts`. Implemented `WateringRepository` (create, getHistory with optional from/to range + pagination, getLatest) and `WateringService` (recordManualWatering with ownership check + snapshot update, recordDeviceWatering for Phase 4, getHistory with base64 cursor pagination). Factories registered in `src/bootstrap/inject.ts`. Handlers `recordWatering` (POST, 201) and `getWateringHistory` (GET) in `src/handler/watering.ts`. Unit tests (4) and integration tests (4) all pass.

**Depends on:** 2.2

**Files to create:**
```
src/handler/
└── watering.ts

src/module/watering/
├── watering.repository.ts
├── watering.service.ts

src/bootstrap/factory/module/
├── watering-repository.factory.ts
└── watering-service.factory.ts

tests/unit/
└── watering.service.test.ts

tests/integration/
└── watering.integration.test.ts
```

**Files to modify:**
```
src/bootstrap/inject.ts
serverless.yml
```

### Prompt

```
Implement the Watering module. WateringEvents are historical records of watering actions. The User API only allows "manual" source watering (user marks "I watered my plant"). Device-originated events (auto, scheduled, force) come through the Device API (Phase 4).

=== Repository: src/module/watering/watering.repository.ts ===

Extends BaseRepository<WateringEvent>.

Methods:
1. create(event: WateringEvent): Promise<void>
   - put with PK = userFlowerId, SK = timestamp

2. getHistory(userFlowerId: string, options?: { limit?: number; exclusiveStartKey?: Record<string, unknown>; from?: string; to?: string }): Promise<PaginatedResult<WateringEvent>>
   - query PK = userFlowerId
   - If from/to provided: SK BETWEEN :from AND :to
   - ScanIndexForward: false (newest first)
   - Apply limit and exclusiveStartKey for pagination

3. getLatest(userFlowerId: string): Promise<WateringEvent | null>
   - query PK = userFlowerId, ScanIndexForward: false, Limit: 1
   - Return first item or null

=== Service: src/module/watering/watering.service.ts ===

Constructor: WateringRepository, UserFlowersService, Logger

Methods:

1. recordManualWatering(userId: string, userFlowerId: string, request: CreateWateringEventRequest): Promise<WateringEventResponse>
   - Verify flower belongs to user (call userFlowersService.getOne — throws NotFoundError if not found)
   - Create WateringEvent with:
     - source: "manual"
     - timestamp: now
     - durationSeconds from request (default 0)
     - moistureBeforePercent: null (manual watering doesn't know sensor state)
     - deviceId: null
   - Call repository.create()
   - Update flower snapshot: call userFlowersService.updateSnapshot(userId, userFlowerId, { lastWateredAt: timestamp })
   - Return response

2. recordDeviceWatering(userFlowerId: string, userId: string, request: DeviceSubmitWateringRequest, deviceId: string): Promise<void>
   - This is called by DeviceService (Phase 4), NOT exposed via User API handler
   - Create WateringEvent with source, duration, moisture data from request
   - Call repository.create()
   - Update flower snapshot: lastWateredAt

3. getHistory(userId: string, userFlowerId: string, query: { limit?: number; exclusiveStartKey?: string }): Promise<WateringHistoryResponse>
   - Verify flower belongs to user
   - Decode exclusiveStartKey from base64 if provided
   - Call repository.getHistory()
   - Encode lastEvaluatedKey to base64 for response
   - Return response

=== Handler: src/handler/watering.ts ===

Export handlers:
1. recordWatering: POST /api/v1/user-flowers/{userFlowerId}/watering → 201
   - Validate body with CreateWateringEventRequestSchema
   - Call service.recordManualWatering()

2. getWateringHistory: GET /api/v1/user-flowers/{userFlowerId}/watering → 200
   - Read query params: limit, exclusiveStartKey
   - Call service.getHistory()

=== Factories, inject.ts, serverless.yml ===

Same pattern. WateringServiceFactory depends on WateringRepositoryFactory + UserFlowersServiceFactory + LoggerFactory.
Add 2 functions to serverless.yml with auth0Authorizer.

=== Tests ===

Unit tests:
1. recordManualWatering — creates event with source "manual" and updates snapshot
2. recordManualWatering — throws NotFoundError when flower doesn't belong to user
3. getHistory — returns paginated results newest first
4. getHistory — decodes/encodes pagination key correctly

Integration tests:
1. Record manual watering and verify it appears in history
2. Record multiple waterings and verify pagination works (limit 2, then next page)
3. Verify flower's lastWateredAt is updated after recording watering
4. History returns newest first

Do NOT use "any" type.
```

### Description

The watering module has two entry points: the User API (manual watering) and the Device API (auto/scheduled/force watering). This task implements the core logic and the User API handler. The Device API handler is wired in Phase 4, but the service method `recordDeviceWatering` is implemented now to keep the logic centralized.

The pagination uses base64-encoded DynamoDB keys in the API. This is a common pattern for cursor-based pagination — the client doesn't need to understand DynamoDB key structure, they just pass the opaque cursor back.

### Acceptance Criteria

- [ ] Manual watering creates a WateringEvent with source "manual"
- [ ] Recording watering updates flower's `lastWateredAt` snapshot
- [ ] History is returned newest-first
- [ ] Pagination works correctly with encoded cursors
- [ ] Flower ownership is verified (throws NotFoundError for wrong user)
- [ ] All unit and integration tests pass
- [ ] No `any` type

---

## Task 3.2 — Sensor Readings Module ✅ COMPLETED

> Created `SensorReadingSchema`/types in `src/types/entities/sensor-reading.ts`, API schemas in `src/types/api/sensor-readings.api.ts`. Implemented `SensorReadingsRepository` (create with TTL, getByTimeRange with SK BETWEEN oldest-first, getLatest) and `SensorReadingsService` (recordReading calculates epoch TTL from config, getReadings defaults 24h window, base64 cursor pagination, flower ownership check). Factories registered in `src/bootstrap/inject.ts`. Handler `getSensorReadings` (GET only — no user POST endpoint) in `src/handler/sensor-readings.ts`. Unit tests (4) and integration tests (4) all pass.

**Depends on:** 2.2

**Files to create:**
```
src/handler/
└── sensor-readings.ts

src/module/sensor-readings/
├── sensor-readings.repository.ts
├── sensor-readings.service.ts

src/bootstrap/factory/module/
├── sensor-readings-repository.factory.ts
└── sensor-readings-service.factory.ts

tests/unit/
└── sensor-readings.service.test.ts

tests/integration/
└── sensor-readings.integration.test.ts
```

**Files to modify:**
```
src/bootstrap/inject.ts
serverless.yml
```

### Prompt

```
Implement the Sensor Readings module. SensorReadings are high-frequency time-series data from ESP32 devices. They have a TTL — old readings are automatically deleted by DynamoDB.

=== Repository: src/module/sensor-readings/sensor-readings.repository.ts ===

Extends BaseRepository<SensorReading>.

Methods:

1. create(reading: SensorReading): Promise<void>
   - put with PK = userFlowerId, SK = timestamp
   - Include ttl field (calculated by service)

2. getByTimeRange(userFlowerId: string, from: string, to: string, options?: { limit?: number; exclusiveStartKey?: Record<string, unknown> }): Promise<PaginatedResult<SensorReading>>
   - query PK = userFlowerId, SK BETWEEN :from AND :to
   - ScanIndexForward: true (oldest first — for charting)
   - Apply limit and pagination

3. getLatest(userFlowerId: string): Promise<SensorReading | null>
   - query PK = userFlowerId, ScanIndexForward: false, Limit: 1

=== Service: src/module/sensor-readings/sensor-readings.service.ts ===

Constructor: SensorReadingsRepository, UserFlowersService, ConfigFactory (for TTL days), Logger

Methods:

1. recordReading(userFlowerId: string, userId: string, moisturePercent: number, rawValue: number, deviceId: string): Promise<void>
   - This is called by DeviceService (Phase 4), NOT exposed directly to users
   - Create SensorReading with:
     - timestamp: now
     - ttl: Math.floor(Date.now() / 1000) + config.SENSOR_READINGS_TTL_DAYS * 86400
   - Call repository.create()
   - Update flower snapshot: lastMoisturePercent = moisturePercent, lastReadingAt = timestamp

2. getReadings(userId: string, userFlowerId: string, query: GetSensorReadingsQuery): Promise<SensorReadingsListResponse>
   - Verify flower belongs to user
   - Default "from" to 24 hours ago if not provided
   - Default "to" to now if not provided
   - Decode exclusiveStartKey from base64 if provided
   - Call repository.getByTimeRange()
   - Encode lastEvaluatedKey to base64
   - Map to response

=== Handler: src/handler/sensor-readings.ts ===

Export handler:
1. getSensorReadings: GET /api/v1/user-flowers/{userFlowerId}/readings → 200
   - Parse query params using GetSensorReadingsQuerySchema.safeParse()
   - Call service.getReadings()

Note: There is NO handler for creating readings from the User API. Readings come only from devices (Phase 4).

=== Factories, inject.ts, serverless.yml ===

Same pattern. SensorReadingsServiceFactory depends on SensorReadingsRepositoryFactory + UserFlowersServiceFactory + ConfigFactory + LoggerFactory.
Add 1 function to serverless.yml with auth0Authorizer.

=== Tests ===

Unit tests:
1. recordReading — calculates TTL correctly (now + configured days)
2. recordReading — updates flower snapshot (lastMoisturePercent, lastReadingAt)
3. getReadings — defaults to 24h window when no from/to provided
4. getReadings — throws NotFoundError for non-existent flower

Integration tests:
1. Record readings, query by time range, verify data
2. Verify readings returned in chronological order (oldest first)
3. Verify pagination works
4. Verify flower snapshot is updated after recording

Do NOT use "any" type.
```

### Description

Sensor readings are the highest-write-volume table. The TTL ensures old data is cleaned up automatically without any cron job. The service calculates TTL as an epoch timestamp because that's what DynamoDB expects.

Note that readings are returned in chronological order (oldest first, `ScanIndexForward: true`) — this is optimized for charting. Watering history is newest-first (for reverse-chronological event lists).

### Acceptance Criteria

- [ ] Readings are stored with TTL field
- [ ] TTL is calculated as now + configured days (in epoch seconds)
- [ ] Readings are returned oldest-first (for charting)
- [ ] Default time range is 24 hours when not specified
- [ ] Flower snapshot is updated on each new reading
- [ ] Only GET endpoint exists — no POST for user API
- [ ] All tests pass
- [ ] No `any` type

---

# PHASE 4 — Device Integration

---

## Task 4.1 — Device Module (Repositories) ✅ COMPLETED

> Created `DevicesRepository` (single-PK table, CRUD + `updateLastSeen`) and `PairingRepository` (single-PK table, `putWithCondition` for collision-safe code creation) in `src/module/device/`. Factories `DevicesRepositoryFactory` and `PairingRepositoryFactory` registered in `src/bootstrap/inject.ts`.

**Depends on:** 1.4

**Files to create:**
```
src/module/device/
├── devices.repository.ts
└── pairing.repository.ts

src/bootstrap/factory/module/
├── devices-repository.factory.ts
└── pairing-repository.factory.ts
```

**Files to modify:**
```
src/bootstrap/inject.ts
```

### Prompt

```
Create the Device and PairingCode repositories. These are two separate DynamoDB tables with different key schemas.

=== File 1: src/module/device/devices.repository.ts ===

Extends BaseRepository<Device>.

The Devices table has ONLY a PK (deviceId) — no sort key.

Methods:
1. findByDeviceId(deviceId: string): Promise<Device | null>
   - get by PK = deviceId

2. create(device: Device): Promise<void>
   - put with PK = deviceId, all fields

3. updateLastSeen(deviceId: string): Promise<void>
   - update PK = deviceId, set lastSeenAt = now

4. remove(deviceId: string): Promise<void>
   - delete by PK = deviceId

=== File 2: src/module/device/pairing.repository.ts ===

Extends BaseRepository<PairingCode>.

The PairingCodes table has ONLY a PK (code) — no sort key. TTL handles auto-cleanup.

Methods:
1. findByCode(code: string): Promise<PairingCode | null>
   - get by PK = code

2. create(pairingCode: PairingCode): Promise<void>
   - putWithCondition to prevent code collision (condition: "attribute_not_exists(PK)")
   - If collision, let service regenerate

3. remove(code: string): Promise<void>
   - delete by PK = code

=== Factories ===

DevicesRepositoryFactory depends on DynamoDBClientFactory + ConfigFactory (DEVICES_TABLE).
PairingRepositoryFactory depends on DynamoDBClientFactory + ConfigFactory (PAIRING_CODES_TABLE).
Register both in inject.ts.

Do NOT use "any" type.
```

### Description

These repositories are simpler than the domain ones — single PK, no sort key. The PairingCode repository uses `putWithCondition` to prevent code collisions — if two users generate the same 6-character code simultaneously, one of them will fail and retry with a new code.

### Acceptance Criteria

- [ ] Devices repository CRUD works with single PK key
- [ ] PairingCode repository uses conditional put to prevent collisions
- [ ] Pairing code collision returns `{ success: false }` (not throws)
- [ ] Factories registered in inject.ts
- [ ] No `any` type

---

## Task 4.2 — Device Service & Handler ✅ COMPLETED

> Created `Device`/`PairingCode` entity types and full Device API schemas. `DeviceService` implements: `generatePairingCode` (6-char code with collision retry), `completePairing` (raw key returned once, SHA-256 hash stored), `authenticateByKey` (O(1) deviceId-prefix lookup + hash compare, fire-and-forget lastSeenAt), `submitReading`/`submitWatering`, `getConfig`, `forceWater` (appends `cmd_` ULID command to pendingCommands), `unpairDevice`. Added `getOneFull`/`updateDeviceFields` to `UserFlowersService` for internal use. All 8 endpoints in `src/handler/device.ts`. Unit tests (13) and integration tests (7) all pass.

**Depends on:** 4.1, 2.2, 3.1, 3.2

**Files to create:**
```
src/handler/
└── device.ts

src/module/device/
├── device.service.ts

src/module/auth/
└── device-key.middleware.ts

src/bootstrap/factory/module/
└── device-service.factory.ts

tests/unit/
└── device.service.test.ts

tests/integration/
└── device.integration.test.ts
```

**Files to modify:**
```
src/bootstrap/inject.ts
serverless.yml
```

### Prompt

```
Implement the Device service, auth middleware, and handlers. The Device API has a completely separate auth mechanism (API Key) from the User API (Auth0 JWT).

=== File 1: src/module/auth/device-key.middleware.ts ===

Extract and verify device API key from requests:

import { APIGatewayProxyEventV2 } from "aws-lambda";

export interface DeviceContext {
  deviceId: string;
  userFlowerId: string;
  userId: string;
}

export async function extractDeviceContext(event: APIGatewayProxyEventV2): Promise<DeviceContext>
   - Read "x-device-key" from event.headers (case-insensitive)
   - If missing, throw UnauthorizedError("Missing device key")
   - Call DeviceService.authenticateByKey(apiKey)
   - Return DeviceContext

Note: This function needs access to DeviceService via inject(). It's a function, not a class, but it uses DI internally.

=== File 2: src/module/device/device.service.ts ===

Constructor: DevicesRepository, PairingRepository, UserFlowersService, WateringService, SensorReadingsService, ConfigFactory, Logger

API Key format: "<deviceId>.<randomPart>" — the deviceId prefix allows single-read authentication.

Methods:

1. generatePairingCode(userId: string, userFlowerId: string): Promise<GeneratePairingCodeResponse>
   - Verify flower belongs to user (userFlowersService.getOne)
   - Verify flower doesn't already have a device paired (if flower.deviceId is not null, throw ConflictError)
   - Generate 6-character uppercase alphanumeric code
   - Calculate TTL: Math.floor(Date.now() / 1000) + config.PAIRING_CODE_TTL_MINUTES * 60
   - Try repository.create() — if collision (success: false), regenerate code (retry up to 5 times)
   - Return { code, expiresAt }

2. completePairing(request: DevicePairRequest): Promise<DevicePairResponse>
   - This endpoint is UNAUTHENTICATED (the device has no key yet)
   - Find pairing code: pairingRepository.findByCode(request.code)
   - If not found, throw NotFoundError("Pairing code")
   - If expired (check ttl against current epoch), throw GoneError("Pairing code has expired")
   - Generate API key: `${request.deviceId}.${crypto.randomBytes(32).toString('hex')}`
   - Hash the full API key using crypto.createHash('sha256')
   - Create Device record:
     - deviceId: request.deviceId
     - userFlowerId: from pairing code
     - userId: from pairing code
     - apiKeyHash: hashed key
     - pairedAt: now
     - lastSeenAt: now
   - Update UserFlower: set deviceId = request.deviceId
   - Delete pairing code (used up)
   - Return { apiKey: raw_key, userFlowerId, settings: flower.settings }
   - IMPORTANT: The raw API key is returned ONLY ONCE. After this, only the hash is stored.

3. authenticateByKey(apiKey: string): Promise<DeviceContext>
   - Parse deviceId from key: apiKey.split('.')[0]
   - If no deviceId part, throw UnauthorizedError
   - Fetch device by deviceId
   - If not found, throw UnauthorizedError (don't reveal if device exists)
   - Hash the provided key with SHA-256
   - Compare with stored apiKeyHash
   - If mismatch, throw UnauthorizedError
   - Update lastSeenAt (fire-and-forget, don't await — it's not critical)
   - Return { deviceId, userFlowerId, userId }

4. submitReading(deviceContext: DeviceContext, request: DeviceSubmitReadingRequest): Promise<void>
   - Call sensorReadingsService.recordReading(deviceContext.userFlowerId, deviceContext.userId, request.moisturePercent, request.rawValue, deviceContext.deviceId)

5. submitWatering(deviceContext: DeviceContext, request: DeviceSubmitWateringRequest): Promise<void>
   - Call wateringService.recordDeviceWatering(deviceContext.userFlowerId, deviceContext.userId, request, deviceContext.deviceId)
   - If request.commandId is provided, remove that command from flower's pendingCommands:
     - Fetch flower, filter out the command with matching commandId, update flower

6. getConfig(deviceContext: DeviceContext): Promise<DeviceConfigResponse>
   - Fetch flower by deviceContext.userFlowerId + userId
   - Return { settings: flower.settings, pendingCommands: flower.pendingCommands }

7. forceWater(userId: string, userFlowerId: string, request: ForceWaterRequest): Promise<ForceWaterResponse>
   - Verify flower belongs to user
   - Verify flower has a paired device (deviceId not null), throw ValidationError if no device
   - Create command: { commandId: "cmd_" + ulid(), type: "force_water", durationSeconds: request.durationSeconds, createdAt: now }
   - Append to flower's pendingCommands array
   - Return { commandId, status: "queued" }

8. unpairDevice(userId: string, userFlowerId: string): Promise<void>
   - Verify flower belongs to user
   - Get flower, if no deviceId, throw NotFoundError("Device")
   - Delete device record
   - Update flower: set deviceId = null, pendingCommands = []

9. getDeviceStatus(userId: string, userFlowerId: string): Promise<DeviceStatusResponse>
   - Verify flower belongs to user
   - Get flower, if no deviceId, throw NotFoundError("Device")
   - Fetch device record
   - Return status

Private helper:
- generateCode(): string — generates 6-char uppercase alphanumeric code
- hashApiKey(key: string): string — SHA-256 hash

=== File 3: src/handler/device.ts ===

Export handlers:

Device API (no auth0 authorizer, uses X-Device-Key):
1. pair: POST /device/v1/pair → 201
   - UNAUTHENTICATED endpoint
   - Validate body with DevicePairRequestSchema
   - Call service.completePairing()

2. submitReadings: POST /device/v1/readings → 201
   - Extract device context via extractDeviceContext
   - Validate body with DeviceSubmitReadingRequestSchema
   - Call service.submitReading()

3. submitWatering: POST /device/v1/watering → 201
   - Extract device context
   - Validate body with DeviceSubmitWateringRequestSchema
   - Call service.submitWatering()

4. getConfig: GET /device/v1/config → 200
   - Extract device context
   - Call service.getConfig()

User API (auth0 authorizer):
5. generatePairingCode: POST /api/v1/user-flowers/{userFlowerId}/pair → 201
   - Extract userId
   - Call service.generatePairingCode()

6. unpairDevice: DELETE /api/v1/user-flowers/{userFlowerId}/device → 204
   - Extract userId
   - Call service.unpairDevice()

7. getDeviceStatus: GET /api/v1/user-flowers/{userFlowerId}/device → 200
   - Extract userId
   - Call service.getDeviceStatus()

8. forceWater: POST /api/v1/user-flowers/{userFlowerId}/force-water → 202
   - Extract userId
   - Validate body with ForceWaterRequestSchema
   - Call service.forceWater()
   - Note: 202 Accepted (not 201) because the command is queued, not immediately executed

=== Factories, inject.ts, serverless.yml ===

DeviceServiceFactory depends on: DevicesRepositoryFactory, PairingRepositoryFactory, UserFlowersServiceFactory, WateringServiceFactory, SensorReadingsServiceFactory, ConfigFactory, LoggerFactory.

Register in inject.ts.

Add all 8 functions to serverless.yml. Device API functions do NOT have the auth0Authorizer. User API functions DO have it.

=== Tests ===

Unit tests (device.service.test.ts):
1. generatePairingCode — creates 6-char code, retries on collision
2. generatePairingCode — throws ConflictError when flower already has device
3. completePairing — full flow: finds code, creates device, links to flower, deletes code
4. completePairing — throws NotFoundError for invalid code
5. completePairing — throws GoneError for expired code
6. authenticateByKey — returns device context for valid key
7. authenticateByKey — throws UnauthorizedError for invalid key
8. authenticateByKey — throws UnauthorizedError for non-existent device
9. submitReading — delegates to sensorReadingsService.recordReading
10. submitWatering — records event and removes pending command
11. forceWater — appends command to pendingCommands
12. forceWater — throws ValidationError when no device paired
13. unpairDevice — deletes device and clears flower's deviceId

Integration tests (device.integration.test.ts):
1. Full pairing flow: generate code → complete pairing → verify device created and flower linked
2. Submit reading after pairing → verify sensor reading stored and snapshot updated
3. Force water → get config → verify command in pendingCommands → submit watering with commandId → verify command removed
4. Unpair → verify device deleted and flower's deviceId cleared
5. Authenticate with wrong key → verify UnauthorizedError
6. Expired pairing code → verify GoneError

Do NOT use "any" type.
Use crypto module for key generation and hashing (import { randomBytes, createHash } from "crypto").
```

### Description

This is the most complex task in the project. It wires together all previously built services (UserFlowers, Watering, SensorReadings) through the Device API. The key design decisions implemented here:

The API key format `<deviceId>.<random>` enables O(1) authentication — parse the deviceId, fetch the device record, compare hashes. No scanning needed.

The pairing flow is a one-time operation: the raw API key is returned exactly once during pairing. After that, only the SHA-256 hash is stored. If the ESP32 loses its key, the user must unpair and re-pair.

Force-watering commands are stored on the UserFlower record itself (`pendingCommands` array), not in a separate table. This is simple and works because commands are transient and always associated with a specific flower.

### Acceptance Criteria

- [ ] Full pairing flow works end-to-end
- [ ] API key is returned ONLY during pairing, hash stored in DB
- [ ] API key format is `<deviceId>.<random>`, authentication is single-read
- [ ] Expired pairing codes return 410 (GoneError)
- [ ] Pairing code collisions are retried automatically
- [ ] Device readings are stored and flower snapshot updated
- [ ] Device watering events are recorded
- [ ] Force-water commands appear in device config
- [ ] Submitting watering with commandId removes the command
- [ ] Unpairing deletes device and clears flower.deviceId
- [ ] Device API endpoints use X-Device-Key auth
- [ ] User API device endpoints use Auth0 JWT
- [ ] `POST /device/v1/pair` is unauthenticated
- [ ] Force-water returns 202 Accepted
- [ ] All unit and integration tests pass
- [ ] No `any` type
- [ ] `npm run tsc` and `npm run lint` pass

---

# PHASE 5 — CI/CD & Publishing

---

## Task 5.1 — GitHub Actions CI Pipeline

**Depends on:** All previous tasks

**Files to create:**
```
.github/workflows/
└── publish-types.yml
```

### Prompt

```
Create GitHub Actions workflows for CI and types publishing.

=== File: .github/workflows/publish-types.yml ===

Name: Publish Types
Trigger: push to main, paths: ["types/**"]

Jobs:

1. publish:
   - runs-on: ubuntu-latest
   - permissions: contents: read, packages: write
   - steps:
     - checkout
     - setup node 20 with registry-url: https://npm.pkg.github.com
     - cd types && npm ci
     - npm run build
     - npm version patch --no-git-tag-version
     - npm publish
     - env: NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

Notes:
- The publish workflow only triggers when files in types/ change
- It auto-bumps patch version before publishing
- Uses GITHUB_TOKEN (built-in) for authentication — no need for PAT
```

### Description

The CI pipeline runs in three stages: fast feedback (lint + typecheck), unit tests, and integration tests. Integration tests depend on lint passing to avoid wasting resources on code that doesn't compile.

The types publishing workflow is separate and only triggers on changes to the `types/` directory.

### Acceptance Criteria

- [ ] CI runs on every push and PR to main
- [ ] Lint and typecheck job catches type errors and lint violations
- [ ] Unit tests run without Docker
- [ ] Integration tests run with testcontainers (Docker available in GitHub Actions)
- [ ] Types package is published only when types/ changes
- [ ] Version is auto-bumped before publishing
- [ ] GITHUB_TOKEN is used for package registry auth

---

## Task 5.2 — DynamoDB Table Definitions Consolidation

**Depends on:** 1.7, all resource definitions in serverless.yml

**Files to create:**
```
src/module/db/
└── table-definitions.ts
```

**Files to modify:**
```
tests/integration/setup/tables.ts
serverless.yml
```

### Prompt

```
Consolidate DynamoDB table definitions into a single source of truth. Currently, table schemas are defined in two places: serverless.yml (for deployment) and tests/integration/setup/tables.ts (for LocalStack). This violates single source of truth.

Create: src/module/db/table-definitions.ts

This file exports table definitions as TypeScript objects that can be:
1. Used by tests to create tables in LocalStack (already works)
2. Referenced by documentation (single place to look)

The file should export:
- An interface TableDefinition describing a table's key schema, GSIs, and TTL config
- A const object TABLE_DEFINITIONS with all 6 tables
- A function toCreateTableInput(def: TableDefinition, tableName: string): CreateTableInput — converts to AWS SDK format

Modify tests/integration/setup/tables.ts:
- Import TABLE_DEFINITIONS and toCreateTableInput
- Use them instead of hardcoded definitions

Note: serverless.yml CloudFormation resources will remain as-is (YAML), but TABLE_DEFINITIONS serves as the authoritative reference for what those resources should look like. If someone modifies the YAML, the tests (using the same definitions) will catch any mismatches.

Do NOT use "any" type.
```

### Description

This is a consolidation task that reduces the risk of table definitions drifting between deployment and tests. While we can't generate serverless.yml from TypeScript directly, having a single TypeScript definition ensures tests match production.

### Acceptance Criteria

- [ ] All 6 table definitions are in table-definitions.ts
- [ ] Tests use the shared definitions (no hardcoded schemas in test setup)
- [ ] toCreateTableInput produces valid CreateTableInput objects
- [ ] Integration tests still pass after the refactor
- [ ] No `any` type

---

# Appendix A — Cross-Cutting Concerns Checklist

After all phases are complete, verify these cross-cutting requirements:

| Concern | Verification |
|---------|-------------|
| No `any` in codebase | `grep -r "any" src/ types/ tests/ --include="*.ts"` shows zero results (excluding comments and string literals) |
| No process.env outside Config.ts | `grep -rn "process.env" src/ --include="*.ts"` shows only Config.ts |
| All factories registered in inject.ts | Every factory has a corresponding entry in the inject() return object |
| All handlers use handleError | No handler has a catch block that doesn't delegate to handleError |
| All handlers validate input with Zod | Every POST/PATCH handler uses `.safeParse()` before calling service |
| All services throw AppError subclasses | No service throws raw Error or returns error codes |
| All repositories extend BaseRepository | No direct DynamoDB SDK usage outside BaseRepository |
| Types package exports everything | `import {} from "@.../autowatering-types"` can access all schemas and types |
| Tests cover all endpoints | Every serverless.yml function has at least one integration test |
| No business logic in handlers | Handlers only do: parse → validate → service call → map response |

---

# Appendix B — Entity Relationship Summary

```
User (Auth0)
 └── has many: UserFlower (PK: userId, SK: userFlowerId)
      ├── has one: Device (PK: deviceId) — optional, linked via UserFlower.deviceId
      ├── has many: WateringEvent (PK: userFlowerId, SK: timestamp)
      └── has many: SensorReading (PK: userFlowerId, SK: timestamp, TTL)
 └── has many: Collection (PK: userId, SK: collectionId)
      └── references many: UserFlower (via userFlowerIds array)

PairingCode (PK: code, TTL) — transient, links User+UserFlower to a pending Device pairing
```

---

# Appendix C — API Quick Reference

## User API (Auth: Auth0 JWT)

| Method | Path | Handler | Status |
|--------|------|---------|--------|
| GET | /health | health | 200 |
| POST | /api/v1/collections | createCollection | 201 |
| GET | /api/v1/collections | listCollections | 200 |
| GET | /api/v1/collections/:id | getCollection | 200 |
| PATCH | /api/v1/collections/:id | updateCollection | 200 |
| DELETE | /api/v1/collections/:id | deleteCollection | 204 |
| POST | /api/v1/collections/:id/flowers/:fid | addFlowerToCollection | 200 |
| DELETE | /api/v1/collections/:id/flowers/:fid | removeFlowerFromCollection | 200 |
| POST | /api/v1/user-flowers | createUserFlower | 201 |
| GET | /api/v1/user-flowers | listUserFlowers | 200 |
| GET | /api/v1/user-flowers/:id | getUserFlower | 200 |
| PATCH | /api/v1/user-flowers/:id | updateUserFlower | 200 |
| DELETE | /api/v1/user-flowers/:id | deleteUserFlower | 204 |
| POST | /api/v1/user-flowers/:id/watering | recordWatering | 201 |
| GET | /api/v1/user-flowers/:id/watering | getWateringHistory | 200 |
| POST | /api/v1/user-flowers/:id/force-water | forceWater | 202 |
| GET | /api/v1/user-flowers/:id/readings | getSensorReadings | 200 |
| POST | /api/v1/user-flowers/:id/pair | generatePairingCode | 201 |
| DELETE | /api/v1/user-flowers/:id/device | unpairDevice | 204 |
| GET | /api/v1/user-flowers/:id/device | getDeviceStatus | 200 |

## Device API (Auth: X-Device-Key)

| Method | Path | Handler | Status |
|--------|------|---------|--------|
| POST | /device/v1/pair | pair | 201 |
| POST | /device/v1/readings | submitReadings | 201 |
| POST | /device/v1/watering | submitWatering | 201 |
| GET | /device/v1/config | getConfig | 200 |

**Total: 24 endpoints (20 User API + 4 Device API)**
