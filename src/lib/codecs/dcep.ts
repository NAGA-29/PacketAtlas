// RFC 8832 DCEP(検証用)
import { ascii, uintBytes } from '../bytes';

export const DCEP = { ACK: 0x02, OPEN: 0x03 } as const;
export const CHANNEL_TYPE = {
  RELIABLE: 0x00,
  PARTIAL_RELIABLE_REXMIT: 0x01,
  PARTIAL_RELIABLE_TIMED: 0x02,
  RELIABLE_UNORDERED: 0x80,
  PARTIAL_RELIABLE_REXMIT_UNORDERED: 0x81,
  PARTIAL_RELIABLE_TIMED_UNORDERED: 0x82,
} as const;

export const encodeOpen = (o: { channelType: number; priority: number; reliability: number; label: string; protocol: string }): number[] => {
  const label = ascii(o.label);
  const protocol = ascii(o.protocol);
  return [
    DCEP.OPEN,
    o.channelType,
    ...uintBytes(o.priority, 2),
    ...uintBytes(o.reliability, 4),
    ...uintBytes(label.length, 2),
    ...uintBytes(protocol.length, 2),
    ...label,
    ...protocol,
  ];
};
