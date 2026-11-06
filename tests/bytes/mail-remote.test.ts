import { describe, expect, it } from 'vitest';
import { ascii, readUint } from '@/lib/bytes';
import { binaryPacket, kexinitPayload, MIN_BLOCK, MIN_PADDING, MSG, nameList, paddingFor, sshString, uint32 } from '@/lib/codecs/ssh';
import { getLesson } from '@/lessons';
import { bytes, field, packet } from '../helpers/lesson';

/** text の ␍␊ を CRLF に戻す */
const raw = (s: string) => s.replace(/␍␊/g, '\r\n');
const packetsOf = (lesson: string) => (getLesson(lesson)?.steps ?? []).flatMap((s) => (s.packet ? [s.packet] : []));
const octets = (s: string) => new TextEncoder().encode(s).length;

describe('テキストのプロトコルの行は CRLF で終わる', () => {
  for (const lesson of ['smtp', 'pop3', 'imap', 'ftp', 'http11']) {
    it(lesson, () => {
      // 回線を流れる(layers がある)パケットのテキスト行だけを見る。「…」は省略の印。
      // HTTP の本文は行ではなくバイト列(Content-Length で長さを示す)なので除く
      const steps = packetsOf(lesson).filter((p) => p.layers);
      expect(steps.length).toBeGreaterThan(0);
      for (const p of steps) for (const f of p.fields) if (f.text && f.text !== '…' && !(lesson === 'http11' && f.name === '本文')) expect(f.text.endsWith('␍␊'), `${p.name}: ${f.text}`).toBe(true);
    });
  }
});

describe('SMTP 章', () => {
  it('AUTH PLAIN は「\\0ユーザー\\0パスワード」の Base64', () => {
    const b64 = field('smtp', 'submission', 'クライアント').text?.match(/AUTH PLAIN (\S+)␍␊/)?.[1] ?? '';
    expect(Buffer.from(b64, 'base64').toString()).toBe('\0alice@example.net\0secret');
  });

  it('EHLO の複数行応答:最後の行だけ「250 」', () => {
    const replies = packet('smtp', 'ehlo').fields.filter((f) => f.name === 'サーバー').map((f) => f.text ?? '').slice(1);
    replies.slice(0, -1).forEach((l) => expect(l.startsWith('250-')).toBe(true));
    expect(replies.at(-1)?.startsWith('250 ')).toBe(true);
  });

  it('DATA:ドットスタッフィングを外すと元の本文、SIZE はメッセージのバイト数', () => {
    const f = packet('smtp', 'data').fields;
    const start = f.findIndex((x) => x.name === 'From');
    const end = f.findIndex((x) => x.name === '終わり');
    const sent = f.slice(start, end).map((x) => raw(x.text ?? ''));
    expect(f[end]?.text).toBe('.␍␊');
    // 送る側:「.」で始まる行は「..」にする
    const original = sent.map((l) => (l.startsWith('..') ? l.slice(1) : l));
    expect(original.some((l) => l.startsWith('.and'))).toBe(true);
    for (const l of sent) expect(l === '.\r\n' || !(l.startsWith('.') && !l.startsWith('..'))).toBe(true);
    const size = Number(field('smtp', 'envelope', 'クライアント').text?.match(/SIZE=(\d+)/)?.[1]);
    expect(size).toBe(octets(original.join('')));
  });

  it('封筒の差出人・宛先はヘッダーの From / To と同じアドレス', () => {
    expect(field('smtp', 'envelope', 'クライアント').text).toContain('<alice@example.net>');
    expect(field('smtp', 'data', 'From').text).toContain('<alice@example.net>');
    expect(field('smtp', 'data', 'To').text).toContain('<bob@example.com>');
  });
});

describe('POP3 章', () => {
  it('STAT の合計は LIST の大きさの和', () => {
    const stat = field('pop3', 'stat-list', 'サーバー').text?.match(/\+OK (\d+) (\d+)/);
    const sizes = ['1通目', '2通目'].map((n) => Number(field('pop3', 'stat-list', n).text?.split(' ')[1]?.replace('␍␊', '')));
    expect(Number(stat?.[1])).toBe(sizes.length);
    expect(Number(stat?.[2])).toBe(sizes.reduce((a, b) => a + b, 0));
    expect(field('pop3', 'retr', 'サーバー').text).toContain(`${sizes[0]} octets`);
  });

  it('応答はすべて +OK か -ERR で始まる', () => {
    for (const step of ['greeting', 'login', 'dele', 'quit']) {
      for (const f of packet('pop3', step).fields.filter((x) => x.name === 'サーバー')) expect(f.text).toMatch(/^(\+OK|-ERR)/);
    }
  });
});

describe('IMAP 章', () => {
  it('リテラル {52} の後ろはちょうど 52 バイト', () => {
    const n = Number(field('imap', 'fetch', 'サーバー').text?.match(/\{(\d+)\}␍␊$/)?.[1]);
    const lit = packet('imap', 'fetch').fields.filter((f) => f.name === 'リテラル').map((f) => raw(f.text ?? '')).join('');
    expect(octets(lit)).toBe(n);
  });

  it('タグ付きの完了応答は、そのコマンドと同じタグ', () => {
    for (const step of ['login', 'select', 'fetch', 'store', 'idle']) {
      const tag = packet('imap', step).fields.find((f) => f.name === 'クライアント')?.text?.split(' ')[0];
      const done = packet('imap', step).fields.filter((f) => f.name === 'サーバー').at(-1)?.text ?? '';
      expect(tag).toMatch(/^a\d{3}$/);
      expect(done.startsWith(`${tag} OK`), step).toBe(true);
    }
  });

  it('IDLE で届いた新着は SELECT のときより1通多い', () => {
    const before = Number(packet('imap', 'select').fields.find((f) => f.text?.endsWith('EXISTS␍␊'))?.text?.match(/\* (\d+)/)?.[1]);
    const after = Number(packet('imap', 'idle').fields.find((f) => f.text?.endsWith('EXISTS␍␊'))?.text?.match(/\* (\d+)/)?.[1]);
    expect(after).toBe(before + 1);
  });
});

describe('FTP 章', () => {
  const hostPort = (s: string) => {
    const m = s.match(/(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)/);
    if (!m) throw new Error(s);
    const n = m.slice(1).map(Number);
    return { ip: n.slice(0, 4).join('.'), port: (n[4] ?? 0) * 256 + (n[5] ?? 0) };
  };
  it('PASV の6つの数字は 203.0.113.21:50069', () => {
    expect(hostPort(packet('ftp', 'pasv').fields[1]?.text ?? '')).toEqual({ ip: '203.0.113.21', port: 50069 });
  });
  it('PORT の6つの数字は 192.0.2.10:50000', () => {
    expect(hostPort(packet('ftp', 'active').fields[0]?.text ?? '')).toEqual({ ip: '192.0.2.10', port: 50000 });
  });
});

describe('SSH 章(RFC 4253)', () => {
  it('バージョン文字列', () => {
    const v = [...bytes('ssh', 'version', 'プロトコル版'), ...bytes('ssh', 'version', 'ソフトの名前'), ...bytes('ssh', 'version', '改行')];
    expect(v).toEqual(ascii('SSH-2.0-ExampleSSH_1.0\r\n'));
    expect(v.length).toBeLessThanOrEqual(255);
  });

  it('KEXINIT の中身を再計算すると一致し、長さと詰め物の規則を満たす', () => {
    const payload = kexinitPayload({
      cookie: bytes('ssh', 'kexinit', 'cookie'),
      kex: ['curve25519-sha256'],
      hostKey: ['ssh-ed25519'],
      encryption: ['aes128-ctr'],
      mac: ['hmac-sha2-256'],
      compression: ['none'],
    });
    const names = ['メッセージ番号', 'cookie', '鍵交換', 'ホスト鍵', '暗号(往・復)', 'MAC(往・復)', '圧縮(往・復)', '言語(往・復)', '推測で先に送るか', '予約'];
    expect(names.flatMap((n) => bytes('ssh', 'kexinit', n))).toEqual(payload);
    const pad = readUint(bytes('ssh', 'kexinit', '詰め物の長さ'));
    expect(pad).toBe(paddingFor(payload.length));
    expect(readUint(bytes('ssh', 'kexinit', 'パケット長'))).toBe(1 + payload.length + pad);
    expect((4 + 1 + payload.length + pad) % MIN_BLOCK).toBe(0);
    expect(pad).toBeGreaterThanOrEqual(MIN_PADDING);
    expect(field('ssh', 'kexinit', '詰め物').desc).toContain(`${pad}バイト`);
  });

  it('KEX_ECDH_INIT と NEWKEYS のパケット長', () => {
    const q = bytes('ssh', 'ecdh', '公開鍵 Q_C');
    const payload = [MSG.KEX_ECDH_INIT, ...q];
    expect(q.slice(0, 4)).toEqual(uint32(32));
    const pad = paddingFor(payload.length);
    expect(binaryPacket(payload, new Array(pad).fill(0)).slice(0, 5)).toEqual([...bytes('ssh', 'ecdh', 'パケット長'), ...bytes('ssh', 'ecdh', '詰め物の長さ')]);
    // 公開鍵は TLS 1.3 章の ClientHello と同じ例の値
    expect(q.slice(4)).toEqual(bytes('tls13', 'client-hello', 'key_share').slice(10));
    const nk = binaryPacket([MSG.NEWKEYS], new Array(paddingFor(1)).fill(0));
    expect(nk.slice(0, 6)).toEqual([...bytes('ssh', 'newkeys', 'パケット長'), ...bytes('ssh', 'newkeys', '詰め物の長さ'), ...bytes('ssh', 'newkeys', 'メッセージ番号')]);
  });

  it('USERAUTH_REQUEST と CHANNEL_OPEN', () => {
    const ua = ['メッセージ番号', 'ユーザー名', 'サービス', '方式', '署名あり', '鍵の種類'].flatMap((n) => bytes('ssh', 'userauth', n));
    expect(ua).toEqual([MSG.USERAUTH_REQUEST, ...sshString('bob'), ...sshString('ssh-connection'), ...sshString('publickey'), 1, ...sshString('ssh-ed25519')]);
    const co = ['メッセージ番号', 'チャネルの種類', '送信側のチャネル番号', '受信枠', '最大パケット'].flatMap((n) => bytes('ssh', 'channel', n));
    expect(co).toEqual([MSG.CHANNEL_OPEN, ...sshString('session'), ...uint32(0), ...uint32(2097152), ...uint32(32768)]);
    expect(nameList(['a', 'b'])).toEqual([0, 0, 0, 3, 0x61, 0x2c, 0x62]);
  });
});
