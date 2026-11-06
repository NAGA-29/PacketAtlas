// RFC 3550 RTP 固定ヘッダーの先頭2バイト(検証用)
export const rtpFirstBytes = (o: { padding?: boolean; extension?: boolean; csrcCount?: number; marker?: boolean; payloadType: number }): number[] => [
  (2 << 6) | (o.padding ? 0x20 : 0) | (o.extension ? 0x10 : 0) | ((o.csrcCount ?? 0) & 0x0f),
  (o.marker ? 0x80 : 0) | (o.payloadType & 0x7f),
];

/** サンプリング周波数とフレーム長(ms)からタイムスタンプの増分 */
export const timestampStep = (clockRate: number, frameMs: number): number => (clockRate * frameMs) / 1000;
