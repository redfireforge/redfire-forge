interface Props {
  onImport: () => void;
}

export default function CatalogWelcome({ onImport }: Props) {
  return (
    <div className="cat-welcome">
      <div className="cat-welcome-hero">
        <div className="cat-welcome-hero-content">
          <div className="cat-welcome-badge">API CATALOG</div>
          <h1 className="cat-welcome-title">
            Design, explore &amp; test your APIs
          </h1>
          <p className="cat-welcome-desc">
            Import an OpenAPI specification to browse endpoints, execute
            requests, track version changes, and promote tests directly to the
            Harness.
          </p>
          <button className="cat-welcome-btn" onClick={onImport}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Import Spec
          </button>
        </div>

        <div className="cat-welcome-graphic">
          <div className="cat-welcome-gfx-ring cat-welcome-gfx-ring--outer" />
          <div className="cat-welcome-gfx-ring cat-welcome-gfx-ring--inner" />
          <svg className="cat-welcome-gfx-icon" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
      </div>

      <div className="cat-welcome-grid">
        <div className="cat-welcome-card">
          <div className="cat-welcome-card-icon cat-welcome-card-icon--blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h3 className="cat-welcome-card-title">Browse Endpoints</h3>
          <p className="cat-welcome-card-desc">
            Explore every route, method, parameter, and schema from your spec
            in a structured tree.
          </p>
        </div>

        <div className="cat-welcome-card">
          <div className="cat-welcome-card-icon cat-welcome-card-icon--green">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <h3 className="cat-welcome-card-title">Try It Out</h3>
          <p className="cat-welcome-card-desc">
            Send live requests with pre-filled parameters and inspect
            responses — no extra tooling needed.
          </p>
        </div>

        <div className="cat-welcome-card">
          <div className="cat-welcome-card-icon cat-welcome-card-icon--purple">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <h3 className="cat-welcome-card-title">Version Tracking</h3>
          <p className="cat-welcome-card-desc">
            Import updated specs and diff changes between versions to catch
            regressions early.
          </p>
        </div>

        <div className="cat-welcome-card">
          <div className="cat-welcome-card-icon cat-welcome-card-icon--amber">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <h3 className="cat-welcome-card-title">Export to Harness</h3>
          <p className="cat-welcome-card-desc">
            Promote any endpoint into a reusable performance test with one
            click — ready to run.
          </p>
        </div>
      </div>

      <div className="cat-welcome-formats">
        <span className="cat-welcome-format-label">Supported formats</span>
        <div className="cat-welcome-format-tags">
          <span className="cat-welcome-format-tag">OpenAPI 3.0</span>
          <span className="cat-welcome-format-tag">OpenAPI 3.1</span>
          <span className="cat-welcome-format-tag">Swagger 2.0</span>
          <span className="cat-welcome-format-tag">YAML</span>
          <span className="cat-welcome-format-tag">JSON</span>
        </div>
      </div>
    </div>
  );
}
