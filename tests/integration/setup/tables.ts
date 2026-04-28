import type { CreateTableInput } from "@aws-sdk/client-dynamodb";

export const TEST_TABLE_NAMES = {
  collections: "test-collections",
  userFlowers: "test-user-flowers",
  wateringEvents: "test-watering-events",
  sensorReadings: "test-sensor-readings",
  devices: "test-devices",
  pairingCodes: "test-pairing-codes",
} as const;

export const tableDefinitions: CreateTableInput[] = [
  {
    TableName: TEST_TABLE_NAMES.collections,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],
  },
  {
    TableName: TEST_TABLE_NAMES.userFlowers,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
      { AttributeName: "deviceId", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "DeviceIndex",
        KeySchema: [{ AttributeName: "deviceId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  },
  {
    TableName: TEST_TABLE_NAMES.wateringEvents,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],
  },
  {
    TableName: TEST_TABLE_NAMES.sensorReadings,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],
  },
  {
    TableName: TEST_TABLE_NAMES.devices,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [{ AttributeName: "PK", AttributeType: "S" }],
    KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }],
  },
  {
    TableName: TEST_TABLE_NAMES.pairingCodes,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [{ AttributeName: "PK", AttributeType: "S" }],
    KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }],
  },
];
