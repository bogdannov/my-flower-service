# Autowatering Backend — Architecture & Implementation Plan

---

# PART 1: Integration Overview

This section provides a high-level understanding of the system, its domain, API surface, and integration patterns. It is intentionally kept abstract so that consumers (mobile app, admin tools, third-party devices) can integrate without coupling to implementation details.

---

## 1.1 System Purpose

The Autowatering Backend manages the lifecycle of user-owned plants and their automated watering via IoT devices (ESP32). It provides two distinct API surfaces:

- **User API** — authenticated via Auth0 JWT, consumed by mobile/web clients.
- **Device API** — authenticated via API Key, consumed by ESP32 hardware.

---

## 1.2 Domain Model

```
┌──────────┐        ┌────────────────┐        ┌──────────────┐
│  User    │ 1───N  │  Collection    │  N───M  │  UserFlower  │
│ (Auth0)  │        │                │         │              │
└──────────┘        └────────────────┘         └──────┬───────┘
                                                      │
                                          ┌───────────┼───────────┐
                                          │           │           │
                                    ┌─────┴──┐  ┌────┴────┐  ┌───┴────┐
                                    │ Device │  │Watering │  │Sensor  │
                                    │        │  │ Event   │  │Reading │
                                    └────────┘  └─────────┘  └────────┘
```

### Entities

**User** — managed entirely by Auth0. This service does not store user profiles. `userId` (Auth0 sub) is extracted from the JWT and used as a foreign key.

**Collection** — a named group of UserFlowers. A user can have many collections. One default collection is created on first interaction. A single UserFlower can belong to multiple collections (many-to-many via ID references).

**UserFlower** — a plant owned by a user. Contains a user-given name, optional reference to a global Flower catalog (future), current sensor snapshot, and watering/device settings. This is the central entity most other entities relate to.

**Device** — an ESP32 paired to exactly one UserFlower. Authenticated via API Key. Sends sensor readings and watering events.

**WateringEvent** — a historical record of a watering action. Can originate from manual user input, automatic threshold-based trigger, scheduled trigger, or force-watering command.

**SensorReading** — a time-series record of moisture data from a device. High write frequency, retained via TTL (default 30 days).

**Flower (future)** — a global read-only catalog of plant species with multilingual names and care instructions. Not in current scope; `UserFlower.flowerId` is nullable to preserve forward compatibility.

---

## 1.3 User API

Base path: `/api/v1`

Authentication: `Authorization: Bearer <Auth0 JWT>`

### Collections

| Method | Path | Description |
|--------|------|-------------|
| POST | /collections | Create a collection |
| GET | /collections | List all user collections |
| GET | /collections/:id | Get collection with enriched flower data |
| PATCH | /collections/:id | Update collection (name, flower IDs) |
| DELETE | /collections/:id | Delete collection (does not delete flowers) |

### User Flowers

| Method | Path | Description |
|--------|------|-------------|
| POST | /user-flowers | Create a user flower |
| GET | /user-flowers | List all user flowers |
| GET | /user-flowers/:id | Get single user flower with current state |
| PATCH | /user-flowers/:id | Update flower (name, settings) |
| DELETE | /user-flowers/:id | Delete flower and unpair device |

### Watering

| Method | Path | Description |
|--------|------|-------------|
| POST | /user-flowers/:id/watering | Record manual watering event |
| GET | /user-flowers/:id/watering | Get watering history (paginated) |
| POST | /user-flowers/:id/force-water | Queue force-watering command for device |

### Sensor Readings

| Method | Path | Description |
|--------|------|-------------|
| GET | /user-flowers/:id/readings | Get sensor history (paginated, default 24h) |

### Device Management (user-facing)

| Method | Path | Description |
|--------|------|-------------|
| POST | /user-flowers/:id/pair | Generate pairing code for a device |
| DELETE | /user-flowers/:id/device | Unpair device from flower |
| GET | /user-flowers/:id/device | Get device status (lastSeen, firmware) |

---

## 1.4 Device API

Base path: `/device/v1`

Authentication: `X-Device-Key: <API Key>`

| Method | Path | Description |
|--------|------|-------------|
| POST   | /pair | Complete pairing (code + deviceId → API key) |
| POST   | /readings | Submit sensor reading |
| POST   | /watering | Report watering event |
| GET    | /config | Fetch current settings + pending commands |

The `/pair` endpoint is unauthenticated (the device has no key yet). All others require `X-Device-Key`.

### Force Watering (polling-based)

The device polls `GET /config` every N seconds. If a force-water command is pending, the response includes:

```json
{
  "settings": { ... },
  "pendingCommands": [
    { "type": "force_water", "durationSeconds": 5, "commandId": "cmd_xxx" }
  ]
}
```

The device executes the command and confirms via `POST /watering` with `source: "force"` and the `commandId`.

---

## 1.5 Authentication Strategy

| Consumer | Mechanism | Details |
|----------|-----------|---------|
| Mobile/Web | Auth0 JWT | Standard OAuth2, `userId` from `sub` claim |
| ESP32 Device | API Key | Generated at pairing, stored in device NVS |
| Internal/Admin | Service Token | For future Flower catalog management |

The User service (Auth0-managed) is out of scope. This service trusts the JWT and extracts `userId` from it.

---

## 1.6 Exported Types Package

This repository is the single source of truth for all domain types. Types are published as a GitHub Package (`@<org>/autowatering-types`) for consumption by mobile app and other services.

Published types include: entity interfaces, API request/response contracts, Zod schemas for runtime validation, device protocol types, and enum/union types.

---

# PART 2: Implementation Plan

This section is a ready-for-development guide. Each task is described with enough detail to implement without ambiguity.

---

## 2.1 Project Structure

```
my-flowers-service/
├── serverless.yml
├── docker-compose.yml              # LocalStack for integration tests
├── package.json
├── tsconfig.json
├── vitest.config.ts
│
├── src/
│   ├── bootstrap/
│   │   ├── factory/
│   │   │   ├── base.factory.ts           # BaseFactory<T> abstract class
│   │   │   └── module/
│   │   │       ├── config.factory.ts
│   │   │       ├── logger.factory.ts
│   │   │       ├── dynamodb-client.factory.ts
│   │   │       ├── collections-repository.factory.ts
│   │   │       ├── user-flowers-repository.factory.ts
│   │   │       ├── watering-repository.factory.ts
│   │   │       ├── sensor-readings-repository.factory.ts
│   │   │       ├── devices-repository.factory.ts
│   │   │       ├── pairing-repository.factory.ts
│   │   │       ├── collections-service.factory.ts
│   │   │       ├── user-flowers-service.factory.ts
│   │   │       ├── watering-service.factory.ts
│   │   │       ├── device-service.factory.ts
│   │   │       └── sensor-readings-service.factory.ts
│   │   └── inject.ts                     # DI container registration
│   │
│   ├── module/
│   │   ├── config/
│   │   │   └── Config.ts                 # Zod-validated env config (ONLY place for process.env)
│   │   │
│   │   ├── db/
│   │   │   ├── dynamo-client.ts          # Base DynamoDB document client wrapper
│   │   │   └── base.repository.ts        # Generic CRUD operations (get, put, query, delete, batchGet, update)
│   │   │
│   │   ├── auth/
│   │   │   ├── jwt.middleware.ts          # Auth0 JWT verification → extracts userId
│   │   │   └── device-key.middleware.ts   # X-Device-Key verification → extracts deviceId
│   │   │
│   │   ├── collections/
│   │   │   ├── collections.repository.ts
│   │   │   ├── collections.service.ts
│   │   │   └── collections.handler.ts
│   │   │
│   │   ├── user-flowers/
│   │   │   ├── user-flowers.repository.ts
│   │   │   ├── user-flowers.service.ts
│   │   │   └── user-flowers.handler.ts
│   │   │
│   │   ├── watering/
│   │   │   ├── watering.repository.ts
│   │   │   ├── watering.service.ts
│   │   │   └── watering.handler.ts
│   │   │
│   │   ├── sensor-readings/
│   │   │   ├── sensor-readings.repository.ts
│   │   │   ├── sensor-readings.service.ts
│   │   │   └── sensor-readings.handler.ts
│   │   │
│   │   └── device/
│   │       ├── devices.repository.ts
│   │       ├── pairing.repository.ts
│   │       ├── device.service.ts
│   │       └── device.handler.ts
│   │
│   └── handler/
│       ├── health.ts
│       ├── user-api.ts                   # Thin entry points for Serverless (import from modules)
│       └── device-api.ts                 # Thin entry points for device endpoints
│
├── types/                                # EXPORTED PACKAGE — single source of truth
│   ├── package.json                      # @<org>/autowatering-types
│   ├── tsconfig.json
│   ├── src/
│   │   ├── entities/
│   │   │   ├── user-flower.ts
│   │   │   ├── collection.ts
│   │   │   ├── watering-event.ts
│   │   │   ├── sensor-reading.ts
│   │   │   ├── device.ts
│   │   │   └── pairing-code.ts
│   │   ├── api/
│   │   │   ├── collections.api.ts        # Request/Response Zod schemas + inferred types
│   │   │   ├── user-flowers.api.ts
│   │   │   ├── watering.api.ts
│   │   │   ├── sensor-readings.api.ts
│   │   │   └── device.api.ts
│   │   ├── enums/
│   │   │   └── index.ts                  # WateringSource, CommandType, etc.
│   │   └── index.ts                      # Re-exports everything
│   └── dist/                             # Built output (gitignored)
│
└── tests/
    ├── integration/
    │   ├── setup/
    │   │   ├── localstack.ts             # LocalStack container setup
    │   │   ├── tables.ts                 # Create DynamoDB tables
    │   │   └── global-setup.ts           # Vitest globalSetup
    │   ├── collections.integration.test.ts
    │   ├── user-flowers.integration.test.ts
    │   ├── watering.integration.test.ts
    │   ├── device.integration.test.ts
    │   └── sensor-readings.integration.test.ts
    └── unit/
        ├── collections.service.test.ts
        ├── user-flowers.service.test.ts
        ├── watering.service.test.ts
        └── device.service.test.ts
```

---

## 2.2 DynamoDB Table Design

### Table: `Collections`

```
PK: userId (string)
SK: collectionId (string)       # "col_" + ulid
─────────────────────────────────
name: string
userFlowerIds: string[]          # References to UserFlower IDs
isDefault: boolean
createdAt: string (ISO 8601)
updatedAt: string (ISO 8601)
```

Access patterns:
- List all collections by user → `PK = userId`
- Get single collection → `PK = userId, SK = collectionId`

### Table: `UserFlowers`

```
PK: userId (string)
SK: userFlowerId (string)       # "uf_" + ulid
─────────────────────────────────
customName: string
flowerId: string | null          # Future catalog reference
settings: {
  wateringThresholdPercent: number    # default 20
  wateringDurationSeconds: number     # default 5
  checkIntervalSeconds: number        # default 30
  scheduledWateringEnabled: boolean
  scheduledWateringTime: string | null # "HH:mm"
}
lastMoisturePercent: number | null
lastReadingAt: string | null
lastWateredAt: string | null
deviceId: string | null          # Paired device MAC
createdAt: string (ISO 8601)
updatedAt: string (ISO 8601)
```

Access patterns:
- List all flowers by user → `PK = userId`
- Get single flower → `PK = userId, SK = userFlowerId`
- Lookup by deviceId (for device API) → GSI `DeviceIndex`: `PK = deviceId`

GSI: `DeviceIndex`
```
PK: deviceId (string)
Projection: ALL
```

### Table: `WateringEvents`

```
PK: userFlowerId (string)
SK: timestamp (string, ISO 8601)
─────────────────────────────────
source: "manual" | "auto" | "scheduled" | "force"
durationSeconds: number
moistureBeforePercent: number | null
moistureAfterPercent: number | null
commandId: string | null          # For force-watering acknowledgment
deviceId: string | null           # null for manual
createdAt: string (ISO 8601)
```

Access patterns:
- History for a flower (newest first) → `PK = userFlowerId, SK desc`
- Paginated → `ExclusiveStartKey` with `Limit`

### Table: `SensorReadings`

```
PK: userFlowerId (string)
SK: timestamp (string, ISO 8601)
─────────────────────────────────
moisturePercent: number
rawValue: number
deviceId: string
ttl: number                       # epoch seconds, 30 days from creation
```

Access patterns:
- Readings for a flower in time range → `PK = userFlowerId, SK BETWEEN start AND end`

DynamoDB TTL attribute: `ttl`

### Table: `Devices`

```
PK: deviceId (string)            # MAC address
─────────────────────────────────
userFlowerId: string
userId: string
apiKeyHash: string                # bcrypt or SHA-256 hash, NEVER plaintext
pairedAt: string (ISO 8601)
lastSeenAt: string (ISO 8601)
firmwareVersion: string | null
```

Access patterns:
- Authenticate device → `PK = deviceId`, verify apiKeyHash
- Get device by flower → use `UserFlower.deviceId` field, then get from Devices

### Table: `PairingCodes`

```
PK: code (string)                # 6-char alphanumeric, uppercase
─────────────────────────────────
userId: string
userFlowerId: string
createdAt: string (ISO 8601)
ttl: number                       # epoch seconds, 10 minutes from creation
```

Access patterns:
- Redeem code → `PK = code`, verify not expired

DynamoDB TTL attribute: `ttl`

---

## 2.3 Types Package — Zod Schemas as Source of Truth

Every entity and API contract is defined as a Zod schema first. TypeScript types are inferred from Zod — never manually duplicated.

### Entity Schemas (types/src/entities/user-flower.ts)

```typescript
import { z } from "zod";

export const WateringSettingsSchema = z.object({
  wateringThresholdPercent: z.number().min(0).max(100).default(20),
  wateringDurationSeconds: z.number().min(1).max(60).default(5),
  checkIntervalSeconds: z.number().min(10).max(300).default(30),
  scheduledWateringEnabled: z.boolean().default(false),
  scheduledWateringTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
});

export const UserFlowerSchema = z.object({
  userId: z.string(),
  userFlowerId: z.string(),
  customName: z.string().min(1).max(100),
  flowerId: z.string().nullable().default(null),
  settings: WateringSettingsSchema,
  lastMoisturePercent: z.number().nullable().default(null),
  lastReadingAt: z.string().datetime().nullable().default(null),
  lastWateredAt: z.string().datetime().nullable().default(null),
  deviceId: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type WateringSettings = z.infer<typeof WateringSettingsSchema>;
export type UserFlower = z.infer<typeof UserFlowerSchema>;
```

### API Schemas (types/src/api/user-flowers.api.ts)

```typescript
import { z } from "zod";
import { WateringSettingsSchema } from "../entities/user-flower";

// ── Requests ──

export const CreateUserFlowerRequestSchema = z.object({
  customName: z.string().min(1).max(100),
  flowerId: z.string().nullable().optional(),
  settings: WateringSettingsSchema.partial().optional(),
  collectionId: z.string().optional(),
});

export const UpdateUserFlowerRequestSchema = z.object({
  customName: z.string().min(1).max(100).optional(),
  settings: WateringSettingsSchema.partial().optional(),
});

// ── Responses ──

export const UserFlowerResponseSchema = z.object({
  userFlowerId: z.string(),
  customName: z.string(),
  flowerId: z.string().nullable(),
  settings: WateringSettingsSchema,
  lastMoisturePercent: z.number().nullable(),
  lastReadingAt: z.string().datetime().nullable(),
  lastWateredAt: z.string().datetime().nullable(),
  deviceId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ── Inferred Types ──

export type CreateUserFlowerRequest = z.infer<typeof CreateUserFlowerRequestSchema>;
export type UpdateUserFlowerRequest = z.infer<typeof UpdateUserFlowerRequestSchema>;
export type UserFlowerResponse = z.infer<typeof UserFlowerResponseSchema>;
```

### Enums (types/src/enums/index.ts)

```typescript
import { z } from "zod";

export const WateringSourceSchema = z.enum(["manual", "auto", "scheduled", "force"]);
export type WateringSource = z.infer<typeof WateringSourceSchema>;

export const CommandTypeSchema = z.enum(["force_water"]);
export type CommandType = z.infer<typeof CommandTypeSchema>;
```

---

## 2.4 Base Repository — DynamoDB Method Reuse

All repositories extend a generic `BaseRepository<T>` that encapsulates common DynamoDB operations. Domain repositories add only table-specific access patterns.

### base.repository.ts

```typescript
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand,
         DeleteCommand, UpdateCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";

export interface QueryOptions {
  indexName?: string;
  scanIndexForward?: boolean;
  limit?: number;
  exclusiveStartKey?: Record<string, unknown>;
  filterExpression?: string;
  expressionAttributeValues?: Record<string, unknown>;
  expressionAttributeNames?: Record<string, string>;
}

export interface PaginatedResult<T> {
  items: T[];
  lastEvaluatedKey?: Record<string, unknown>;
}

export abstract class BaseRepository<T> {
  constructor(
    protected readonly client: DynamoDBDocumentClient,
    protected readonly tableName: string,
  ) {}

  protected async get(pk: string, sk?: string): Promise<T | null> {
    const key: Record<string, string> = { PK: pk };
    if (sk) key.SK = sk;

    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: key,
    }));

    return (result.Item as T) ?? null;
  }

  protected async put(item: Record<string, unknown>): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: item,
    }));
  }

  protected async query(
    keyCondition: string,
    expressionValues: Record<string, unknown>,
    options: QueryOptions = {},
  ): Promise<PaginatedResult<T>> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: options.indexName,
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: expressionValues,
      ExpressionAttributeNames: options.expressionAttributeNames,
      FilterExpression: options.filterExpression,
      ScanIndexForward: options.scanIndexForward ?? true,
      Limit: options.limit,
      ExclusiveStartKey: options.exclusiveStartKey,
    }));

    return {
      items: (result.Items as T[]) ?? [],
      lastEvaluatedKey: result.LastEvaluatedKey as Record<string, unknown> | undefined,
    };
  }

  protected async delete(pk: string, sk?: string): Promise<void> {
    const key: Record<string, string> = { PK: pk };
    if (sk) key.SK = sk;

    await this.client.send(new DeleteCommand({
      TableName: this.tableName,
      Key: key,
    }));
  }

  protected async batchGet(keys: Record<string, string>[]): Promise<T[]> {
    if (keys.length === 0) return [];

    // DynamoDB BatchGetItem limit is 100
    const chunks = this.chunkArray(keys, 100);
    const results: T[] = [];

    for (const chunk of chunks) {
      const result = await this.client.send(new BatchGetCommand({
        RequestItems: {
          [this.tableName]: { Keys: chunk },
        },
      }));

      const items = result.Responses?.[this.tableName] ?? [];
      results.push(...(items as T[]));
    }

    return results;
  }

  protected async update(
    pk: string,
    sk: string | undefined,
    updateExpression: string,
    expressionValues: Record<string, unknown>,
    expressionNames?: Record<string, string>,
  ): Promise<T> {
    const key: Record<string, string> = { PK: pk };
    if (sk) key.SK = sk;

    const result = await this.client.send(new UpdateCommand({
      TableName: this.tableName,
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionValues,
      ExpressionAttributeNames: expressionNames,
      ReturnValues: "ALL_NEW",
    }));

    return result.Attributes as T;
  }

  private chunkArray<U>(array: U[], size: number): U[][] {
    const chunks: U[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
```

### Domain Repository Example (collections.repository.ts)

```typescript
import { BaseRepository, PaginatedResult } from "../db/base.repository";
import { Collection } from "@<org>/autowatering-types";

export class CollectionsRepository extends BaseRepository<Collection> {

  async findByUser(userId: string): Promise<Collection[]> {
    const result = await this.query(
      "PK = :pk",
      { ":pk": userId },
    );
    return result.items;
  }

  async findOne(userId: string, collectionId: string): Promise<Collection | null> {
    return this.get(userId, collectionId);
  }

  async create(collection: Collection): Promise<void> {
    await this.put({
      PK: collection.userId,
      SK: collection.collectionId,
      ...collection,
    });
  }

  async remove(userId: string, collectionId: string): Promise<void> {
    await this.delete(userId, collectionId);
  }
}
```

All other repositories (UserFlowersRepository, WateringRepository, etc.) follow the same pattern: extend `BaseRepository<T>`, expose domain-specific methods, never duplicate base DynamoDB logic.

---

## 2.5 Service Layer — Business Logic

Services contain all business logic. They are framework-agnostic — no HTTP concepts (status codes, headers, request/response objects) leak into services. Services receive and return plain typed objects.

### Service Contract Example (collections.service.ts)

```typescript
import { CollectionsRepository } from "./collections.repository";
import { UserFlowersRepository } from "../user-flowers/user-flowers.repository";
import { CreateCollectionRequest, CollectionResponse,
         CollectionDetailResponse } from "@<org>/autowatering-types";
import { ulid } from "ulid";

export class CollectionsService {
  constructor(
    private readonly collectionsRepository: CollectionsRepository,
    private readonly userFlowersRepository: UserFlowersRepository,
  ) {}

  async create(userId: string, request: CreateCollectionRequest): Promise<CollectionResponse> {
    const now = new Date().toISOString();
    const collection = {
      userId,
      collectionId: `col_${ulid()}`,
      name: request.name,
      userFlowerIds: [],
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    };

    await this.collectionsRepository.create(collection);
    return this.toResponse(collection);
  }

  async getWithFlowers(userId: string, collectionId: string): Promise<CollectionDetailResponse> {
    const collection = await this.collectionsRepository.findOne(userId, collectionId);
    if (!collection) throw new NotFoundError("Collection not found");

    // Batch-get enriched flower data
    const flowers = collection.userFlowerIds.length > 0
      ? await this.userFlowersRepository.batchGetByIds(userId, collection.userFlowerIds)
      : [];

    return { ...this.toResponse(collection), flowers };
  }

  async ensureDefaultCollection(userId: string): Promise<void> {
    const collections = await this.collectionsRepository.findByUser(userId);
    const hasDefault = collections.some(c => c.isDefault);

    if (!hasDefault) {
      const now = new Date().toISOString();
      await this.collectionsRepository.create({
        userId,
        collectionId: `col_${ulid()}`,
        name: "My Collection",
        userFlowerIds: [],
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // ... update, delete, list, addFlower, removeFlower
}
```

### Key Service Responsibilities

| Service | Responsibilities |
|---------|-----------------|
| CollectionsService | CRUD, enrichment via batch-get, default collection creation, add/remove flowers |
| UserFlowersService | CRUD, merge settings with defaults, update snapshot fields, cascade delete (unpair device, remove from collections) |
| WateringService | Record events (manual + device), query history, update snapshot on UserFlower |
| SensorReadingsService | Ingest readings, update UserFlower snapshot, query time ranges |
| DeviceService | Generate pairing code, complete pairing (hash API key, create Device, link to UserFlower), authenticate by key, deliver config + pending commands |

---

## 2.6 Handler Layer — Thin, Framework-Bound

Handlers are the only layer aware of the HTTP framework (Serverless/Lambda). Their sole responsibility is: parse input, validate via Zod, call service, map result to HTTP response. Zero business logic.

### Handler Pattern

```typescript
import { APIGatewayProxyHandler } from "aws-lambda";
import { CreateUserFlowerRequestSchema } from "@<org>/autowatering-types";
import { inject } from "../../bootstrap/inject";

export const createUserFlower: APIGatewayProxyHandler = async (event) => {
  try {
    const userId = extractUserId(event);  // From JWT middleware
    const body = JSON.parse(event.body ?? "{}");

    // Validate with Zod — single source of truth
    const parsed = CreateUserFlowerRequestSchema.safeParse(body);
    if (!parsed.success) {
      return { statusCode: 400, body: JSON.stringify({ errors: parsed.error.flatten() }) };
    }

    const service = await inject().UserFlowersService();
    const result = await service.create(userId, parsed.data);

    return { statusCode: 201, body: JSON.stringify(result) };
  } catch (error) {
    return handleError(error);
  }
};
```

### Why This Is Framework-Agnostic

If migrating from Serverless to Fastify, Express, or any other framework:

1. **Services** — zero changes.
2. **Repositories** — zero changes.
3. **Types** — zero changes.
4. **Handlers** — rewrite only these thin wrappers to map framework-specific request/response.

---

## 2.7 Device Service — Pairing & Authentication

### Pairing Flow (Step by Step)

```
Mobile App                    Backend                        ESP32
    │                            │                              │
    ├─ POST /user-flowers/:id/pair                              │
    │   (Auth0 JWT)              │                              │
    │                            ├─ generate code "A3F7X2"     │
    │                            ├─ store in PairingCodes (TTL) │
    │  ◄─── { code: "A3F7X2" }  │                              │
    │                            │                              │
    │   user enters code         │                              │
    │   on ESP32 setup page      │                              │
    │                            │                              │
    │                            │   POST /device/v1/pair       │
    │                            │   { code, deviceId (MAC) }   │
    │                            │  ◄───────────────────────────┤
    │                            │                              │
    │                            ├─ validate code (exists, not expired)
    │                            ├─ generate API key            │
    │                            ├─ hash key, store in Devices  │
    │                            ├─ link deviceId to UserFlower │
    │                            ├─ delete PairingCode          │
    │                            │                              │
    │                            ├─── { apiKey: "raw-key" } ───►│
    │                            │                              │
    │                            │     ESP32 stores key in NVS  │
```

### Device Authentication Middleware

```typescript
export const deviceKeyMiddleware = async (event: APIGatewayProxyEvent): Promise<DeviceContext> => {
  const apiKey = event.headers["x-device-key"];
  if (!apiKey) throw new UnauthorizedError("Missing device key");

  const deviceService = await inject().DeviceService();
  const device = await deviceService.authenticateByKey(apiKey);
  // authenticateByKey: iterates devices, compares hash — or use a key→deviceId lookup index

  return { deviceId: device.deviceId, userFlowerId: device.userFlowerId, userId: device.userId };
};
```

### API Key Lookup Optimization

Comparing hashes for every device on every request is not scalable. Two options:

**Option A (recommended for now):** Use a prefix-based key format: `<deviceId>.<randomPart>`. Extract deviceId from the key, fetch the device record, then compare hashes. One DynamoDB read per request.

**Option B (future):** Add a GSI on Devices table with `apiKeyPrefix` (first 8 chars of the raw key) as PK for quick lookup.

---

## 2.8 Force Watering — Command Queue

### Implementation

Commands are stored directly on the `UserFlower` record as a `pendingCommands` array:

```typescript
// On UserFlower entity
pendingCommands: Array<{
  commandId: string;       // "cmd_" + ulid
  type: "force_water";
  durationSeconds: number;
  createdAt: string;
}>
```

### Flow

1. User calls `POST /user-flowers/:id/force-water`
2. Service appends command to `pendingCommands` on the UserFlower
3. Device polls `GET /device/v1/config`
4. Response includes `pendingCommands`
5. Device executes, then calls `POST /device/v1/watering` with `commandId`
6. Service removes the command from `pendingCommands` and records WateringEvent

No separate table needed — commands are transient and tied to a specific flower.

---

## 2.9 Configuration (Config.ts)

All environment variables validated with Zod in a single place:

```typescript
import { z } from "zod";

const ConfigSchema = z.object({
  STAGE: z.enum(["dev", "staging", "prod"]),
  AWS_REGION: z.string().default("eu-central-1"),
  COLLECTIONS_TABLE: z.string(),
  USER_FLOWERS_TABLE: z.string(),
  WATERING_EVENTS_TABLE: z.string(),
  SENSOR_READINGS_TABLE: z.string(),
  DEVICES_TABLE: z.string(),
  PAIRING_CODES_TABLE: z.string(),
  AUTH0_DOMAIN: z.string(),
  AUTH0_AUDIENCE: z.string(),
  SENSOR_READINGS_TTL_DAYS: z.coerce.number().default(30),
  PAIRING_CODE_TTL_MINUTES: z.coerce.number().default(10),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  DYNAMODB_ENDPOINT: z.string().optional(),  // For LocalStack
});

export type Config = z.infer<typeof ConfigSchema>;

let cached: Config | null = null;

export function loadConfig(): Config {
  if (cached) return cached;
  cached = ConfigSchema.parse(process.env);
  return cached;
}
```

---

## 2.10 Dependency Injection (inject.ts)

```typescript
import { BaseFactory } from "./factory/base.factory";
// ... all factory imports

export interface Container {
  Config: () => Promise<Config>;
  DynamoDBClient: () => Promise<DynamoDBDocumentClient>;
  CollectionsRepository: () => Promise<CollectionsRepository>;
  UserFlowersRepository: () => Promise<UserFlowersRepository>;
  WateringRepository: () => Promise<WateringRepository>;
  SensorReadingsRepository: () => Promise<SensorReadingsRepository>;
  DevicesRepository: () => Promise<DevicesRepository>;
  PairingRepository: () => Promise<PairingRepository>;
  CollectionsService: () => Promise<CollectionsService>;
  UserFlowersService: () => Promise<UserFlowersService>;
  WateringService: () => Promise<WateringService>;
  SensorReadingsService: () => Promise<SensorReadingsService>;
  DeviceService: () => Promise<DeviceService>;
}

// Factory registration with typed-inject pattern
// Each factory declares its dependencies via static inject
```

---

## 2.11 Serverless Configuration

### serverless.yml (key structure)

```yaml
service: my-flowers-service

provider:
  name: aws
  runtime: nodejs20.x
  region: eu-central-1
  stage: ${opt:stage, 'dev'}
  environment:
    STAGE: ${self:provider.stage}
    COLLECTIONS_TABLE: ${self:service}-collections-${self:provider.stage}
    USER_FLOWERS_TABLE: ${self:service}-user-flowers-${self:provider.stage}
    WATERING_EVENTS_TABLE: ${self:service}-watering-events-${self:provider.stage}
    SENSOR_READINGS_TABLE: ${self:service}-sensor-readings-${self:provider.stage}
    DEVICES_TABLE: ${self:service}-devices-${self:provider.stage}
    PAIRING_CODES_TABLE: ${self:service}-pairing-codes-${self:provider.stage}
    AUTH0_DOMAIN: ${ssm:/autowatering/${self:provider.stage}/auth0-domain}
    AUTH0_AUDIENCE: ${ssm:/autowatering/${self:provider.stage}/auth0-audience}

functions:
  # ── User API ──
  createCollection:
    handler: src/handler/user-api.createCollection
    events:
      - httpApi:
          path: /api/v1/collections
          method: POST
          authorizer: auth0

  # ... other user endpoints

  # ── Device API (no authorizer — uses X-Device-Key) ──
  devicePair:
    handler: src/handler/device-api.pair
    events:
      - httpApi:
          path: /device/v1/pair
          method: POST

  deviceReadings:
    handler: src/handler/device-api.submitReadings
    events:
      - httpApi:
          path: /device/v1/readings
          method: POST

  deviceConfig:
    handler: src/handler/device-api.getConfig
    events:
      - httpApi:
          path: /device/v1/config
          method: GET

resources:
  Resources:
    CollectionsTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: ${self:provider.environment.COLLECTIONS_TABLE}
        BillingMode: PAY_PER_REQUEST
        AttributeDefinitions:
          - { AttributeName: PK, AttributeType: S }
          - { AttributeName: SK, AttributeType: S }
        KeySchema:
          - { AttributeName: PK, KeyType: HASH }
          - { AttributeName: SK, KeyType: RANGE }

    UserFlowersTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: ${self:provider.environment.USER_FLOWERS_TABLE}
        BillingMode: PAY_PER_REQUEST
        AttributeDefinitions:
          - { AttributeName: PK, AttributeType: S }
          - { AttributeName: SK, AttributeType: S }
          - { AttributeName: deviceId, AttributeType: S }
        KeySchema:
          - { AttributeName: PK, KeyType: HASH }
          - { AttributeName: SK, KeyType: RANGE }
        GlobalSecondaryIndexes:
          - IndexName: DeviceIndex
            KeySchema:
              - { AttributeName: deviceId, KeyType: HASH }
            Projection: { ProjectionType: ALL }

    SensorReadingsTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: ${self:provider.environment.SENSOR_READINGS_TABLE}
        BillingMode: PAY_PER_REQUEST
        AttributeDefinitions:
          - { AttributeName: PK, AttributeType: S }
          - { AttributeName: SK, AttributeType: S }
        KeySchema:
          - { AttributeName: PK, KeyType: HASH }
          - { AttributeName: SK, KeyType: RANGE }
        TimeToLiveSpecification:
          AttributeName: ttl
          Enabled: true

    PairingCodesTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: ${self:provider.environment.PAIRING_CODES_TABLE}
        BillingMode: PAY_PER_REQUEST
        AttributeDefinitions:
          - { AttributeName: PK, AttributeType: S }
        KeySchema:
          - { AttributeName: PK, KeyType: HASH }
        TimeToLiveSpecification:
          AttributeName: ttl
          Enabled: true

    # ... WateringEvents, Devices tables follow same pattern
```

---

## 2.12 Integration Testing with LocalStack

### docker-compose.yml

```yaml
services:
  localstack:
    image: localstack/localstack:3
    ports:
      - "4566:4566"
    environment:
      - SERVICES=dynamodb
      - DEFAULT_REGION=eu-central-1
```

### Global Setup (tests/integration/setup/global-setup.ts)

```typescript
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { DynamoDBClient, CreateTableCommand } from "@aws-sdk/client-dynamodb";
import { tableDefinitions } from "./tables";

let container: StartedTestContainer;

export async function setup() {
  container = await new GenericContainer("localstack/localstack:3")
    .withExposedPorts(4566)
    .withEnvironment({ SERVICES: "dynamodb", DEFAULT_REGION: "eu-central-1" })
    .start();

  const endpoint = `http://${container.getHost()}:${container.getMappedPort(4566)}`;
  process.env.DYNAMODB_ENDPOINT = endpoint;
  process.env.AWS_REGION = "eu-central-1";
  process.env.AWS_ACCESS_KEY_ID = "test";
  process.env.AWS_SECRET_ACCESS_KEY = "test";

  // Set table names
  process.env.COLLECTIONS_TABLE = "test-collections";
  process.env.USER_FLOWERS_TABLE = "test-user-flowers";
  // ... other tables

  const client = new DynamoDBClient({ endpoint, region: "eu-central-1" });

  for (const table of tableDefinitions) {
    await client.send(new CreateTableCommand(table));
  }
}

export async function teardown() {
  await container?.stop();
}
```

### vitest.config.ts

```typescript
export default defineConfig({
  test: {
    globalSetup: ["./tests/integration/setup/global-setup.ts"],
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,  // Container startup can be slow
  },
});
```

### Integration Test Example

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { CollectionsService } from "../../src/module/collections/collections.service";
// ... repository imports, setup helpers

describe("CollectionsService", () => {
  let service: CollectionsService;
  const userId = "auth0|test-user-123";

  beforeEach(async () => {
    // Clean tables between tests
    // Initialize service with real repos pointing at LocalStack
    service = await createTestCollectionsService();
  });

  it("should create a collection and retrieve it with enriched flowers", async () => {
    const collection = await service.create(userId, { name: "Living Room" });
    expect(collection.name).toBe("Living Room");
    expect(collection.userFlowerIds).toEqual([]);
    expect(collection.isDefault).toBe(false);

    const retrieved = await service.getWithFlowers(userId, collection.collectionId);
    expect(retrieved.flowers).toEqual([]);
  });

  it("should create default collection on first interaction", async () => {
    await service.ensureDefaultCollection(userId);
    const collections = await service.list(userId);

    expect(collections).toHaveLength(1);
    expect(collections[0].isDefault).toBe(true);
    expect(collections[0].name).toBe("My Collection");
  });
});
```

---

## 2.13 GitHub Packages — Types Publishing

### types/package.json

```json
{
  "name": "@<org>/autowatering-types",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  },
  "peerDependencies": {
    "zod": "^3.0.0"
  }
}
```

### .github/workflows/publish-types.yml

```yaml
name: Publish Types

on:
  push:
    branches: [main]
    paths: ["types/**"]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://npm.pkg.github.com
      - working-directory: types
        run: |
          npm ci
          npm version patch --no-git-tag-version
          npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 2.14 Error Handling

### Custom Error Classes

```typescript
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = "NOT_FOUND";
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = "VALIDATION_ERROR";
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code = "UNAUTHORIZED";
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = "CONFLICT";
}
```

### Handler Error Mapper

```typescript
export function handleError(error: unknown): APIGatewayProxyResult {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      body: JSON.stringify({ code: error.code, message: error.message }),
    };
  }

  // Unknown error — log, do not expose internals
  logger.error("Unhandled error", { error });
  return {
    statusCode: 500,
    body: JSON.stringify({ code: "INTERNAL_ERROR", message: "Internal server error" }),
  };
}
```

Error classes live in the service layer. The handler layer maps them to HTTP responses. This keeps services framework-agnostic.

---
