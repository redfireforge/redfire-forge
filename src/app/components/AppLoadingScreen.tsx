export default function AppLoadingScreen() {
  return (
    <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ textAlign: 'center', opacity: 0.7 }}>
        <h2>RedfireForge</h2>
        <p>Loading...</p>
      </div>
    </div>
  );
}
