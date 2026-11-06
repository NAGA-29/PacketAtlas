import { describe, expect, it } from 'vitest';
import { readUint, splitBits } from '@/lib/bytes';
import { encodeName, header, labelThenPointer, pointer, question, readName, RCODE, rr, TYPE } from '@/lib/codecs/dns';
import { allBytes, bytes } from '../helpers/lesson';

const www = encodeName('www.example.com');
const answerA = (ttl: number) => rr(pointer(12), TYPE.A, ttl, [203, 0, 113, 80]);

describe('DNS 章(RFC 1035)', () => {
  it('名前のラベル符号化', () => {
    expect(bytes('dns', 'query', '名前')).toEqual(www);
    expect(www).toHaveLength(17);
  });

  it('端末の問い合わせとリゾルバーの問い合わせは RD だけが違う', () => {
    expect(allBytes('dns', 'query')).toEqual([...header(0x3a7c, { rd: true }, { qd: 1 }), ...question(www, TYPE.A)]);
    expect(allBytes('dns', 'root')).toEqual([...header(0x9b21, {}, { qd: 1 }), ...question(www, TYPE.A)]);
    const W = [1, 4, 1, 1, 1, 1, 1, 1, 1, 4];
    const RD = 4;
    expect(splitBits(bytes('dns', 'query', 'フラグ'), W)[RD]).toBe(1);
    expect(splitBits(bytes('dns', 'root', 'フラグ'), W)[RD]).toBe(0);
    expect(splitBits(bytes('dns', 'nxdomain', 'フラグ'), W)[9]).toBe(RCODE.NXDOMAIN);
  });

  it('TLD の委任:圧縮ポインターとグルー', () => {
    const msg = allBytes('dns', 'tld');
    const expected = [
      ...header(0x4e07, { qr: true }, { qd: 1, ns: 1, ar: 1 }),
      ...question(www, TYPE.A),
      ...rr(pointer(16), TYPE.NS, 172800, labelThenPointer('ns1', 16)),
      ...rr(pointer(45), TYPE.A, 172800, [198, 51, 100, 1]),
    ];
    expect(msg).toEqual(expected);
    // ポインターが本文どおりの名前を指している
    expect(readName(msg, 16).name).toBe('example.com');
    expect(readName(msg, 45).name).toBe('ns1.example.com');
    expect(readName(msg, 33).name).toBe('example.com');
  });

  it('権威の応答・リゾルバーの応答・キャッシュの応答', () => {
    expect(allBytes('dns', 'authoritative')).toEqual([...header(0x7d3e, { qr: true, aa: true }, { qd: 1, an: 1 }), ...question(www, TYPE.A), ...answerA(3600)]);
    expect(allBytes('dns', 'answer')).toEqual([...header(0x3a7c, { qr: true, rd: true, ra: true }, { qd: 1, an: 1 }), ...question(www, TYPE.A), ...answerA(3600)]);
    expect(allBytes('dns', 'cache')).toEqual([...header(0x5f12, { qr: true, rd: true, ra: true }, { qd: 1, an: 1 }), ...question(www, TYPE.A), ...answerA(3600 - 60)]);
    expect(readName(allBytes('dns', 'answer'), 33).name).toBe('www.example.com');
  });

  it('NXDOMAIN:RCODE=3、SOA の名前は example.com を指す', () => {
    const name = encodeName('wwww.example.com');
    const head = [...header(0x6a90, { qr: true, rd: true, ra: true, rcode: RCODE.NXDOMAIN }, { qd: 1, ns: 1 }), ...question(name, TYPE.A)];
    const fields = ['ID', 'フラグ', '質問数', '回答数', '権威数', '追加数', '名前', 'タイプ', 'クラス'];
    expect(fields.flatMap((f) => bytes('dns', 'nxdomain', f))).toEqual(head);
    const soaPrefix = [...pointer(17), 0x00, TYPE.SOA, 0x00, 0x01, ...[0, 0, 0x0e, 0x10]];
    const msg = [...head, ...soaPrefix];
    expect(readName(msg, 17).name).toBe('example.com');
    expect(readUint(msg.slice(head.length + 6, head.length + 10))).toBe(3600);
  });
});
