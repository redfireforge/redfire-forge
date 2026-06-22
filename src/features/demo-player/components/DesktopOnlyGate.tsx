/**
 * DesktopOnlyGate — blocks desktop-only demo lessons in the web build.
 *
 * Shown on the concept slide when `lesson.desktopOnly` is set and the app is
 * not running inside Tauri. Parent keeps Start Demo disabled while this shows.
 */
export default function DesktopOnlyGate() {
  return (
    <div className="prereq-gate prereq-gate--desktop" data-testid="desktop-only-gate">
      <div className="prereq-gate-header">
        <span aria-hidden="true">🖥</span>
        Desktop app required
      </div>
      <p className="prereq-instruction-title">
        This demo uses the GraphQL mock proxy built into the RedfireForge desktop app.
        It is not available in the web version.
      </p>
      <p className="prereq-instruction-note">
        Open RedfireForge as a desktop app to run this lesson. You can still read the concept
        and steps here, but Start Demo stays disabled on web.
      </p>
    </div>
  );
}
