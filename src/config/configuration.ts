export interface OutboxConfig {
  relayEnabled: boolean;
  pollIntervalMs: number;
  batchSize: number;
  deliveryAttempts: number;
  deliveryBackoffMs: number;
}

export interface AiServiceConfig {
  /** `stub` keeps generation local and deterministic; `ai-service` calls ai-service-api over tcp. */
  generator: 'stub' | 'ai-service';
  host: string;
  port: number;
  timeoutMs: number;
}

export interface AppConfig {
  serviceName: string;
  nodeEnv: string;
  logLevel: string;
  http: { port: number };
  database: { url: string; runMigrations: boolean };
  redis: { host: string; port: number };
  aiService: AiServiceConfig;
  outbox: OutboxConfig;
}

export const configuration = (): AppConfig => ({
  serviceName: 'tarot-service-api',
  nodeEnv: process.env.NODE_ENV as string,
  logLevel: process.env.LOG_LEVEL as string,
  http: { port: Number(process.env.HTTP_PORT) },
  database: {
    url: process.env.DATABASE_URL as string,
    runMigrations: process.env.DATABASE_RUN_MIGRATIONS === 'true',
  },
  redis: { host: process.env.REDIS_HOST as string, port: Number(process.env.REDIS_PORT) },
  aiService: {
    generator: process.env.SPREAD_GENERATOR as AiServiceConfig['generator'],
    host: process.env.AI_SERVICE_TCP_HOST as string,
    port: Number(process.env.AI_SERVICE_TCP_PORT),
    timeoutMs: Number(process.env.AI_SERVICE_TIMEOUT_MS),
  },
  outbox: {
    relayEnabled: process.env.OUTBOX_RELAY_ENABLED === 'true',
    pollIntervalMs: Number(process.env.OUTBOX_POLL_INTERVAL_MS),
    batchSize: Number(process.env.OUTBOX_BATCH_SIZE),
    deliveryAttempts: Number(process.env.EVENT_DELIVERY_ATTEMPTS),
    deliveryBackoffMs: Number(process.env.EVENT_DELIVERY_BACKOFF_MS),
  },
});
