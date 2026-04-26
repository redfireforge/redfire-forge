interface Props {
  onImport: () => void;
}

export default function CatalogWelcome({ onImport }: Props) {
  return (
    <div className="cat-welcome">
      <div className="cat-welcome-icon">📋</div>
      <h2 className="cat-welcome-title">API Catalog</h2>
      <p className="cat-welcome-desc">
        Import an OpenAPI specification to get started.
        <br />
        Browse endpoints, test them interactively, and
        <br />
        track spec versions over time.
      </p>
      <button className="cat-btn cat-btn-primary cat-btn-lg" onClick={onImport}>
        + Import Spec
      </button>
      <div className="cat-welcome-formats">
        <div>Supported formats:</div>
        <ul>
          <li>OpenAPI 3.0, 3.1</li>
          <li>Swagger 2.0</li>
          <li>YAML and JSON</li>
        </ul>
      </div>
    </div>
  );
}
