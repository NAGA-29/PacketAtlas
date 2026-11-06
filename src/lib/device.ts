// レーンの名前から図のアイコンを決める
import type { DeviceIcon, Lane } from '@/lessons/types';

const RULES: [RegExp, DeviceIcon][] = [
  [/メールソフト/, 'mail'],
  [/ルーター/, 'router'],
  [/スイッチ/, 'switch'],
  [/リゾルバー/, 'resolver'],
  [/STUN|TURN|シグナリング/, 'relay'],
  [/サーバー|権威|ルート|TLD/, 'server'],
  [/ブラウザ|クライアント|端末|PC|Peer|Client/, 'client'],
];

export const deviceIcon = (lane: Pick<Lane, 'name' | 'icon'>): DeviceIcon | undefined =>
  lane.icon ?? RULES.find(([re]) => re.test(lane.name))?.[1];
