// RFC 8446 TLS 1.3 のレコードとハンドシェイク(検証用。暗号処理はしない)
import { ascii, uintBytes } from '../bytes';

export const CONTENT = { change_cipher_spec: 20, alert: 21, handshake: 22, application_data: 23 } as const;
export const HS = { client_hello: 1, server_hello: 2, new_session_ticket: 4, encrypted_extensions: 8, certificate: 11, certificate_verify: 15, finished: 20 } as const;
export const EXT = {
  server_name: 0x0000,
  supported_groups: 0x000a,
  signature_algorithms: 0x000d,
  alpn: 0x0010,
  pre_shared_key: 0x0029,
  early_data: 0x002a,
  supported_versions: 0x002b,
  psk_key_exchange_modes: 0x002d,
  key_share: 0x0033,
} as const;
export const SUITE = { TLS_AES_128_GCM_SHA256: 0x1301, TLS_AES_256_GCM_SHA384: 0x1302, TLS_CHACHA20_POLY1305_SHA256: 0x1303 } as const;
export const GROUP = { x25519: 0x001d, secp256r1: 0x0017 } as const;
export const SIG = { ecdsa_secp256r1_sha256: 0x0403, rsa_pss_rsae_sha256: 0x0804, ed25519: 0x0807 } as const;
export const TLS13 = 0x0304;

/** 長さ len バイトの長さ欄を前に付ける */
export const vec = (lenBytes: number, body: number[]): number[] => [...uintBytes(body.length, lenBytes), ...body];

export const record = (type: number, body: number[], legacyVersion = 0x0303): number[] => [type, ...uintBytes(legacyVersion, 2), ...vec(2, body)];

export const handshake = (type: number, body: number[]): number[] => [type, ...vec(3, body)];

export const ext = (type: number, data: number[]): number[] => [...uintBytes(type, 2), ...vec(2, data)];

export const ext16List = (values: number[]): number[] => vec(2, values.flatMap((v) => uintBytes(v, 2)));

export const extensions = {
  serverName: (host: string) => ext(EXT.server_name, vec(2, [0x00, ...vec(2, ascii(host))])),
  supportedGroups: (groups: number[]) => ext(EXT.supported_groups, ext16List(groups)),
  signatureAlgorithms: (algs: number[]) => ext(EXT.signature_algorithms, ext16List(algs)),
  alpn: (protos: string[]) => ext(EXT.alpn, vec(2, protos.flatMap((p) => vec(1, ascii(p))))),
  supportedVersionsClient: (versions: number[]) => ext(EXT.supported_versions, vec(1, versions.flatMap((v) => uintBytes(v, 2)))),
  supportedVersionsServer: (version: number) => ext(EXT.supported_versions, uintBytes(version, 2)),
  keyShareClient: (group: number, key: number[]) => ext(EXT.key_share, vec(2, [...uintBytes(group, 2), ...vec(2, key)])),
  keyShareServer: (group: number, key: number[]) => ext(EXT.key_share, [...uintBytes(group, 2), ...vec(2, key)]),
  pskModes: (modes: number[]) => ext(EXT.psk_key_exchange_modes, vec(1, modes)),
};

export interface ClientHelloSpec {
  random: number[];
  sessionId?: number[];
  suites: number[];
  extensions: number[][];
}

export const clientHello = (s: ClientHelloSpec): number[] =>
  handshake(HS.client_hello, [
    0x03,
    0x03,
    ...s.random,
    ...vec(1, s.sessionId ?? []),
    ...ext16List(s.suites),
    0x01,
    0x00,
    ...vec(2, s.extensions.flat()),
  ]);

export const serverHello = (s: { random: number[]; sessionId?: number[]; suite: number; extensions: number[][] }): number[] =>
  handshake(HS.server_hello, [0x03, 0x03, ...s.random, ...vec(1, s.sessionId ?? []), ...uintBytes(s.suite, 2), 0x00, ...vec(2, s.extensions.flat())]);

/** TLSInnerPlaintext = 中身 + 本当のコンテンツタイプ + ゼロ埋め */
export const innerPlaintext = (content: number[], type: number, padding = 0): number[] => [...content, type, ...new Array(padding).fill(0)];

/** AEAD(AES-GCM / ChaCha20-Poly1305)のタグ長 */
export const AEAD_TAG = 16;
