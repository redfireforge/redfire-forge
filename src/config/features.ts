/** Compile-time feature flags (see `.env.production` / `.env.production.demo`). */
export const DEMO_HUB_ENABLED = import.meta.env.VITE_ENABLE_DEMO_HUB === 'true';
