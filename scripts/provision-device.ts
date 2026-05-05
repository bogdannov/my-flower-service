/**
 * Device provisioning script — run once per batch of devices at factory time.
 *
 * Usage:
 *   npx ts-node scripts/provision-device.ts --count 10 --prefix mf --stage dev
 *
 * Output (stdout):
 *   deviceId,rawApiKey
 *   mf-00001,mf-00001.<64 hex chars>
 *   ...
 *
 * SECURITY: Raw API keys are printed to stdout ONLY — never written to disk.
 * Pipe the output to a secure location managed by your team.
 *
 * The script writes device records to DynamoDB with status "unlinked".
 * The raw API key must be flashed to ESP32 NVS by the developer.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createHash, randomBytes } from "node:crypto";

// ── CLI arg parsing ──

function parseArgs(): { count: number; prefix: string; stage: string } {
  const args = process.argv.slice(2);
  let count: number | undefined;
  let prefix = "mf";
  let stage = "dev";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--count" && args[i + 1]) {
      count = parseInt(args[++i], 10);
    } else if (args[i] === "--prefix" && args[i + 1]) {
      prefix = args[++i];
    } else if (args[i] === "--stage" && args[i + 1]) {
      stage = args[++i];
    }
  }

  if (!count || count < 1) {
    process.stderr.write("Error: --count <number> is required and must be >= 1\n");
    process.exit(1);
  }

  return { count, prefix, stage };
}

// ── Helpers ──

function buildTableName(stage: string): string {
  return process.env.DEVICES_TABLE ?? `autowatering-backend-devices-${stage}`;
}

interface ProvisionedDevice {
  deviceId: string;
  rawApiKey: string;
  record: Record<string, unknown>;
}

function generateDevice(deviceId: string): ProvisionedDevice {
  const rawApiKey = `${deviceId}.${randomBytes(32).toString("hex")}`;
  const apiKeyHash = createHash("sha256").update(rawApiKey).digest("hex");

  const record: Record<string, unknown> = {
    PK: deviceId,
    deviceId,
    userFlowerId: null,
    userId: null,
    apiKeyHash,
    status: "unlinked",
    firmwareVersion: null,
    pairedAt: null,
    lastSeenAt: null,
  };

  return { deviceId, rawApiKey, record };
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ── Main ──

async function main(): Promise<void> {
  const { count, prefix, stage } = parseArgs();
  const tableName = buildTableName(stage);

  const client = DynamoDBDocumentClient.from(
    new DynamoDBClient({
      region: process.env.AWS_REGION ?? "eu-central-1",
      ...(process.env.DYNAMODB_ENDPOINT ? { endpoint: process.env.DYNAMODB_ENDPOINT } : {}),
    }),
  );

  const devices: ProvisionedDevice[] = [];

  for (let i = 1; i <= count; i++) {
    const deviceId = `${prefix}-${String(i).padStart(5, "0")}`;
    devices.push(generateDevice(deviceId));
  }

  // BatchWriteItem in chunks of 25 (DynamoDB hard limit per request)
  for (const chunk of chunkArray(devices, 25)) {
    await client.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: chunk.map((d) => ({ PutRequest: { Item: d.record } })),
        },
      }),
    );
  }

  // Print CSV to stdout ONLY — never to a file
  process.stdout.write("deviceId,rawApiKey\n");
  for (const { deviceId, rawApiKey } of devices) {
    process.stdout.write(`${deviceId},${rawApiKey}\n`);
  }

  process.stderr.write(`\nProvisioned ${count} device(s) to table: ${tableName}\n`);
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal error: ${String(err)}\n`);
  process.exit(1);
});
