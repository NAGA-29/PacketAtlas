import { describe, expect, it } from 'vitest';
import { CHANNEL_TYPE, encodeOpen } from '@/lib/codecs/dcep';
import { rtpFirstBytes, timestampStep } from '@/lib/codecs/rtp';
import { readUint, splitBits } from '@/lib/bytes';
import { allBytes, bytes, field } from '../helpers/lesson';

describe('DataChannel(RFC 8832)', () => {
  it('DATA_CHANNEL_OPEN「chat」を再計算すると一致する', () => {
    const open = encodeOpen({ channelType: CHANNEL_TYPE.RELIABLE, priority: 0, reliability: 0, label: 'chat', protocol: '' });
    expect(allBytes('webrtc', 'datachannel')).toEqual(open);
  });

  it('説明にある 0x81 は再送回数制限・順不同', () => {
    expect(CHANNEL_TYPE.PARTIAL_RELIABLE_REXMIT_UNORDERED).toBe(0x81);
    expect(field('webrtc', 'datachannel', 'チャネル型').desc).toContain('0x81');
  });
});

describe('RTP(RFC 3550)', () => {
  it('V=2, PT=111(Opus)', () => {
    const first = [...bytes('webrtc', 'srtp', 'V / P / X / CC'), ...bytes('webrtc', 'srtp', 'M / ペイロード型')];
    expect(first).toEqual(rtpFirstBytes({ payloadType: 111 }));
    expect(splitBits(first.slice(0, 1), [2, 1, 1, 4])).toEqual([2, 0, 0, 0]);
  });

  it('48kHz・20ms でタイムスタンプは960ずつ進み、例の値は960の倍数', () => {
    expect(timestampStep(48000, 20)).toBe(960);
    expect(readUint(bytes('webrtc', 'srtp', 'タイムスタンプ')) % 960).toBe(0);
  });
});

describe('DTLS(RFC 6347)', () => {
  it('Handshake レコード、DTLS 1.2 は {254, 253}', () => {
    expect(bytes('webrtc', 'dtls', 'コンテンツタイプ')).toEqual([22]);
    expect(bytes('webrtc', 'dtls', 'バージョン')).toEqual([255 - 1, 255 - 2]);
    expect(bytes('webrtc', 'dtls', 'シーケンス番号')).toHaveLength(6);
  });
});
