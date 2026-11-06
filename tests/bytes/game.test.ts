import { describe, expect, it } from 'vitest';
import { ackFields, dequantize, header, lerp, missing, PROTOCOL_ID, quantize, ticksToMs, TYPE } from '@/lib/codecs/game';
import { ascii, readUint } from '@/lib/bytes';
import { allBytes, bytes, field } from '../helpers/lesson';

const HEADER = ['プロトコルID', 'シーケンス', 'ack', 'ack bits', '種別'];
const headerOf = (stepId: string) => HEADER.flatMap((n) => bytes('game', stepId, n));

describe('架空フォーマット GAME', () => {
  it('プロトコルIDは「GAME」', () => {
    expect(PROTOCOL_ID).toEqual(ascii('GAME'));
    expect(bytes('game', 'connect', 'プロトコルID')).toEqual(PROTOCOL_ID);
  });

  it('INPUT のヘッダーとティック', () => {
    expect(headerOf('input')).toEqual(header({ seq: 0x0412, ack: 0xc8, ackBits: 0xffffffff, type: TYPE.INPUT }));
    expect(readUint(bytes('game', 'input', 'ティック'))).toBe(8001);
  });

  it('SNAPSHOT は A の INPUT を ack し、ティックと量子化位置が本文どおり', () => {
    expect(readUint(bytes('game', 'snapshot', 'ack'))).toBe(readUint(bytes('game', 'input', 'シーケンス')));
    expect(readUint(bytes('game', 'snapshot', 'サーバーティック'))).toBe(8004);
    expect(readUint(bytes('game', 'snapshot', 'ベースライン'))).toBe(7998);
    expect(readUint(bytes('game', 'snapshot', '処理済み入力'))).toBe(8002);
    expect(dequantize(readUint(bytes('game', 'snapshot', 'x')))).toBe(361.0);
    expect(dequantize(readUint(bytes('game', 'snapshot', 'y')))).toBe(74.0);
    expect(quantize(361)).toBe(23104);
  });

  it('ロスの手順:#210 が欠け、ack bits の bit0 が 0', () => {
    const snapSeq = readUint(bytes('game', 'snapshot', 'シーケンス')); // #209
    const received = [snapSeq, snapSeq + 2];
    for (let n = 1; n <= 31; n++) received.push(snapSeq - n);
    const { ack, ackBits } = ackFields(received);
    expect(allBytes('game', 'loss')).toEqual(header({ seq: 0x041c, ack, ackBits, type: TYPE.INPUT }));
    expect(missing(ack, ackBits)).toEqual([210]);
  });

  it('補間:8004〜8010 の 1/3 地点で x=361.5、遅延は 6 ティック = 100ms', () => {
    expect(lerp(361.0, 362.5, (8006 - 8004) / (8010 - 8004))).toBeCloseTo(361.5, 10);
    expect(ticksToMs(8012 - 8006)).toBe(100);
  });

  it('FIRE のティック', () => {
    expect(readUint(bytes('game', 'lag-compensation', '発射ティック'))).toBe(8012);
    expect(readUint(bytes('game', 'lag-compensation', '描画ティック'))).toBe(8006);
    expect(bytes('game', 'lag-compensation', '種別')).toEqual([TYPE.FIRE]);
  });

  it('信頼メッセージ「gg」', () => {
    expect(bytes('game', 'reliable', '種別')).toEqual([TYPE.RELIABLE]);
    expect(readUint(bytes('game', 'reliable', '長さ'))).toBe(bytes('game', 'reliable', '本文').length);
    expect(bytes('game', 'reliable', '本文')).toEqual(ascii('gg'));
    expect(field('game', 'reliable', '本文').desc).toContain('gg');
  });
});
