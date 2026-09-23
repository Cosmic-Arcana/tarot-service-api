import type { StartedTestContainer } from 'testcontainers';

interface ContainerRegistry {
  __COSMIC_ARCANA_CONTAINERS__?: StartedTestContainer[];
}

export const registry = globalThis as ContainerRegistry;
