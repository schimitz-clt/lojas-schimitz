/**
 * Seed entry re-export. Implementation is in apps/api so the API Docker build
 * (`tsc`, rootDir ./src) does not pull this file in from a spec import.
 * Behavior is the same module seed.ts already calls.
 */
export {
  isProductionPlaceholderSeedEnv,
  shouldInsertPlaceholderProductImages,
  type PlaceholderSeedEnv,
} from '../apps/api/src/modules/catalog/seed-placeholder-policy';
