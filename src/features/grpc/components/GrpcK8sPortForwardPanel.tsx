/** Phase 4J-D — K8s port-forward settings stub (kubectl integration deferred). */
export function GrpcK8sPortForwardPanel() {
  return (
    <div className="grpc-k8s-panel" data-testid="grpc-k8s-panel">
      <div className="grpc-settings-card">
        <div className="grpc-settings-card-header">
          <h3 className="grpc-settings-card-title">Kubernetes Port-Forwarding</h3>
          <span className="grpc-settings-card-chip">Warthog-inspired</span>
        </div>
        <div className="grpc-settings-card-body">
          <p className="grpc-k8s-hint">
            Automatically sets up
            {' '}
            <code className="grpc-inline-code">kubectl port-forward</code>
            {' '}
            to a pod or service in a Kubernetes cluster, then connects gRPC Studio through the forwarded port.
          </p>

          <div className="grpc-k8s-form-grid">
            <div className="grpc-tls-form-row">
              <label className="grpc-tls-form-label" htmlFor="grpc-k8s-namespace">
                Namespace
              </label>
              <div className="grpc-tls-form-ctrl">
                <input
                  id="grpc-k8s-namespace"
                  type="text"
                  className="grpc-tls-text-input"
                  data-testid="grpc-k8s-namespace"
                  defaultValue="default"
                  disabled
                  readOnly
                />
              </div>
            </div>
            <div className="grpc-tls-form-row">
              <label className="grpc-tls-form-label" htmlFor="grpc-k8s-target-type">
                Target type
              </label>
              <div className="grpc-tls-form-ctrl">
                <select
                  id="grpc-k8s-target-type"
                  className="grpc-compression-select"
                  data-testid="grpc-k8s-target-type"
                  defaultValue="service"
                  disabled
                >
                  <option value="service">service</option>
                  <option value="pod">pod</option>
                  <option value="deployment">deployment</option>
                </select>
              </div>
            </div>
            <div className="grpc-tls-form-row">
              <label className="grpc-tls-form-label" htmlFor="grpc-k8s-name">
                Name
              </label>
              <div className="grpc-tls-form-ctrl">
                <input
                  id="grpc-k8s-name"
                  type="text"
                  className="grpc-tls-text-input"
                  data-testid="grpc-k8s-name"
                  placeholder="service/pod name"
                  disabled
                  readOnly
                />
              </div>
            </div>
            <div className="grpc-tls-form-row">
              <label className="grpc-tls-form-label" htmlFor="grpc-k8s-remote-port">
                Remote port
              </label>
              <div className="grpc-tls-form-ctrl">
                <input
                  id="grpc-k8s-remote-port"
                  type="number"
                  className="grpc-tls-text-input"
                  data-testid="grpc-k8s-remote-port"
                  defaultValue={50051}
                  disabled
                  readOnly
                />
              </div>
            </div>
          </div>

          <div className="grpc-tls-form-row">
            <label className="grpc-tls-form-label" htmlFor="grpc-k8s-context">
              Context (kubeconfig)
            </label>
            <div className="grpc-tls-form-ctrl">
              <select
                id="grpc-k8s-context"
                className="grpc-compression-select"
                data-testid="grpc-k8s-context"
                defaultValue=""
                disabled
              >
                <option value="">Select context…</option>
              </select>
            </div>
          </div>

          <div className="grpc-k8s-actions">
            <button
              type="button"
              className="btn btn-primary"
              data-testid="grpc-k8s-start-btn"
              disabled
              title="kubectl port-forward integration is deferred to a future phase"
            >
              Start Port-Forward
            </button>
            <button
              type="button"
              className="btn"
              data-testid="grpc-k8s-stop-btn"
              disabled
            >
              Stop
            </button>
          </div>

          <p className="grpc-k8s-deferred" data-testid="grpc-k8s-deferred">
            kubectl port-forward automation is not wired yet — form fields are preview-only until cluster integration ships.
          </p>
        </div>
      </div>
    </div>
  );
}
