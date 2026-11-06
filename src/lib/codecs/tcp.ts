// RFC 9293 TCP ヘッダーのフラグとオフセット(検証用)
export const TCP_FLAGS = ['CWR', 'ECE', 'URG', 'ACK', 'PSH', 'RST', 'SYN', 'FIN'] as const;
export type TcpFlag = (typeof TCP_FLAGS)[number];

export const flagsByte = (flags: TcpFlag[]): number =>
  TCP_FLAGS.reduce((acc, f, i) => (flags.includes(f) ? acc | (1 << (7 - i)) : acc), 0);

/** データオフセット(32bit単位)を上位4bitに置いたバイト */
export const dataOffsetByte = (headerBytes: number): number => {
  if (headerBytes % 4 !== 0) throw new Error('header length must be a multiple of 4');
  return (headerBytes / 4) << 4;
};
