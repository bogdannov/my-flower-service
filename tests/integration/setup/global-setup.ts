import { CreateTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GenericContainer, Wait } from "testcontainers";
import type { StartedTestContainer } from "testcontainers";
import { TEST_TABLE_NAMES, tableDefinitions } from "./tables";

let container: StartedTestContainer;

export async function setup() {
  container = await new GenericContainer("localstack/localstack:3")
    .withExposedPorts(4566)
    .withEnvironment({ SERVICES: "dynamodb", DEFAULT_REGION: "eu-central-1" })
    .withWaitStrategy(Wait.forListeningPorts())
    .start();

  const mappedPort = container.getMappedPort(4566);
  const endpoint = `http://${container.getHost()}:${mappedPort}`;

  process.env.DYNAMODB_ENDPOINT = endpoint;
  process.env.AWS_REGION = "eu-central-1";
  process.env.AWS_ACCESS_KEY_ID = "test";
  process.env.AWS_SECRET_ACCESS_KEY = "test";
  process.env.STAGE = "dev";
  process.env.AUTH0_DOMAIN = "test.auth0.com";
  process.env.AUTH0_AUDIENCE = "test-audience";
  process.env.COLLECTIONS_TABLE = TEST_TABLE_NAMES.collections;
  process.env.USER_FLOWERS_TABLE = TEST_TABLE_NAMES.userFlowers;
  process.env.WATERING_EVENTS_TABLE = TEST_TABLE_NAMES.wateringEvents;
  process.env.SENSOR_READINGS_TABLE = TEST_TABLE_NAMES.sensorReadings;
  process.env.DEVICES_TABLE = TEST_TABLE_NAMES.devices;
  process.env.PAIRING_CODES_TABLE = TEST_TABLE_NAMES.pairingCodes;
  process.env.LOG_LEVEL = "error";

  const client = new DynamoDBClient({
    endpoint,
    region: "eu-central-1",
    credentials: {
      accessKeyId: "test",
      secretAccessKey: "test",
    },
  });

  for (const table of tableDefinitions) {
    await client.send(new CreateTableCommand(table));
  }
}

export async function teardown() {
  await container?.stop();
}
