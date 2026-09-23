import { MiddlewareConsumer, Module, NestModule, ValidationPipe } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { BullModule } from '@nestjs/bullmq';
import { configuration, type AppConfig } from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { CorrelationMiddleware } from './common/correlation/correlation.middleware';
import { LoggingInterceptor } from './common/logging/logging.interceptor';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { OutboxModule } from './outbox/outbox.module';
import { SpreadsModule } from './spreads/spreads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),
    CqrsModule.forRoot(),
    DatabaseModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: config.getOrThrow<AppConfig['redis']>('redis'),
      }),
    }),
    OutboxModule,
    SpreadsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes('{*splat}');
  }
}
