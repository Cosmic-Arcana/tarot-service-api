import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'log', 'debug', 'verbose').default('log'),

  HTTP_PORT: Joi.number().port().default(3004),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  DATABASE_RUN_MIGRATIONS: Joi.boolean().default(true),

  SPREAD_GENERATOR: Joi.string().valid('stub', 'ai-service').default('stub'),
  AI_SERVICE_TCP_HOST: Joi.string().hostname().default('127.0.0.1'),
  AI_SERVICE_TCP_PORT: Joi.number().port().default(4001),
  AI_SERVICE_TIMEOUT_MS: Joi.number().integer().min(100).default(20_000),

  REDIS_HOST: Joi.string().hostname().default('127.0.0.1'),
  REDIS_PORT: Joi.number().port().default(6379),

  OUTBOX_RELAY_ENABLED: Joi.boolean().default(true),
  OUTBOX_POLL_INTERVAL_MS: Joi.number().integer().min(50).default(1_000),
  OUTBOX_BATCH_SIZE: Joi.number().integer().min(1).max(1_000).default(50),
  EVENT_DELIVERY_ATTEMPTS: Joi.number().integer().min(1).max(50).default(10),
  EVENT_DELIVERY_BACKOFF_MS: Joi.number().integer().min(100).default(1_000),
});
