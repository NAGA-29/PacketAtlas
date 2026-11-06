import { describe, expect, it } from 'vitest';
import { ascii, parseHex, readUint } from '@/lib/bytes';
import { DYNAMIC_BASE, FLAG, FRAME, frame, hpack, hpackInt, PREFACE, SETTING, settings, STATIC } from '@/lib/codecs/http2';
import { decodeAckFrame, decodeVarint, encodeVarint, H3, H3_SETTING, H3_STREAM, h3Frame, LONG_TYPE, longHeaderFirstByte, qpack, QPACK_STATIC, streamFrameType, streamKind } from '@/lib/codecs/quic';
import { extensions } from '@/lib/codecs/tls';
import { header, encodeName, question, rr, pointer, TYPE } from '@/lib/codecs/dns';
import { tcpSegment, TCP_OPT, verifiesChecksum, pseudoHeader, PROTO } from '@/lib/codecs/inet';
import { HTML_BODY } from '@/lessons/ja/http11';
import { allBytes, bytes, field, packet } from '../helpers/lesson';

const unescape = (s: string) => s.replace(/␍␊/g, '\r\n');

describe('HTTP/1.1 章', () => {
  it('Content-Length は本文のバイト数', () => {
    const len = Number(field('http11', 'response', 'Content-Length').text?.match(/\d+/)?.[0]);
    expect(new TextEncoder().encode(HTML_BODY).length).toBe(len);
    expect(field('http11', 'response', '本文').text).toBe(HTML_BODY);
  });

  it('chunked の長さ(16進)が中身と一致し、つなげると元に戻る', () => {
    const f = (n: string) => unescape(field('http11', 'chunked', n).text ?? '');
    const chunks = [
      [f('塊1の長さ'), f('塊1')],
      [f('塊2の長さ'), f('塊2')],
    ] as const;
    let body = '';
    for (const [size, data] of chunks) {
      const n = parseInt(size.trim(), 16);
      expect(data.endsWith('\r\n')).toBe(true);
      const content = data.slice(0, -2);
      expect(new TextEncoder().encode(content).length).toBe(n);
      body += content;
    }
    expect(body).toBe('The first chunk of text.\r\nAnd the rest.\r\n');
    expect(f('終わり')).toBe('0\r\n\r\n');
  });

  it('リクエストの各行は CRLF で終わり、空行で終わる', () => {
    for (const step of ['request', 'keep-alive', 'conditional']) {
      const lines = packet('http11', step).fields.map((x) => x.text ?? '');
      for (const l of lines) expect(l.endsWith('␍␊'), `${step}: ${l}`).toBe(true);
      expect(lines.at(-1)).toBe('␍␊');
      expect(lines[1]).toBe('Host: example.com␍␊');
    }
  });

  it('If-None-Match は前回の ETag と同じ', () => {
    const etag = field('http11', 'response', 'ETag').text?.split(': ')[1];
    expect(field('http11', 'conditional', 'If-None-Match').text?.split(': ')[1]).toBe(etag);
  });
});

describe('HTTPS(通し)章', () => {
  it('DNS 応答は example.com → 203.0.113.80', () => {
    const name = encodeName('example.com');
    expect(allBytes('https', 'dns')).toEqual([...header(0x2c61, { qr: true, rd: true, ra: true }, { qd: 1, an: 1 }), ...question(name, TYPE.A), ...rr(pointer(12), TYPE.A, 3600, [203, 0, 113, 80])]);
  });

  it('443 番への SYN', () => {
    const syn = tcpSegment({ src: '192.0.2.10', dst: '203.0.113.80', srcPort: 50002, dstPort: 443, seq: 0x7c1d2e3f, ack: 0, flags: 2, window: 64240, options: [...TCP_OPT.mss(1460), 1, ...TCP_OPT.windowScale(7), 1, 1, ...TCP_OPT.sackPermitted] });
    expect(allBytes('https', 'tcp')).toEqual(syn);
    expect(verifiesChecksum([...pseudoHeader('192.0.2.10', '203.0.113.80', PROTO.TCP, syn.length), ...syn])).toBe(true);
  });

  it('TLS と HTTP のパケットは各章と同じもの', () => {
    expect(packet('https', 'tls')).toBe(packet('tls13', 'client-hello'));
    expect(packet('https', 'request')).toBe(packet('tls13', 'application-data'));
    expect(packet('https', 'response').fields).toBe(packet('http11', 'response').fields);
    expect(field('tls13', 'client-hello', 'server_name').desc).toContain('example.com');
  });
});

describe('HPACK(RFC 7541)', () => {
  it('付録 C.3.1 の例(ハフマンなし)を再現できる', () => {
    const block = [...hpack.indexed(2), ...hpack.indexed(6), ...hpack.indexed(4), ...hpack.incremental(1, 'www.example.com')];
    expect(block).toEqual(Array.from(parseHex('82 86 84 41 0F 77 77 77 2E 65 78 61 6D 70 6C 65 2E 63 6F 6D')));
  });

  it('付録 C.1 の整数表現:10 と 1337(5bit 接頭辞)', () => {
    expect(hpackInt(10, 5)).toEqual([0x0a]);
    expect(hpackInt(1337, 5)).toEqual([0x1f, 0x9a, 0x0a]);
    expect(hpackInt(42, 8)).toEqual([0x2a]);
  });

  it('静的テーブルの番号が本文の説明と合う', () => {
    expect(STATIC[2]).toEqual([':method', 'GET']);
    expect(STATIC[7]).toEqual([':scheme', 'https']);
    expect(STATIC[4]).toEqual([':path', '/']);
    expect(STATIC[1]?.[0]).toBe(':authority');
  });
});

describe('HTTP/2 章(RFC 9113)', () => {
  it('ALPN 拡張', () => {
    expect(allBytes('http2', 'alpn')).toEqual(extensions.alpn(['h2', 'http/1.1']));
  });

  it('プリフェイスと SETTINGS', () => {
    expect(bytes('http2', 'preface', 'プリフェイス')).toEqual(PREFACE);
    expect(allBytes('http2', 'preface').slice(PREFACE.length)).toEqual(frame(FRAME.SETTINGS, 0, 0, settings([[SETTING.MAX_CONCURRENT_STREAMS, 100], [SETTING.INITIAL_WINDOW_SIZE, 65535]])));
  });

  it('HEADERS(ストリーム1)と、動的テーブルを使う HEADERS(ストリーム3)', () => {
    const f = FLAG.END_STREAM | FLAG.END_HEADERS;
    expect(allBytes('http2', 'headers')).toEqual(frame(FRAME.HEADERS, f, 1, [...hpack.indexed(2), ...hpack.indexed(7), ...hpack.indexed(4), ...hpack.incremental(1, 'example.com')]));
    expect(allBytes('http2', 'hpack')).toEqual(frame(FRAME.HEADERS, f, 3, [...hpack.indexed(2), ...hpack.indexed(7), ...hpack.withoutIndexing(4, '/style.css'), ...hpack.indexed(DYNAMIC_BASE)]));
    expect(bytes('http2', 'hpack', ':authority')).toEqual([0xbe]);
  });

  it('DATA と WINDOW_UPDATE', () => {
    expect(allBytes('http2', 'multiplex')).toEqual(frame(FRAME.DATA, 0, 3, ascii('body{margin:0}')));
    expect(allBytes('http2', 'flow-control')).toEqual(frame(FRAME.WINDOW_UPDATE, 0, 0, [0, 1, 0, 0]));
  });
});

describe('HTTP/3 と QUIC 章(RFC 9114 / 9000 / 9204)', () => {
  it('CRYPTO フレームの長さ = ハンドシェイクのヘッダー4 + 本体', () => {
    expect(decodeVarint(bytes('http3', 'initial', '長さ')).value).toBe(4 + readUint(bytes('http3', 'initial', 'ハンドシェイク型・長さ').slice(1)));
    expect(bytes('http3', 'initial', 'ALPN')).toEqual(extensions.alpn(['h3']));
  });

  it('Handshake パケットの先頭バイト', () => {
    expect(bytes('http3', 'handshake', '先頭バイト')).toEqual([longHeaderFirstByte(LONG_TYPE.handshake, 2)]);
  });

  it('制御ストリームの SETTINGS', () => {
    const payload = [...encodeVarint(H3_STREAM.CONTROL), ...h3Frame(H3.SETTINGS, [H3_SETTING.QPACK_MAX_TABLE_CAPACITY, 0, H3_SETTING.QPACK_BLOCKED_STREAMS, 0])];
    expect(allBytes('http3', 'control')).toEqual([streamFrameType(false, true, false), 0x02, payload.length, ...payload]);
    expect(streamKind(2)).toEqual({ initiator: 'client', bidi: false });
  });

  it('リクエストの HEADERS と QPACK', () => {
    const fieldSection = [...qpack.prefix, ...qpack.indexedStatic(17), ...qpack.indexedStatic(23), ...qpack.indexedStatic(1), ...qpack.literalWithStaticName(0, 'example.com')];
    const h3 = h3Frame(H3.HEADERS, fieldSection);
    expect(allBytes('http3', 'request')).toEqual([streamFrameType(false, true, true), 0x00, h3.length, ...h3]);
    expect(QPACK_STATIC[17]).toEqual([':method', 'GET']);
    expect(QPACK_STATIC[23]).toEqual([':scheme', 'https']);
    expect(streamKind(4)).toEqual({ initiator: 'client', bidi: true });
  });

  it('ACK フレームから #6 だけが欠けていると読める', () => {
    const ack = decodeAckFrame(allBytes('http3', 'no-hol'));
    expect(ack.largest).toBe(10);
    expect(ack.delay * 2 ** 3).toBe(200);
    expect(ack.received).toEqual([
      [7, 10],
      [0, 5],
    ]);
  });
});
