import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';

export const createTestApp = async (
  configure: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<INestApplication> => {
  const moduleRef = await configure(Test.createTestingModule({ imports: [AppModule] })).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  return app;
};

export const resetDatabase = async (dataSource: DataSource): Promise<void> => {
  await dataSource.query('TRUNCATE spread, spread_card, outbox');
};

export const countRows = async (dataSource: DataSource, table: string): Promise<number> => {
  const [{ count }] = await dataSource.query<[{ count: string }]>(
    `SELECT count(*)::text AS count FROM ${table}`,
  );
  return Number(count);
};
