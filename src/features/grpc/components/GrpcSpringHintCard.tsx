import { GRPC_SPRING_HINT_COPY, type GrpcStudioHintId } from '../utils/grpcSpringHints';

export interface GrpcSpringHintCardProps {
  hintId: GrpcStudioHintId;
  onDismiss: () => void;
}

export function GrpcSpringHintCard({ hintId, onDismiss }: GrpcSpringHintCardProps) {
  const copy = GRPC_SPRING_HINT_COPY[hintId];

  return (
    <aside
      className="grpc-spring-hint-card"
      data-testid={`grpc-spring-hint-${hintId}`}
      role="note"
      aria-label={copy.title}
    >
      <div className="grpc-spring-hint-card-content">
        <p className="grpc-spring-hint-card-title">{copy.title}</p>
        <p className="grpc-spring-hint-card-body">{copy.body}</p>
      </div>
      <button
        type="button"
        className="grpc-spring-hint-dismiss-btn"
        data-testid={`grpc-spring-hint-dismiss-${hintId}`}
        aria-label={`Dismiss ${copy.title} hint`}
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </aside>
  );
}
