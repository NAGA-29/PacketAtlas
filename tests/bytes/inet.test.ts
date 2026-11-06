import { describe, expect, it } from 'vitest';
import { ascii, parseHex, readUint, splitBits } from '@/lib/bytes';
import { icmpMessage, internetChecksum, ipv4Header, PROTO, pseudoHeader, seqAdd, TCP_FLAG, TCP_OPT, tcpSegment, udpDatagram, verifiesChecksum } from '@/lib/codecs/inet';
import { allBytes, bytes } from '../helpers/lesson';

const CLIENT = '192.0.2.10';
const UDP_SERVER = '203.0.113.7';
const WEB = '203.0.113.80';

describe('インターネットチェックサム(RFC 1071)', () => {
  it('RFC 1071 3章の数値例:00 01 F2 03 F4 F5 F6 F7 の和は DDF2', () => {
    expect(internetChecksum(parseHex('00 01 F2 03 F4 F5 F6 F7'))).toBe(~0xddf2 & 0xffff);
  });
  it('奇数長は末尾に 0 を補う', () => {
    expect(internetChecksum([0x01])).toBe(internetChecksum([0x01, 0x00]));
  });
});

describe('UDP 章', () => {
  it('手順1のデータグラムを再計算すると一致する', () => {
    expect(allBytes('udp', 'send')).toEqual(udpDatagram({ src: CLIENT, dst: UDP_SERVER, srcPort: 50000, dstPort: 9000, payload: ascii('ping') }));
  });

  it('疑似ヘッダー込みで和を取ると 0 になる(受信側の検査)', () => {
    const d = allBytes('udp', 'send');
    expect(verifiesChecksum([...allBytes('udp', 'checksum'), ...d])).toBe(true);
    expect(allBytes('udp', 'checksum')).toEqual(pseudoHeader(CLIENT, UDP_SERVER, PROTO.UDP, d.length));
  });

  it('IPv4 ヘッダー:長さ・プロトコル・チェックサム', () => {
    const ip = allBytes('udp', 'ip');
    expect(ip).toEqual(ipv4Header({ src: CLIENT, dst: UDP_SERVER, protocol: PROTO.UDP, payloadLength: allBytes('udp', 'send').length, id: 0x1c46, dontFragment: true, ttl: 64 }));
    expect(verifiesChecksum(ip)).toBe(true);
    expect(splitBits(bytes('udp', 'ip', 'フラグ + 断片位置'), [1, 1, 1, 13])).toEqual([0, 1, 0, 0]);
  });

  it('返事と #2 のデータグラム', () => {
    expect(allBytes('udp', 'reply')).toEqual(udpDatagram({ src: UDP_SERVER, dst: CLIENT, srcPort: 9000, dstPort: 50000, payload: ascii('pong') }));
    expect(allBytes('udp', 'loss')).toEqual(udpDatagram({ src: CLIENT, dst: UDP_SERVER, srcPort: 50000, dstPort: 9000, payload: [0, 0, 0, 2, ...ascii('move')] }));
  });

  it('ICMP ポート到達不能:TTL が減った元のヘッダーと UDP ヘッダーを含む', () => {
    const original = udpDatagram({ src: CLIENT, dst: UDP_SERVER, srcPort: 50000, dstPort: 9001, payload: ascii('ping') });
    const arrived = ipv4Header({ src: CLIENT, dst: UDP_SERVER, protocol: PROTO.UDP, payloadLength: original.length, id: 0x1c47, dontFragment: true, ttl: 56 });
    expect(allBytes('udp', 'unreachable')).toEqual(icmpMessage(3, 3, [0, 0, 0, 0], [...arrived, ...original.slice(0, 8)]));
    expect(verifiesChecksum(allBytes('udp', 'unreachable'))).toBe(true);
  });
});

describe('TCP 章', () => {
  const cIsn = readUint(bytes('tcp', 'syn', 'シーケンス番号'));
  const sIsn = readUint(bytes('tcp', 'syn-ack', 'シーケンス番号'));
  const opts = [...TCP_OPT.mss(1460), ...TCP_OPT.nop, ...TCP_OPT.windowScale(7), ...TCP_OPT.nop, ...TCP_OPT.nop, ...TCP_OPT.sackPermitted];
  const c2s = { src: CLIENT, dst: WEB, srcPort: 50000, dstPort: 80 };
  const s2c = { src: WEB, dst: CLIENT, srcPort: 80, dstPort: 50000 };
  const F = TCP_FLAG;

  it('SYN / SYN-ACK / ACK を再計算すると一致する', () => {
    expect(allBytes('tcp', 'syn')).toEqual(tcpSegment({ ...c2s, seq: cIsn, ack: 0, flags: F.SYN, window: 64240, options: opts }));
    expect(allBytes('tcp', 'syn-ack')).toEqual(tcpSegment({ ...s2c, seq: sIsn, ack: seqAdd(cIsn, 1), flags: F.SYN | F.ACK, window: 65160, options: opts }));
    expect(allBytes('tcp', 'ack')).toEqual(tcpSegment({ ...c2s, seq: seqAdd(cIsn, 1), ack: seqAdd(sIsn, 1), flags: F.ACK, window: 502 }));
  });

  it('データ「hello」の次の番号は 6', () => {
    expect(allBytes('tcp', 'data')).toEqual(tcpSegment({ ...c2s, seq: seqAdd(cIsn, 1), ack: seqAdd(sIsn, 1), flags: F.PSH | F.ACK, window: 502, payload: ascii('hello') }));
  });

  it('重複ACKと SACK ブロック(相対 1466〜2926)', () => {
    const sack = TCP_OPT.sack([[seqAdd(cIsn, 1466), seqAdd(cIsn, 2926)]]);
    expect(allBytes('tcp', 'retransmit')).toEqual(
      tcpSegment({ ...s2c, seq: seqAdd(sIsn, 1), ack: seqAdd(cIsn, 6), flags: F.ACK, window: 509, options: [...TCP_OPT.nop, ...TCP_OPT.nop, ...sack] }),
    );
    expect(1466 - 6).toBe(1460);
    expect(2926 - 1466).toBe(1460);
  });

  it('ゼロウィンドウと FIN', () => {
    expect(allBytes('tcp', 'window')).toEqual(tcpSegment({ ...s2c, seq: seqAdd(sIsn, 1), ack: seqAdd(cIsn, 2926), flags: F.ACK, window: 0 }));
    expect(allBytes('tcp', 'fin')).toEqual(tcpSegment({ ...c2s, seq: seqAdd(cIsn, 2926), ack: seqAdd(sIsn, 1), flags: F.FIN | F.ACK, window: 502 }));
  });

  it('ウィンドウスケール 7 で 502 は 64256 バイト', () => {
    expect(readUint(bytes('tcp', 'ack', 'ウィンドウ')) * 2 ** 7).toBe(64256);
  });

  it('全セグメントが疑似ヘッダー込みの検査を通る', () => {
    for (const [id, from] of [['syn', c2s], ['syn-ack', s2c], ['ack', c2s], ['data', c2s], ['retransmit', s2c], ['window', s2c], ['fin', c2s]] as const) {
      const seg = allBytes('tcp', id);
      expect(verifiesChecksum([...pseudoHeader(from.src, from.dst, PROTO.TCP, seg.length), ...seg]), id).toBe(true);
    }
  });
});
