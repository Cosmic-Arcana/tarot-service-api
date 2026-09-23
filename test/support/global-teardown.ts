import { registry } from './containers';

export default async function globalTeardown(): Promise<void> {
  await Promise.all((registry.__COSMIC_ARCANA_CONTAINERS__ ?? []).map((c) => c.stop()));
}
