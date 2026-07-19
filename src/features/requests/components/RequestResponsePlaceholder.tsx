export default function RequestResponsePlaceholder() {
  return (
    <div className="req-response-placeholder" data-testid="req-response-placeholder">
      <svg
        className="req-response-placeholder-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M22 2 11 13" />
        <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
      </svg>
      <span className="req-response-placeholder-title">No response yet</span>
      <span className="req-response-placeholder-hint">Click <strong>Send</strong> to get a response</span>
    </div>
  );
}
