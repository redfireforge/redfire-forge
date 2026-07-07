/** Compile-time feature flags (see `.env.production` / `.env.production.demo`). */
export const DEMO_HUB_ENABLED = import.meta.env.VITE_ENABLE_DEMO_HUB === 'true';
/** Phase 0 foundation flag for gRPC proto hybrid editor (Option B default + Option A modal). */
export const GRPC_PROTO_HYBRID_EDITOR_ENABLED = import.meta.env.VITE_ENABLE_GRPC_PROTO_HYBRID_EDITOR === 'true';
