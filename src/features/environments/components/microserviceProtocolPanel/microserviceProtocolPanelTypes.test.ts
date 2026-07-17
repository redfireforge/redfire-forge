import { describe, expect, it } from 'vitest';
import { MICROSERVICE_PROTOCOL_PANEL_TYPES_RUNTIME_MARKER } from './microserviceProtocolPanelTypes';

describe('microserviceProtocolPanelTypes runtime marker', () => {
  it('exports a stable runtime marker', () => {
    expect(MICROSERVICE_PROTOCOL_PANEL_TYPES_RUNTIME_MARKER).toBe('microservice-protocol-panel-types');
  });
});
