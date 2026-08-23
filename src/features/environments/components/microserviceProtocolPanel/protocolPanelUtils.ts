import type { ProtocolKey } from '@shared/types';
import type { EndpointRowStatus } from '../../utils/protocolEndpointUtils';

export function statusChipClass(status: EndpointRowStatus): string {
  switch (status) {
    case 'explicit': return 'em-url-status--ok';
    case 'fallback': return 'em-url-status--fallback';
    case 'unresolved': return 'em-url-status--unresolved';
    case 'empty': return 'em-url-status--empty';
  }
}

export function protocolHint(protocol: ProtocolKey): string {
  switch (protocol) {
    case 'http': return 'REST / JSON APIs';
    case 'websocket': return 'ws:// / wss://';
    case 'sse': return 'Server-Sent Events';
    case 'graphql': return 'GraphQL API';
    case 'grpc': return 'gRPC / protobuf';
    default: return '';
  }
}
