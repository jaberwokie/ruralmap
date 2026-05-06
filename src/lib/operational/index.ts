/**
 * src/lib/operational — stable import surface for operational logic helpers.
 *
 * Phase One stabilization: this barrel re-exports existing helpers so
 * components can depend on `@/lib/operational/*` instead of reaching into
 * scattered `@/utils` and `@/data` modules. Behavior is unchanged.
 */
export * from './constants';
export * from './types';
export * from './memberAccess';
export * from './fieldResponse';
export * from './providerVisibility';
export * from './corridorLogic';
export * from './accessGaps';
export * from './distance';
export * from './connectivity';
export * from './sorting';
