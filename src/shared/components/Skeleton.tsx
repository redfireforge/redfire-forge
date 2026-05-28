/**
 * Skeleton loading placeholder component with shimmer animation.
 * Use for loading states to provide visual feedback while content loads.
 */
import './Skeleton.css';

interface SkeletonProps {
  /** Width of the skeleton (CSS value, e.g., '100%', '200px') */
  width?: string;
  /** Height of the skeleton (CSS value, e.g., '20px', '1rem') */
  height?: string;
  /** Border radius (CSS value, e.g., '4px', '50%' for circles) */
  borderRadius?: string;
  /** Additional CSS class names */
  className?: string;
  /** Variant presets */
  variant?: 'text' | 'title' | 'avatar' | 'button' | 'card';
}

const VARIANT_STYLES: Record<string, { width: string; height: string; borderRadius: string }> = {
  text: { width: '100%', height: '0.875rem', borderRadius: '4px' },
  title: { width: '60%', height: '1.25rem', borderRadius: '4px' },
  avatar: { width: '40px', height: '40px', borderRadius: '50%' },
  button: { width: '80px', height: '32px', borderRadius: '6px' },
  card: { width: '100%', height: '120px', borderRadius: '8px' },
};

export default function Skeleton({
  width,
  height,
  borderRadius,
  className = '',
  variant,
}: SkeletonProps) {
  const variantStyle = variant ? VARIANT_STYLES[variant] : null;

  const style = {
    width: width ?? variantStyle?.width ?? '100%',
    height: height ?? variantStyle?.height ?? '1rem',
    borderRadius: borderRadius ?? variantStyle?.borderRadius ?? '4px',
  };

  return (
    <div
      className={`skeleton ${className}`}
      style={style}
      role="status"
      aria-label="Loading"
    />
  );
}

interface SkeletonGroupProps {
  /** Number of skeleton items to render */
  count?: number;
  /** Gap between items (CSS value) */
  gap?: string;
  /** Props passed to each Skeleton */
  itemProps?: SkeletonProps;
  /** Additional CSS class names for the container */
  className?: string;
}

export function SkeletonGroup({
  count = 3,
  gap = '8px',
  itemProps = {},
  className = '',
}: SkeletonGroupProps) {
  return (
    <div className={`skeleton-group ${className}`} style={{ gap }}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} {...itemProps} />
      ))}
    </div>
  );
}
