import { describe, it, expect } from 'vitest';
import {
  decodeSioPacket,
  getSioPacketSummary,
  encodeSioEvent,
  encodeSioConnect,
  encodeSioPong,
  isSioPing,
  isSioOpen,
  ENGINE_TYPES,
  SOCKET_TYPES,
} from './socketIoCodec';

describe('socketIoCodec', () => {
  describe('decodeSioPacket', () => {
    it('decodes Engine.IO OPEN packet', () => {
      const raw = '0{"sid":"abc123","upgrades":[],"pingInterval":25000,"pingTimeout":20000}';
      const pkt = decodeSioPacket(raw);
      expect(pkt.engineType).toBe(ENGINE_TYPES.OPEN);
      expect(pkt.engineTypeName).toBe('OPEN');
      expect(pkt.openPayload).toEqual({
        sid: 'abc123',
        upgrades: [],
        pingInterval: 25000,
        pingTimeout: 20000,
      });
      expect(pkt.socketType).toBeUndefined();
    });

    it('decodes Engine.IO OPEN with malformed JSON', () => {
      const pkt = decodeSioPacket('0{broken');
      expect(pkt.engineType).toBe(ENGINE_TYPES.OPEN);
      expect(pkt.openPayload).toBeUndefined();
    });

    it('decodes Engine.IO PING', () => {
      const pkt = decodeSioPacket('2');
      expect(pkt.engineType).toBe(ENGINE_TYPES.PING);
      expect(pkt.engineTypeName).toBe('PING');
    });

    it('decodes Engine.IO PONG', () => {
      const pkt = decodeSioPacket('3');
      expect(pkt.engineType).toBe(ENGINE_TYPES.PONG);
      expect(pkt.engineTypeName).toBe('PONG');
    });

    it('decodes Engine.IO CLOSE', () => {
      const pkt = decodeSioPacket('1');
      expect(pkt.engineType).toBe(ENGINE_TYPES.CLOSE);
    });

    it('decodes Engine.IO NOOP', () => {
      const pkt = decodeSioPacket('6');
      expect(pkt.engineType).toBe(ENGINE_TYPES.NOOP);
    });

    it('decodes Engine.IO UPGRADE', () => {
      const pkt = decodeSioPacket('5');
      expect(pkt.engineType).toBe(ENGINE_TYPES.UPGRADE);
    });

    it('decodes empty string as NOOP', () => {
      const pkt = decodeSioPacket('');
      expect(pkt.engineType).toBe(ENGINE_TYPES.NOOP);
    });

    it('decodes Socket.IO CONNECT (default namespace)', () => {
      const pkt = decodeSioPacket('40');
      expect(pkt.engineType).toBe(ENGINE_TYPES.MESSAGE);
      expect(pkt.socketType).toBe(SOCKET_TYPES.CONNECT);
      expect(pkt.socketTypeName).toBe('CONNECT');
      expect(pkt.namespace).toBeUndefined();
    });

    it('decodes Socket.IO CONNECT with namespace', () => {
      const pkt = decodeSioPacket('40/chat,');
      expect(pkt.socketType).toBe(SOCKET_TYPES.CONNECT);
      expect(pkt.namespace).toBe('/chat');
    });

    it('decodes Socket.IO DISCONNECT', () => {
      const pkt = decodeSioPacket('41');
      expect(pkt.socketType).toBe(SOCKET_TYPES.DISCONNECT);
    });

    it('decodes Socket.IO EVENT', () => {
      const pkt = decodeSioPacket('42["message","hello world"]');
      expect(pkt.engineType).toBe(ENGINE_TYPES.MESSAGE);
      expect(pkt.socketType).toBe(SOCKET_TYPES.EVENT);
      expect(pkt.socketTypeName).toBe('EVENT');
      expect(pkt.eventName).toBe('message');
      expect(pkt.data).toEqual(['message', 'hello world']);
    });

    it('decodes Socket.IO EVENT with object payload', () => {
      const pkt = decodeSioPacket('42["chat",{"text":"hi","from":"user1"}]');
      expect(pkt.eventName).toBe('chat');
      expect(pkt.data).toEqual(['chat', { text: 'hi', from: 'user1' }]);
    });

    it('decodes Socket.IO EVENT with namespace', () => {
      const pkt = decodeSioPacket('42/admin,["notify","alert!"]');
      expect(pkt.socketType).toBe(SOCKET_TYPES.EVENT);
      expect(pkt.namespace).toBe('/admin');
      expect(pkt.eventName).toBe('notify');
    });

    it('decodes Socket.IO ACK', () => {
      const pkt = decodeSioPacket('4315["received"]');
      expect(pkt.socketType).toBe(SOCKET_TYPES.ACK);
      expect(pkt.ackId).toBe(15);
      expect(pkt.data).toEqual(['received']);
    });

    it('decodes Socket.IO ACK with namespace', () => {
      const pkt = decodeSioPacket('43/ns,7["ok"]');
      expect(pkt.socketType).toBe(SOCKET_TYPES.ACK);
      expect(pkt.namespace).toBe('/ns');
      expect(pkt.ackId).toBe(7);
    });

    it('decodes Socket.IO CONNECT_ERROR', () => {
      const pkt = decodeSioPacket('44{"message":"unauthorized"}');
      expect(pkt.socketType).toBe(SOCKET_TYPES.CONNECT_ERROR);
      expect(pkt.data).toEqual({ message: 'unauthorized' });
    });

    it('decodes Socket.IO BINARY_EVENT', () => {
      const pkt = decodeSioPacket('452-["file",{"_placeholder":true,"num":0}]');
      expect(pkt.socketType).toBe(SOCKET_TYPES.BINARY_EVENT);
      expect(pkt.eventName).toBe('file');
      expect(pkt.ackId).toBeUndefined();
    });

    it('decodes Socket.IO BINARY_EVENT with ACK id', () => {
      const pkt = decodeSioPacket('451-7["binary",{"_placeholder":true,"num":0}]');
      expect(pkt.socketType).toBe(SOCKET_TYPES.BINARY_EVENT);
      expect(pkt.ackId).toBe(7);
      expect(pkt.eventName).toBe('binary');
    });

    it('decodes Socket.IO BINARY_ACK', () => {
      const pkt = decodeSioPacket('461-["response"]');
      expect(pkt.socketType).toBe(SOCKET_TYPES.BINARY_ACK);
      expect(pkt.ackId).toBeUndefined();
      expect(pkt.data).toEqual(['response']);
    });

    it('decodes Socket.IO BINARY_ACK with ACK id', () => {
      const pkt = decodeSioPacket('461-3["ok",{"_placeholder":true}]');
      expect(pkt.socketType).toBe(SOCKET_TYPES.BINARY_ACK);
      expect(pkt.ackId).toBe(3);
    });

    it('decodes EVENT with ACK id', () => {
      const pkt = decodeSioPacket('42123["request","data"]');
      expect(pkt.socketType).toBe(SOCKET_TYPES.EVENT);
      expect(pkt.ackId).toBe(123);
      expect(pkt.eventName).toBe('request');
    });

    it('handles Socket.IO MESSAGE with empty payload', () => {
      const pkt = decodeSioPacket('4');
      expect(pkt.engineType).toBe(ENGINE_TYPES.MESSAGE);
      expect(pkt.socketType).toBeUndefined();
    });

    it('handles non-JSON data gracefully', () => {
      const pkt = decodeSioPacket('42not-json');
      expect(pkt.socketType).toBe(SOCKET_TYPES.EVENT);
      expect(pkt.data).toBe('not-json');
      expect(pkt.eventName).toBeUndefined();
    });
  });

  describe('getSioPacketSummary', () => {
    it('summarizes OPEN with sid', () => {
      const pkt = decodeSioPacket('0{"sid":"xyz789","upgrades":[],"pingInterval":25000,"pingTimeout":20000}');
      expect(getSioPacketSummary(pkt)).toBe('OPEN (sid: xyz789…)');
    });

    it('summarizes OPEN without payload', () => {
      const pkt = decodeSioPacket('0{broken');
      expect(getSioPacketSummary(pkt)).toBe('OPEN');
    });

    it('summarizes PING', () => {
      const pkt = decodeSioPacket('2');
      expect(getSioPacketSummary(pkt)).toBe('PING');
    });

    it('summarizes PONG', () => {
      const pkt = decodeSioPacket('3');
      expect(getSioPacketSummary(pkt)).toBe('PONG');
    });

    it('summarizes CLOSE', () => {
      const pkt = decodeSioPacket('1');
      expect(getSioPacketSummary(pkt)).toBe('CLOSE');
    });

    it('summarizes EVENT with event name', () => {
      const pkt = decodeSioPacket('42["chat_msg","hello"]');
      expect(getSioPacketSummary(pkt)).toBe('EVENT: chat_msg');
    });

    it('summarizes EVENT with namespace', () => {
      const pkt = decodeSioPacket('42/chat,["msg","hi"]');
      expect(getSioPacketSummary(pkt)).toBe('EVENT: msg [/chat]');
    });

    it('summarizes EVENT without parsable event name', () => {
      const pkt = decodeSioPacket('42not-json');
      expect(getSioPacketSummary(pkt)).toBe('EVENT: ?');
    });

    it('summarizes ACK', () => {
      const pkt = decodeSioPacket('4312["ok"]');
      expect(getSioPacketSummary(pkt)).toBe('ACK #12');
    });

    it('summarizes CONNECT', () => {
      const pkt = decodeSioPacket('40');
      expect(getSioPacketSummary(pkt)).toBe('CONNECT');
    });

    it('summarizes CONNECT with namespace', () => {
      const pkt = decodeSioPacket('40/admin,');
      expect(getSioPacketSummary(pkt)).toBe('CONNECT [/admin]');
    });

    it('summarizes DISCONNECT', () => {
      const pkt = decodeSioPacket('41');
      expect(getSioPacketSummary(pkt)).toBe('DISCONNECT');
    });

    it('summarizes CONNECT_ERROR', () => {
      const pkt = decodeSioPacket('44{"message":"bad"}');
      expect(getSioPacketSummary(pkt)).toBe('CONNECT_ERROR');
    });

    it('summarizes NOOP', () => {
      const pkt = decodeSioPacket('6');
      expect(getSioPacketSummary(pkt)).toBe('NOOP');
    });

    it('summarizes UPGRADE', () => {
      const pkt = decodeSioPacket('5');
      expect(getSioPacketSummary(pkt)).toBe('UPGRADE');
    });

    it('summarizes BINARY_EVENT with event name', () => {
      const pkt = decodeSioPacket('452-["upload",{"_placeholder":true}]');
      expect(getSioPacketSummary(pkt)).toBe('BINARY_EVENT: upload');
    });

    it('summarizes BINARY_EVENT with namespace', () => {
      const pkt = decodeSioPacket('45/files,1-["save",{"_placeholder":true}]');
      expect(getSioPacketSummary(pkt)).toBe('BINARY_EVENT: save [/files]');
    });

    it('summarizes BINARY_ACK', () => {
      const pkt = decodeSioPacket('461-["ok"]');
      expect(getSioPacketSummary(pkt)).toBe('BINARY_ACK #?');
    });

    it('summarizes BINARY_ACK with ack id', () => {
      const pkt = decodeSioPacket('461-5["done"]');
      expect(getSioPacketSummary(pkt)).toBe('BINARY_ACK #5');
    });
  });

  describe('encodeSioEvent', () => {
    it('encodes simple event', () => {
      expect(encodeSioEvent('message', 'hello')).toBe('42["message","hello"]');
    });

    it('encodes event with object payload', () => {
      expect(encodeSioEvent('data', { key: 'val' })).toBe('42["data",{"key":"val"}]');
    });

    it('encodes event without payload', () => {
      expect(encodeSioEvent('ping')).toBe('42["ping"]');
    });

    it('encodes event with namespace', () => {
      expect(encodeSioEvent('msg', 'hi', '/chat')).toBe('42/chat,["msg","hi"]');
    });

    it('encodes event with default namespace (/) — no prefix', () => {
      expect(encodeSioEvent('msg', 'hi', '/')).toBe('42["msg","hi"]');
    });

    it('encodes event with ack id', () => {
      expect(encodeSioEvent('req', 'data', undefined, 5)).toBe('425["req","data"]');
    });

    it('encodes event with namespace and ack id', () => {
      expect(encodeSioEvent('req', 'data', '/ns', 10)).toBe('42/ns,10["req","data"]');
    });

    it('encodes event with null payload', () => {
      expect(encodeSioEvent('test', null)).toBe('42["test",null]');
    });

    it('encodes event with array payload', () => {
      expect(encodeSioEvent('batch', [1, 2, 3])).toBe('42["batch",[1,2,3]]');
    });
  });

  describe('encodeSioConnect', () => {
    it('encodes connect to default namespace', () => {
      expect(encodeSioConnect()).toBe('40');
    });

    it('encodes connect to default namespace with /', () => {
      expect(encodeSioConnect('/')).toBe('40');
    });

    it('encodes connect to custom namespace', () => {
      expect(encodeSioConnect('/admin')).toBe('40/admin,');
    });
  });

  describe('encodeSioPong', () => {
    it('returns pong packet', () => {
      expect(encodeSioPong()).toBe('3');
    });
  });

  describe('isSioPing', () => {
    it('returns true for "2"', () => {
      expect(isSioPing('2')).toBe(true);
    });

    it('returns true for "2probe"', () => {
      expect(isSioPing('2probe')).toBe(true);
    });

    it('returns false for "3"', () => {
      expect(isSioPing('3')).toBe(false);
    });

    it('returns false for "42["event"]"', () => {
      expect(isSioPing('42["event"]')).toBe(false);
    });
  });

  describe('isSioOpen', () => {
    it('returns true for open packet', () => {
      expect(isSioOpen('0{"sid":"abc"}')).toBe(true);
    });

    it('returns true for bare "0"', () => {
      expect(isSioOpen('0')).toBe(true);
    });

    it('returns false for CONNECT packet "40"', () => {
      expect(isSioOpen('40')).toBe(false);
    });

    it('returns false for event packet', () => {
      expect(isSioOpen('42["msg"]')).toBe(false);
    });
  });
});
