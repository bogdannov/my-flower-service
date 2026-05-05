# Autowatering Backend — Implementation Tasks

This document contains a complete breakdown of all implementation tasks. Each task includes a self-contained prompt that can be handed to a developer or AI agent, a detailed description with context, acceptance criteria, and file references. Tasks are ordered to minimize blockers.

**Conventions used in this document:**

- `[DEPENDS: X.Y]` — this task cannot start until task X.Y is complete.
- `[FILES]` — lists every file that must be created or modified.
- `[PROMPT]` — a copy-pasteable instruction for execution.
- `[ACCEPTANCE CRITERIA]` — the definition of done; every item must pass.

---

# PHASE 1 — Foundation

This phase establishes the project scaffold, shared infrastructure, and testing setup. No business logic. Everything built here is consumed by all subsequent phases.

---

## Task 1.1 — Project Scaffold

**Depends on:** Nothing

**Files to create:**
```
autowatering-backend/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── .eslintrc.json
├── .prettierrc
├── .gitignore
├── .nvmrc
├── vitest.config.ts
├── docker-compose.yml
├── serverless.yml
├── src/
│   └── (empty, structure created in later tasks)
└── tests/
    └── (empty, structure created in later tasks)
```

### Prompt

```
Create the project scaffold for an autowatering IoT backend service.

Tech stack:
- Node.js 20 (set in .nvmrc)
- TypeScript 5.x (strict mode enabled)
- Serverless Framework v3 with serverless-esbuild plugin
- Vitest for testing
- ESLint + Prettier for code quality
- Docker Compose with LocalStack for integration tests

package.json requirements:
- name: "autowatering-backend"
- scripts:
  - "build": serverless package
  - "dev": serverless offline
  - "tsc": tsc --noEmit
  - "lint": eslint src/ tests/ --ext .ts
  - "lint:fix": eslint src/ tests/ --ext .ts --fix
  - "format": prettier --write .
  - "test": vitest run
  - "test:unit": vitest run tests/unit
  - "test:integration": vitest run tests/integration
  - "test:watch": vitest watch
- dependencies: @aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb, zod, ulid, jsonwebtoken, jwks-rsa
- devDependencies: typescript, vitest, eslint, prettier, @types/node, @types/aws-lambda, serverless, serverless-esbuild, esbuild, testcontainers, @aws-sdk/client-dynamodb (for test setup)

tsconfig.json:
- strict: true
- target: ES2022
- module: Node16
- moduleResolution: Node16
- outDir: dist
- rootDir: src
- esModuleInterop: true
- forceConsistentCasingInFileNames: true
- skipLibCheck: true
- declaration: true
- paths: { "@autowatering/types": ["./types/src"] }

tsconfig.build.json:
- extends tsconfig.json
- exclude: ["tests", "vitest.config.ts"]

.eslintrc.json:
- extends @typescript-eslint/recommended
- rules: no-explicit-any → error, no-unused-vars → error (with argsIgnorePattern _)

vitest.config.ts:
- include: ["tests/**/*.test.ts"]
- testTimeout: 30000

docker-compose.yml:
- service: localstack
- image: localstack/localstack:3
- ports: 4566:4566
- environment: SERVICES=dynamodb, DEFAULT_REGION=eu-central-1

serverless.yml (skeleton only, no functions yet):
- service: autowatering-backend
- provider:
  - name: aws
  - runtime: nodejs20.x
  - region: eu-central-1
  - stage: ${opt:stage, 'dev'}
  - architecture: arm64
  - httpApi with Auth0 authorizer placeholder
- plugins: serverless-esbuild
- custom.esbuild config for TypeScript bundling

.gitignore: node_modules, dist, .serverless, .esbuild, coverage, *.js (root level only), .env

Do NOT create any source files in src/ or tests/ — only the configuration files listed above. Make sure all configs are consistent with each other (paths, module resolution, etc).
```

### Description

This task creates the empty project with all tooling configured. It is critical that TypeScript strict mode, ESLint no-any rule, and the path alias for the types package are set up correctly from the start — these are enforced project-wide and affect every subsequent task.

The serverless.yml at this stage is a skeleton — functions and resources are added in later tasks. The Docker Compose file is minimal (DynamoDB only via LocalStack).

### Acceptance Criteria

- [ ] `npm install` completes without errors
- [ ] `npm run tsc` passes (no source files yet, should be trivially clean)
- [ ] `npm run lint` passes
- [ ] `docker compose up -d` starts LocalStack, port 4566 is accessible
- [ ] `docker compose down` shuts down cleanly
- [ ] TypeScript strict mode is enabled (`"strict": true`)
- [ ] ESLint rule `no-explicit-any` is set to `error`
- [ ] `.nvmrc` contains `20`

---

## Task 1.2 — Types Package

**Depends on:** 1.1

**Files to create:**
```
types/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── entities/
│   │   ├── index.ts
│   │   ├── user-flower.ts
│   │   ├── collection.ts
│   │   ├── watering-event.ts
│   │   ├── sensor-reading.ts
│   │   ├── device.ts
│   │   └── pairing-code.ts
│   ├── api/
│   │   ├── index.ts
│   │   ├── collections.api.ts
│   │   ├── user-flowers.api.ts
│   │   ├── watering.api.ts
│   │   ├── sensor-readings.api.ts
│   │   └── device.api.ts
│   └── enums/
│       └── index.ts
```

### Prompt

```
Create the types package for the autowatering backend. This package is the SINGLE SOURCE OF TRUTH for all domain types. It will be published as a GitHub Package and consumed by the backend itself, mobile app, and any future services.

All types MUST be defined as Zod schemas first, with TypeScript types inferred via z.infer<>. NEVER manually write a TypeScript interface that duplicates a Zod schema.

Package setup (types/package.json):
- name: "@anthropic-user/autowatering-types" (placeholder org)
- version: "0.1.0"
- main: "dist/index.js"
- types: "dist/index.d.ts"
- files: ["dist"]
- scripts: { "build": "tsc", "prepublishOnly": "npm run build" }
- publishConfig: { "registry": "https://npm.pkg.github.com" }
- peerDependencies: { "zod": "^3.0.0" }
- dependencies: { "zod": "^3.23.0" }

types/tsconfig.json:
- strict: true, target: ES2022, module: Node16, moduleResolution: Node16
- outDir: dist, rootDir: src, declaration: true, declarationMap: true

=== ENTITIES ===

1. types/src/entities/user-flower.ts:

WateringSettingsSchema:
  - wateringThresholdPercent: z.number().min(0).max(100).default(20)
  - wateringDurationSeconds: z.number().min(1).max(60).default(5)
  - checkIntervalSeconds: z.number().min(10).max(300).default(30)
  - scheduledWateringEnabled: z.boolean().default(false)
  - scheduledWateringTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null)

PendingCommandSchema:
  - commandId: z.string()
  - type: z.literal("force_water")
  - durationSeconds: z.number().min(1).max(60)
  - createdAt: z.string().datetime()

UserFlowerSchema:
  - userId: z.string().min(1)
  - userFlowerId: z.string().min(1)
  - customName: z.string().min(1).max(100)
  - flowerId: z.string().nullable().default(null)
  - settings: WateringSettingsSchema
  - lastMoisturePercent: z.number().min(0).max(100).nullable().default(null)
  - lastReadingAt: z.string().datetime().nullable().default(null)
  - lastWateredAt: z.string().datetime().nullable().default(null)
  - deviceId: z.string().nullable().default(null)
  - pendingCommands: z.array(PendingCommandSchema).default([])
  - createdAt: z.string().datetime()
  - updatedAt: z.string().datetime()

Export: WateringSettingsSchema, WateringSettings, PendingCommandSchema, PendingCommand, UserFlowerSchema, UserFlower

2. types/src/entities/collection.ts:

CollectionSchema:
  - userId: z.string().min(1)
  - collectionId: z.string().min(1)
  - name: z.string().min(1).max(100)
  - userFlowerIds: z.array(z.string()).default([])
  - isDefault: z.boolean().default(false)
  - createdAt: z.string().datetime()
  - updatedAt: z.string().datetime()

Export: CollectionSchema, Collection

3. types/src/entities/watering-event.ts:

WateringEventSchema:
  - userFlowerId: z.string().min(1)
  - timestamp: z.string().datetime()
  - source: WateringSourceSchema (import from enums)
  - durationSeconds: z.number().min(1).max(60)
  - moistureBeforePercent: z.number().min(0).max(100).nullable().default(null)
  - moistureAfterPercent: z.number().min(0).max(100).nullable().default(null)
  - commandId: z.string().nullable().default(null)
  - deviceId: z.string().nullable().default(null)
  - createdAt: z.string().datetime()

Export: WateringEventSchema, WateringEvent

4. types/src/entities/sensor-reading.ts:

SensorReadingSchema:
  - userFlowerId: z.string().min(1)
  - timestamp: z.string().datetime()
  - moisturePercent: z.number().min(0).max(100)
  - rawValue: z.number().int().min(0).max(1023)
  - deviceId: z.string().min(1)
  - ttl: z.number().int()

Export: SensorReadingSchema, SensorReading

5. types/src/entities/device.ts:

DeviceSchema:
  - deviceId: z.string().min(1)   // MAC address
  - userFlowerId: z.string().min(1)
  - userId: z.string().min(1)
  - apiKeyHash: z.string().min(1)
  - pairedAt: z.string().datetime()
  - lastSeenAt: z.string().datetime()
  - firmwareVersion: z.string().nullable().default(null)

Export: DeviceSchema, Device

6. types/src/entities/pairing-code.ts:

PairingCodeSchema:
  - code: z.string().length(6)
  - userId: z.string().min(1)
  - userFlowerId: z.string().min(1)
  - createdAt: z.string().datetime()
  - ttl: z.number().int()

Export: PairingCodeSchema, PairingCode

=== ENUMS ===

7. types/src/enums/index.ts:

WateringSourceSchema: z.enum(["manual", "auto", "scheduled", "force"])
CommandTypeSchema: z.enum(["force_water"])

Export types: WateringSource, CommandType

=== API SCHEMAS ===

8. types/src/api/collections.api.ts:

CreateCollectionRequestSchema:
  - name: z.string().min(1).max(100)

UpdateCollectionRequestSchema:
  - name: z.string().min(1).max(100).optional()
  - userFlowerIds: z.array(z.string()).optional()

CollectionResponseSchema:
  - collectionId, name, userFlowerIds, isDefault, createdAt, updatedAt (all from entity, NO userId)

CollectionDetailResponseSchema:
  - extends CollectionResponseSchema fields
  - flowers: z.array(UserFlowerResponseSchema) — import from user-flowers.api.ts

CollectionListResponseSchema:
  - collections: z.array(CollectionResponseSchema)

Export all schemas and inferred types.

9. types/src/api/user-flowers.api.ts:

CreateUserFlowerRequestSchema:
  - customName: z.string().min(1).max(100)
  - flowerId: z.string().nullable().optional()
  - settings: WateringSettingsSchema.partial().optional()
  - collectionId: z.string().optional()    // Optionally add to collection on creation

UpdateUserFlowerRequestSchema:
  - customName: z.string().min(1).max(100).optional()
  - settings: WateringSettingsSchema.partial().optional()

UserFlowerResponseSchema:
  - userFlowerId, customName, flowerId, settings, lastMoisturePercent, lastReadingAt, lastWateredAt, deviceId, createdAt, updatedAt (NO userId — it's implicit from auth)

UserFlowerListResponseSchema:
  - flowers: z.array(UserFlowerResponseSchema)

Export all schemas and inferred types.

10. types/src/api/watering.api.ts:

CreateWateringEventRequestSchema:
  - source: z.literal("manual")   // Only manual allowed from user API
  - durationSeconds: z.number().min(1).max(60).optional().default(0) // 0 = just marking "I watered it"

WateringEventResponseSchema:
  - timestamp, source, durationSeconds, moistureBeforePercent, moistureAfterPercent, deviceId, createdAt

WateringHistoryResponseSchema:
  - events: z.array(WateringEventResponseSchema)
  - lastEvaluatedKey: z.record(z.string(), z.unknown()).optional()

ForceWaterRequestSchema:
  - durationSeconds: z.number().min(1).max(60).default(5)

ForceWaterResponseSchema:
  - commandId: z.string()
  - status: z.literal("queued")

Export all schemas and inferred types.

11. types/src/api/sensor-readings.api.ts:

GetSensorReadingsQuerySchema:
  - from: z.string().datetime().optional()   // defaults to 24h ago
  - to: z.string().datetime().optional()     // defaults to now
  - limit: z.coerce.number().int().min(1).max(1000).optional().default(100)
  - exclusiveStartKey: z.string().optional() // base64 encoded DynamoDB key

SensorReadingResponseSchema:
  - timestamp, moisturePercent, rawValue, deviceId

SensorReadingsListResponseSchema:
  - readings: z.array(SensorReadingResponseSchema)
  - lastEvaluatedKey: z.string().optional()  // base64 encoded for pagination

Export all schemas and inferred types.

12. types/src/api/device.api.ts:

DevicePairRequestSchema:
  - code: z.string().length(6).toUpperCase()
  - deviceId: z.string().min(1)   // MAC address

DevicePairResponseSchema:
  - apiKey: z.string()
  - userFlowerId: z.string()
  - settings: WateringSettingsSchema

DeviceSubmitReadingRequestSchema:
  - moisturePercent: z.number().min(0).max(100)
  - rawValue: z.number().int().min(0).max(1023)

DeviceSubmitWateringRequestSchema:
  - source: z.enum(["auto", "scheduled", "force"])   // NOT manual — that's user-only
  - durationSeconds: z.number().min(1).max(60)
  - moistureBeforePercent: z.number().min(0).max(100).optional()
  - moistureAfterPercent: z.number().min(0).max(100).optional()
  - commandId: z.string().optional()   // Required when source is "force"

DeviceConfigResponseSchema:
  - settings: WateringSettingsSchema
  - pendingCommands: z.array(PendingCommandSchema)

GeneratePairingCodeResponseSchema:
  - code: z.string()
  - expiresAt: z.string().datetime()

DeviceStatusResponseSchema:
  - deviceId: z.string()
  - pairedAt: z.string().datetime()
  - lastSeenAt: z.string().datetime()
  - firmwareVersion: z.string().nullable()

Export all schemas and inferred types.

=== INDEX FILES ===

13. types/src/entities/index.ts — re-export everything from all entity files
14. types/src/api/index.ts — re-export everything from all API files
15. types/src/index.ts — re-export from entities, api, enums

Make sure there are NO circular imports. The dependency direction is: enums ← entities ← api.
Ensure every exported type has both Schema and inferred Type exported.
Do NOT use "any" anywhere.
```

### Description

This is the most critical task in the project — every other task depends on these types. The Zod-first approach ensures that the same schema is used for both compile-time type checking and runtime request validation. This eliminates the category of bugs where request types and validation logic drift apart.

The `z.infer<>` pattern means we never write `interface UserFlower { ... }` separately. The Zod schema IS the type definition. If a field changes, it changes in one place.

Response schemas deliberately exclude `userId` — it is an internal field derived from auth context, never sent to the client.

### Acceptance Criteria

- [ ] `cd types && npm install && npm run build` completes without errors
- [ ] All entity schemas can parse valid data: `UserFlowerSchema.parse({...})` succeeds
- [ ] All entity schemas reject invalid data: `UserFlowerSchema.parse({...})` throws on missing required fields
- [ ] All API request schemas can be used for validation: `CreateUserFlowerRequestSchema.safeParse(body)`
- [ ] No circular imports (entities don't import from api, enums don't import from entities)
- [ ] Every schema has a corresponding exported TypeScript type via `z.infer<>`
- [ ] `"any"` does not appear anywhere in the source code
- [ ] `types/src/index.ts` re-exports everything — a consumer can `import { UserFlower, CreateUserFlowerRequestSchema } from "@.../autowatering-types"`

---

## Task 1.3 — Configuration Module

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

## Task 1.4 — DynamoDB Client and Base Repository

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

## Task 1.5 — Error Classes

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

## Task 1.6 — Dependency Injection Container

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

Create a simple structured logger. For now, it wraps console with JSON output:

interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

The LoggerFactory depends on ConfigFactory to read LOG_LEVEL.
Each log line outputs: { level, message, timestamp, ...context }
Levels filter: debug < info < warn < error. If LOG_LEVEL is "warn", debug and info are suppressed.

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

## Task 1.7 — Integration Test Setup

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
    └── (empty directory)
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

## Task 1.8 — Health Endpoint

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

## Task 2.1 — Auth0 JWT Middleware

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

## Task 2.2 — UserFlowers Module

**Depends on:** 1.2, 1.4, 1.5, 1.6, 2.1

**Files to create:**
```
src/module/user-flowers/
├── user-flowers.repository.ts
├── user-flowers.service.ts
└── user-flowers.handler.ts

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

=== Handler: src/module/user-flowers/user-flowers.handler.ts ===

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
    handler: src/module/user-flowers/user-flowers.handler.createUserFlower
    events:
      - httpApi:
          path: /api/v1/user-flowers
          method: POST
          authorizer: auth0Authorizer

  listUserFlowers:
    handler: src/module/user-flowers/user-flowers.handler.listUserFlowers
    events:
      - httpApi:
          path: /api/v1/user-flowers
          method: GET
          authorizer: auth0Authorizer

  getUserFlower:
    handler: src/module/user-flowers/user-flowers.handler.getUserFlower
    events:
      - httpApi:
          path: /api/v1/user-flowers/{userFlowerId}
          method: GET
          authorizer: auth0Authorizer

  updateUserFlower:
    handler: src/module/user-flowers/user-flowers.handler.updateUserFlower
    events:
      - httpApi:
          path: /api/v1/user-flowers/{userFlowerId}
          method: PATCH
          authorizer: auth0Authorizer

  deleteUserFlower:
    handler: src/module/user-flowers/user-flowers.handler.deleteUserFlower
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

## Task 2.3 — Collections Module

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

## Task 3.1 — Watering Module

**Depends on:** 2.2

**Files to create:**
```
src/module/watering/
├── watering.repository.ts
├── watering.service.ts
└── watering.handler.ts

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

=== Handler: src/module/watering/watering.handler.ts ===

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

## Task 3.2 — Sensor Readings Module

**Depends on:** 2.2

**Files to create:**
```
src/module/sensor-readings/
├── sensor-readings.repository.ts
├── sensor-readings.service.ts
└── sensor-readings.handler.ts

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

=== Handler: src/module/sensor-readings/sensor-readings.handler.ts ===

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

## Task 4.1 — Device Module (Repositories)

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

## Task 4.2 — Device Service & Handler

**Depends on:** 4.1, 2.2, 3.1, 3.2

**Files to create:**
```
src/module/device/
├── device.service.ts
└── device.handler.ts

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

=== File 3: src/module/device/device.handler.ts ===

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
├── ci.yml
└── publish-types.yml
```

### Prompt

```
Create GitHub Actions workflows for CI and types publishing.

=== File 1: .github/workflows/ci.yml ===

Name: CI
Trigger: push to main, pull_request to main

Jobs:

1. lint-and-typecheck:
   - runs-on: ubuntu-latest
   - steps:
     - checkout
     - setup node 20
     - npm ci
     - npm run tsc
     - npm run lint

2. unit-tests:
   - runs-on: ubuntu-latest
   - steps:
     - checkout
     - setup node 20
     - npm ci
     - npm run test:unit

3. integration-tests:
   - runs-on: ubuntu-latest
   - needs: [lint-and-typecheck]
   - steps:
     - checkout
     - setup node 20
     - npm ci
     - npm run test:integration
   - Note: testcontainers will handle Docker — the GitHub Actions runner has Docker available

=== File 2: .github/workflows/publish-types.yml ===

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

---

# Appendix D — Device Activation Flow & Provisioning

## Task D.1 — Factory Provisioning & Device Activation Flow

**Depends on:** 4.1, 4.2

**Files to create:**
```
scripts/
└── provision-device.ts        # Run once per device at "production" time

src/module/device/
└── provisioning.service.ts    # Internal service, no handler — admin/script use only
```

**Files to modify:**
```
src/module/device/device.service.ts    # Add linkToFlower method
src/module/device/device.handler.ts    # Add linkToFlower handler
serverless.yml                         # Add linkToFlower endpoint
types/src/api/device.api.ts            # Add LinkDeviceToFlowerRequest schema
```

### Overview

The activation flow consists of three distinct stages that happen at different points in time:

```
Stage 1: Factory (developer runs a script)
Stage 2: First boot (user plugs in the device)
Stage 3: App pairing (user links device to a specific plant)
```

These three stages are intentionally decoupled — the device works and authenticates to the backend after Stage 2, but it only receives meaningful config and starts watering after Stage 3.

---

### Stage 1 — Factory Provisioning (Developer Action)

Before a device is shipped, the developer runs a provisioning script once per device. This script:

1. Generates a unique `deviceId` in format `mf-XXXXX` (e.g. `mf-00042`)
2. Generates a raw API key in format `mf-XXXXX.<64 hex chars>`
3. Computes SHA-256 hash of the raw API key
4. Writes to DynamoDB `Devices` table:
   ```
   deviceId:        "mf-00042"
   apiKeyHash:      "<sha256 hash>"
   userFlowerId:    null          ← not linked to any plant yet
   userId:          null          ← not linked to any user yet
   pairedAt:        null
   lastSeenAt:      null
   firmwareVersion: null
   status:          "unlinked"    ← new field, see below
   ```
5. Writes the raw `apiKey` + `ssid/password` placeholder to the ESP32 firmware config via Arduino IDE (developer flashes the device manually)
6. Prints a sticker label: `mf-00042` — this goes on the box

The device now exists in the database in `"unlinked"` status. The raw API key exists only in the ESP32 NVS flash — never stored in the database.

**Provisioning script: scripts/provision-device.ts**

```
Usage: npx ts-node scripts/provision-device.ts --count 10 --prefix mf

Output:
  - Writes N device records to DynamoDB
  - Prints a CSV: deviceId, rawApiKey (to be flashed to devices)
  - CSV is printed to stdout only — never saved to disk
```

The script must:
- Accept `--count` (number of devices) and `--prefix` (default "mf")
- Pad the numeric suffix with leading zeros to 5 digits
- Generate cryptographically secure random keys using `crypto.randomBytes(32)`
- Hash using `crypto.createHash("sha256")`
- Write all records to DynamoDB in a single `BatchWriteItem` call (max 25 per batch, chunk if needed)
- Print results to stdout in CSV format: `deviceId,rawApiKey`
- Accept `--stage` flag (dev/staging/prod) to target the correct DynamoDB table
- NEVER log the raw API keys to any file — stdout only, developer pipes to a secure location

---

### Stage 2 — First Boot (User Action)

When the user receives and powers on the device for the first time:

**ESP32 behavior (firmware — not backend code, described here for context):**

1. On first boot, ESP32 detects no WiFi credentials in NVS
2. Starts in AP (Access Point) mode:
   - SSID: `MyFlowers-<deviceId>` (e.g. `MyFlowers-mf-00042`)
   - No password on the AP — the API key is the security layer
   - Runs a minimal HTTP server on `192.168.4.1:80`
3. Waits for a single POST request on `192.168.4.1/configure`:
   ```json
   { "ssid": "HomeWiFi", "password": "qwerty123" }
   ```
4. Saves WiFi credentials to NVS
5. Reboots into normal mode

**Mobile app behavior (described here for context, not backend code):**

1. User opens app → "Add Device" → enters `mf-00042` from the sticker
2. App validates the format (must match `mf-XXXXX` pattern)
3. App instructs: "Connect your phone to WiFi network MyFlowers-mf-00042"
4. User connects phone to the ESP32 AP
5. App sends `POST http://192.168.4.1/configure` with home WiFi credentials
6. App instructs user to reconnect phone back to home WiFi
7. App polls `GET /api/v1/user-flowers/:id/device/status` waiting for device to come online

**ESP32 normal mode (after WiFi credentials saved):**

1. Connects to home WiFi
2. Immediately calls `POST /device/v1/boot`:
   ```
   X-Device-Key: mf-00042.<secret>
   Body: { "firmwareVersion": "1.0.0" }
   ```
3. Backend authenticates the device, updates `lastSeenAt` and `firmwareVersion`, sets `status: "online"`
4. Device starts polling `GET /device/v1/config` every `checkIntervalSeconds`

At this point the device is online and authenticated, but `userFlowerId` and `userId` are still `null`. The config response returns empty settings and no commands — the device idles.

**New endpoint required:**

```
POST /device/v1/boot
Auth: X-Device-Key
Body: { firmwareVersion: string }
Response 200: { status: "unlinked" | "linked", config?: DeviceConfigResponse }
```

If `status: "unlinked"` — device knows it has no plant and idles (reads sensor but doesn't water).
If `status: "linked"` — device receives full config immediately without waiting for next poll.

---

### Stage 3 — App Pairing (User Links Device to a Plant)

After the device comes online, the user links it to a specific plant in the app:

**App flow:**

1. App detects device is online (polling `GET /api/v1/user-flowers/:id/device/status` returns `lastSeenAt` is recent)
2. User selects which plant this device should monitor
3. App calls:
   ```
   POST /api/v1/user-flowers/:userFlowerId/pair
   Auth: Auth0 JWT
   Body: { "deviceId": "mf-00042" }
   ```

**Backend: `linkToFlower` method on DeviceService:**

1. Verify `userFlowerId` belongs to `userId` (throw NotFoundError if not)
2. Fetch device by `deviceId` — throw NotFoundError if device doesn't exist in DB
3. If device `status` is already `"linked"` and `userFlowerId` matches → idempotent, return success
4. If device `status` is `"linked"` to a DIFFERENT flower → throw ConflictError("Device already linked to another plant")
5. Update Device record:
   ```
   userFlowerId: <userFlowerId>
   userId:       <userId>
   pairedAt:     now
   status:       "linked"
   ```
6. Update UserFlower record: set `deviceId = "mf-00042"`
7. Return `DeviceStatusResponse`

From this point on, `GET /device/v1/config` returns full settings and the device begins normal operation.

---

### Device Status Field

Add `status` field to the `Device` entity:

```typescript
// In types/src/entities/device.ts
status: z.enum(["unlinked", "online", "linked"])
```

| Status | Meaning |
|--------|---------|
| `unlinked` | Device exists in DB (provisioned), never booted or no WiFi yet |
| `online` | Device has booted and is connected, but not yet linked to a plant |
| `linked` | Device is linked to a plant and operating normally |

---

### OTA Firmware Update Support (CRA Compliance)

To comply with the EU Cyber Resilience Act requirement for security updates, the config response must include firmware update information. Add to `DeviceConfigResponse`:

```typescript
// In types/src/api/device.api.ts
DeviceConfigResponseSchema extended with:
  firmwareUpdate: z.object({
    available: z.boolean(),
    version: z.string().optional(),     // e.g. "1.1.0"
    url: z.string().url().optional(),   // HTTPS URL to firmware binary
    checksum: z.string().optional(),    // SHA-256 of firmware binary
  })
```

The ESP32 checks `firmwareUpdate.available` on every config poll. If `true`, it downloads the binary from `url`, verifies the SHA-256 checksum, and performs OTA update via ESP32's built-in OTA library.

The backend stores `latestFirmwareVersion` and `latestFirmwareUrl` in Config (environment variables). The config endpoint compares device's `firmwareVersion` against `latestFirmwareVersion` and sets `available: true` if they differ.

No separate endpoint needed — firmware delivery is piggybacked on the existing config poll.

---

### New and Modified Endpoints Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /device/v1/boot | X-Device-Key | First call after WiFi connected, updates status |
| GET | /device/v1/config | X-Device-Key | Existing — now includes firmwareUpdate field |
| POST | /api/v1/user-flowers/:id/pair | Auth0 JWT | Modified — now accepts `{ deviceId }` body instead of generating a code |
| GET | /api/v1/user-flowers/:id/device | Auth0 JWT | Existing — now returns `status` field |

---

### Full Activation Timeline

```
[Factory]
  Developer runs: npx ts-node scripts/provision-device.ts --count 1
  → DynamoDB: { deviceId: "mf-00042", apiKeyHash: "...", status: "unlinked" }
  → ESP32 flashed with: { deviceId: "mf-00042", apiKey: "mf-00042.secret" }
  → Sticker printed: "mf-00042"

[User — Day 1, minute 0]
  User powers on device
  ESP32 has no WiFi → starts AP "MyFlowers-mf-00042"

[User — Day 1, minute 1]
  User opens app → "Add Device" → enters "mf-00042"
  App: "Connect to MyFlowers-mf-00042"
  User connects phone to ESP32 AP
  App POST 192.168.4.1/configure { ssid, password }
  ESP32 saves WiFi, reboots

[User — Day 1, minute 2]
  ESP32 connects to HomeWiFi
  ESP32 POST /device/v1/boot { firmwareVersion: "1.0.0" }
  Backend: status → "online", lastSeenAt → now
  Response: { status: "online" }   ← no config yet, device idles

[User — Day 1, minute 2-3]
  App polls GET /api/v1/user-flowers/:id/device/status
  Sees lastSeenAt is recent → device is online
  App: "Your device is online! Select a plant to link it to."
  User selects "My Monstera"
  App POST /api/v1/user-flowers/uf_abc123/pair { deviceId: "mf-00042" }
  Backend: status → "linked", userFlowerId → "uf_abc123"

[User — Day 1, minute 3+]
  ESP32 next config poll: GET /device/v1/config
  Response: { settings: { threshold: 20, ... }, pendingCommands: [], firmwareUpdate: { available: false } }
  Device begins normal operation — reads sensor, waters when dry
```

---

### Acceptance Criteria

- [ ] Provisioning script generates unique deviceId and apiKey per device
- [ ] Provisioning script writes to DynamoDB in batches (handles >25 devices)
- [ ] Raw API key is NEVER written to any file — stdout only
- [ ] `POST /device/v1/boot` authenticates device and sets status to "online"
- [ ] `POST /device/v1/boot` returns `{ status: "unlinked" }` before flower is linked
- [ ] `POST /api/v1/user-flowers/:id/pair` accepts `{ deviceId }` and links device to flower
- [ ] Linking is idempotent — linking same device to same flower twice returns success
- [ ] Linking a device already linked to a DIFFERENT flower returns ConflictError (409)
- [ ] Device status transitions correctly: `unlinked → online → linked`
- [ ] Config response includes `firmwareUpdate` field
- [ ] `firmwareUpdate.available` is `true` when device firmware version differs from latest
- [ ] OTA fields (`url`, `checksum`) are only included when update is available
- [ ] All new fields added to types package schemas
- [ ] Integration test covers the full activation timeline end-to-end
- [ ] No `any` type anywhere
- [ ] `npm run tsc` and `npm run lint` pass
