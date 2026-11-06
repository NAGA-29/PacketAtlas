import { describe, expect, it } from 'vitest';
import { ascii, parseHex, readUint, splitBits, uintBytes } from '@/lib/bytes';
import { ARP_OP, arpPacket, BROADCAST, crc32, CRC32_RESIDUE, ETHERTYPE, ethernetFrame, ethernetHeader, mac } from '@/lib/codecs/ethernet';
import { icmpMessage, icmpv6Message, ipv4Header, ipv6Header, PROTO, tcpSegment, TCP_OPT, udpDatagram, verifiesChecksum } from '@/lib/codecs/inet';
import { dhcpMessage, MSG, OFFSET, opt, OPT } from '@/lib/codecs/dhcp';
import { allBytes, bytes, packet } from '../helpers/lesson';

const PC_MAC = mac('00:00:5E:00:53:0A');
const RT_MAC = mac('00:00:5E:00:53:01');
const PC = [192, 0, 2, 10];
const RT = [192, 0, 2, 1];

describe('CRC-32', () => {
  it('よく知られた値:「123456789」の CRC-32 は CBF43926', () => {
    expect(crc32(ascii('123456789'))).toBe(0xcbf43926);
  });
});

describe('Ethernet と ARP 章', () => {
  it('ARP リクエストとリプライ', () => {
    expect(allBytes('ethernet-arp', 'arp-request')).toEqual([...ethernetHeader(BROADCAST, PC_MAC, ETHERTYPE.ARP), ...arpPacket(ARP_OP.request, PC_MAC, PC, [0, 0, 0, 0, 0, 0], RT)]);
    expect(allBytes('ethernet-arp', 'arp-reply')).toEqual([...ethernetHeader(PC_MAC, RT_MAC, ETHERTYPE.ARP), ...arpPacket(ARP_OP.reply, RT_MAC, RT, PC_MAC, PC)]);
  });

  it('フレーム:中身は UDP 章のパケット、60バイトまで埋めて FCS を付ける', () => {
    const udp = udpDatagram({ src: '192.0.2.10', dst: '203.0.113.7', srcPort: 50000, dstPort: 9000, payload: ascii('ping') });
    const ip = ipv4Header({ src: '192.0.2.10', dst: '203.0.113.7', protocol: PROTO.UDP, payloadLength: udp.length, id: 0x1c46, dontFragment: true, ttl: 64 });
    const { frame, padding } = ethernetFrame(RT_MAC, PC_MAC, ETHERTYPE.IPv4, [...ip, ...udp]);
    expect(allBytes('ethernet-arp', 'frame')).toEqual(frame);
    expect(padding).toBe(bytes('ethernet-arp', 'frame', '埋め草').length);
    expect(bytes('ethernet-arp', 'frame', 'IPv4ヘッダー')).toEqual(allBytes('udp', 'ip'));
    expect(bytes('ethernet-arp', 'frame', 'UDP + データ')).toEqual(allBytes('udp', 'send'));
    // FCS 込みで CRC を取ると決まった残余になる(受信側の検査)
    expect(crc32(frame)).toBe(CRC32_RESIDUE);
  });

  it('DHCP のプローブは送信者IPが 0.0.0.0', () => {
    expect(bytes('dhcp', 'probe', '送信者IP')).toEqual([0, 0, 0, 0]);
  });
});

describe('IP 章', () => {
  const syn = tcpSegment({ src: '192.0.2.10', dst: '203.0.113.80', srcPort: 50000, dstPort: 80, seq: 0x1a2b3c4d, ack: 0, flags: 2, window: 64240, options: [...TCP_OPT.mss(1460), 1, ...TCP_OPT.windowScale(7), 1, 1, ...TCP_OPT.sackPermitted] });
  const base = { src: '192.0.2.10', dst: '203.0.113.80', protocol: PROTO.TCP, payloadLength: syn.length, id: 0x5a3e, dontFragment: true };

  it('TCP 章の SYN をそのまま運ぶ', () => {
    expect(syn).toEqual(allBytes('tcp', 'syn'));
  });

  it('TTL 64 → 63 でチェックサムが変わる', () => {
    expect(allBytes('ip', 'header')).toEqual(ipv4Header({ ...base, ttl: 64 }));
    expect(allBytes('ip', 'ttl')).toEqual(ipv4Header({ ...base, ttl: 63 }));
    expect(verifiesChecksum(allBytes('ip', 'ttl'))).toBe(true);
  });

  it('断片2:位置 172 × 8 = 1376、長さ 652、MF=0', () => {
    const h = allBytes('ip', 'fragment');
    expect(h).toEqual(ipv4Header({ src: '192.0.2.10', dst: '203.0.113.80', protocol: PROTO.UDP, payloadLength: 632, id: 0x2b10, fragmentOffset: 172, ttl: 62 }));
    const [, df, mf, off] = splitBits(h.slice(6, 8), [1, 1, 1, 13]);
    expect([df, mf, off]).toEqual([0, 0, 172]);
    expect(1376 % 8).toBe(0);
    expect(20 + 1376).toBeLessThanOrEqual(1400);
    expect(1376 + 632).toBe(2028 - 20);
  });

  it('要分割の ICMP:次の MTU 1400 と元の DF=1 パケット', () => {
    const udp = udpDatagram({ src: '192.0.2.10', dst: '203.0.113.80', srcPort: 50001, dstPort: 9000, payload: new Array(1472).fill(0) });
    const ip = ipv4Header({ src: '192.0.2.10', dst: '203.0.113.80', protocol: PROTO.UDP, payloadLength: udp.length, id: 0x2b11, dontFragment: true, ttl: 63 });
    expect(readUint(ip.slice(2, 4))).toBe(1500);
    expect(allBytes('ip', 'pmtud')).toEqual(icmpMessage(3, 4, [0, 0, ...uintBytes(1400, 2)], [...ip, ...udp.slice(0, 8)]));
  });

  it('IPv6 ヘッダーは40バイト', () => {
    const h = allBytes('ip', 'ipv6');
    expect(h).toHaveLength(40);
    expect(h).toEqual(ipv6Header({ src: '2001:db8::a', dst: '2001:db8:1::50', nextHeader: PROTO.TCP, payloadLength: 32, hopLimit: 64 }));
  });
});

describe('ICMP 章', () => {
  const data = ascii('PacketAtlas!');
  it('Echo Request / Reply', () => {
    expect(allBytes('icmp', 'echo-request')).toEqual(icmpMessage(8, 0, [0x4d, 0x2a, 0x00, 0x01], data));
    expect(allBytes('icmp', 'echo-reply')).toEqual(icmpMessage(0, 0, [0x4d, 0x2a, 0x00, 0x01], data));
    // タイプが 8 → 0 になった分だけチェックサムが 0x0800 ずれる
    expect(readUint(bytes('icmp', 'echo-reply', 'チェックサム')) - readUint(bytes('icmp', 'echo-request', 'チェックサム'))).toBe(0x0800);
  });

  it('Time Exceeded は TTL=1 の元パケットを含む', () => {
    const udp = udpDatagram({ src: '192.0.2.10', dst: '203.0.113.80', srcPort: 50001, dstPort: 33434, payload: [] });
    const ip = ipv4Header({ src: '192.0.2.10', dst: '203.0.113.80', protocol: PROTO.UDP, payloadLength: udp.length, id: 0x7e01, ttl: 1 });
    expect(allBytes('icmp', 'ttl-1')).toEqual(icmpMessage(11, 0, [0, 0, 0, 0], [...ip, ...udp]));
  });

  it('ICMPv6 は IPv6 疑似ヘッダー込みのチェックサム', () => {
    expect(allBytes('icmp', 'icmpv6')).toEqual(icmpv6Message('2001:db8::a', '2001:db8:1::50', 128, 0, [0x4d, 0x2a, 0x00, 0x01], data));
  });
});

describe('DHCP 章(RFC 2131 / 2132)', () => {
  const xid = readUint(bytes('dhcp', 'discover', 'xid'));
  const fixedNames = ['op', 'htype / hlen / hops', 'xid', 'secs', 'flags', 'ciaddr', 'yiaddr', 'siaddr / giaddr', 'chaddr'];
  const fixedOf = (step: string) => fixedNames.flatMap((n) => bytes('dhcp', step, n));
  /** マジッククッキーから後ろのフィールドをつなげる */
  const optionsOf = (step: string) => {
    const fields = packet('dhcp', step).fields;
    return fields.slice(fields.findIndex((f) => f.name === 'マジッククッキー')).flatMap((f) => Array.from(parseHex(f.hex ?? '')));
  };
  const serverOpts = [opt(OPT.SERVER_ID, RT), opt(OPT.LEASE_TIME, uintBytes(86400, 4)), opt(OPT.SUBNET_MASK, [255, 255, 255, 0]), opt(OPT.ROUTER, RT), opt(OPT.DNS, [198, 51, 100, 53])];

  it('Discover:固定部の先頭44バイトとオプション', () => {
    const m = dhcpMessage({ op: 1, xid, broadcast: true, chaddr: PC_MAC, options: [opt(OPT.MESSAGE_TYPE, [MSG.DISCOVER]), opt(OPT.PARAM_REQUEST, [1, 3, 6])] });
    expect(fixedOf('discover')).toEqual(m.slice(0, OFFSET.sname));
    expect(optionsOf('discover')).toEqual(m.slice(OFFSET.cookie));
    expect(m.slice(OFFSET.sname, OFFSET.cookie).every((b) => b === 0)).toBe(true);
    expect(OFFSET.cookie).toBe(236);
  });

  it('Offer / Request / Ack', () => {
    const offer = dhcpMessage({ op: 2, xid, broadcast: true, yiaddr: PC, chaddr: PC_MAC, options: [opt(OPT.MESSAGE_TYPE, [MSG.OFFER]), ...serverOpts] });
    expect(fixedOf('offer')).toEqual(offer.slice(0, OFFSET.sname));
    expect(optionsOf('offer')).toEqual(offer.slice(OFFSET.cookie));
    const req = dhcpMessage({ op: 1, xid, broadcast: true, chaddr: PC_MAC, options: [opt(OPT.MESSAGE_TYPE, [MSG.REQUEST]), opt(OPT.REQUESTED_IP, PC), opt(OPT.SERVER_ID, RT), opt(OPT.PARAM_REQUEST, [1, 3, 6])] });
    expect(optionsOf('request')).toEqual(req.slice(OFFSET.cookie));
    const ack = dhcpMessage({ op: 2, xid, broadcast: true, yiaddr: PC, chaddr: PC_MAC, options: [opt(OPT.MESSAGE_TYPE, [MSG.ACK]), ...serverOpts] });
    expect(optionsOf('ack')).toEqual(ack.slice(OFFSET.cookie));
  });

  it('更新はユニキャストで ciaddr 付き、T1 はリースの半分', () => {
    const ren = dhcpMessage({ op: 1, xid: readUint(bytes('dhcp', 'renew', 'xid')), ciaddr: PC, chaddr: PC_MAC, options: [opt(OPT.MESSAGE_TYPE, [MSG.REQUEST])] });
    expect(fixedOf('renew')).toEqual(ren.slice(0, OFFSET.sname));
    expect(86400 / 2 / 3600).toBe(12);
  });
});
