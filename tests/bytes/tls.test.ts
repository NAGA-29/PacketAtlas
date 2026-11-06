import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { connect } from 'node:net';
import { createServer } from 'node:tls';
import { ascii, readUint } from '@/lib/bytes';
import { AEAD_TAG, clientHello, CONTENT, EXT, extensions as E, GROUP, HS, record, serverHello, SIG, SUITE, TLS13 } from '@/lib/codecs/tls';
import { allBytes, bytes, field } from '../helpers/lesson';

const chExtensions = () => [
  E.serverName('example.com'),
  E.supportedGroups([GROUP.x25519, GROUP.secp256r1]),
  E.signatureAlgorithms([SIG.ecdsa_secp256r1_sha256, SIG.rsa_pss_rsae_sha256, SIG.ed25519]),
  E.supportedVersionsClient([TLS13]),
  E.keyShareClient(GROUP.x25519, bytes('tls13', 'client-hello', 'key_share').slice(10)),
  E.pskModes([1]),
];

/** ローカルの TLS サーバー(Node / OpenSSL)にバイト列を送り、最初の応答を受け取る */
const sendToRealServer = (payload: number[]): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const server = createServer({
      key: readFileSync(new URL('../fixtures/test-only-key.pem', import.meta.url)),
      cert: readFileSync(new URL('../fixtures/test-only-cert.pem', import.meta.url)),
    });
    server.on('tlsClientError', () => {});
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') return reject(new Error('no port'));
      let buf = Buffer.alloc(0);
      const sock = connect(addr.port, '127.0.0.1', () => sock.write(Buffer.from(payload)));
      const done = () => {
        sock.destroy();
        server.close();
        resolve(buf);
      };
      sock.on('data', (d: Buffer) => {
        buf = Buffer.concat([buf, d]);
        if (buf.length >= 5 && buf.length >= 5 + buf.readUInt16BE(3)) done();
      });
      sock.on('error', reject);
      setTimeout(done, 3000);
    });
  });

describe('TLS 1.3 章(RFC 8446)', () => {
  it('ClientHello を再計算すると一致する(長さの欄がすべて正しい)', () => {
    const ch = record(CONTENT.handshake, clientHello({ random: bytes('tls13', 'client-hello', 'random'), suites: [SUITE.TLS_AES_128_GCM_SHA256, SUITE.TLS_AES_256_GCM_SHA384, SUITE.TLS_CHACHA20_POLY1305_SHA256], extensions: chExtensions() }), 0x0301);
    expect(allBytes('tls13', 'client-hello')).toEqual(ch);
  });

  it('ClientHello を本物の TLS サーバーに送ると TLS 1.3 の ServerHello が返る', async () => {
    const res = await sendToRealServer(allBytes('tls13', 'client-hello'));
    expect(res[0]).toBe(CONTENT.handshake);
    expect(res[5]).toBe(HS.server_hello);
    const hex = res.subarray(0, 5 + res.readUInt16BE(3)).toString('hex');
    expect(hex).toContain('002b00020304'); // supported_versions = TLS 1.3
    expect(hex).toContain('0033002400' + '1d0020'); // x25519 の key_share
  });

  it('ServerHello を再計算すると一致する', () => {
    const sh = record(
      CONTENT.handshake,
      serverHello({ random: bytes('tls13', 'server-hello', 'random'), suite: SUITE.TLS_AES_128_GCM_SHA256, extensions: [E.supportedVersionsServer(TLS13), E.keyShareServer(GROUP.x25519, bytes('tls13', 'server-hello', 'key_share').slice(8))] }),
    );
    expect(allBytes('tls13', 'server-hello')).toEqual(sh);
    expect(readUint(bytes('tls13', 'server-hello', 'supported_versions').slice(0, 2))).toBe(EXT.supported_versions);
  });

  it('暗号化レコードの長さ:Finished と HTTP リクエスト', () => {
    expect(readUint(bytes('tls13', 'client-finished', 'レコード:長さ'))).toBe(4 + 32 + 1 + AEAD_TAG);
    expect(readUint(bytes('tls13', 'client-finished', 'ハンドシェイク長'))).toBe(32);
    expect(bytes('tls13', 'client-finished', 'ハンドシェイク型')).toEqual([HS.finished]);
    const req = ascii('GET / HTTP/1.1\r\nHost: example.com\r\n\r\n');
    expect(readUint(bytes('tls13', 'application-data', '長さ'))).toBe(req.length + 1 + AEAD_TAG);
    expect(bytes('tls13', 'server-flight', 'タイプ')).toEqual([CONTENT.application_data]);
  });

  it('NewSessionTicket の長さと early_data', () => {
    const parts = ['ticket_lifetime', 'ticket_age_add', 'ticket_nonce', 'ticket の長さ', '拡張の長さ', 'early_data'].map((n) => bytes('tls13', 'resumption', n));
    const ticketLen = readUint(bytes('tls13', 'resumption', 'ticket の長さ'));
    const total = parts.reduce((a, p) => a + p.length, 0) + ticketLen;
    expect(readUint(bytes('tls13', 'resumption', 'ハンドシェイク長'))).toBe(total);
    expect(readUint(bytes('tls13', 'resumption', 'ticket_lifetime'))).toBeLessThanOrEqual(604800);
    const ed = bytes('tls13', 'resumption', 'early_data');
    expect(readUint(ed.slice(0, 2))).toBe(EXT.early_data);
    expect(readUint(ed.slice(4))).toBe(16384);
    expect(field('tls13', 'resumption', 'early_data').desc).toContain('16384');
  });
});
