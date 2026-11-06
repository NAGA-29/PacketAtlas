import { getLesson } from '@/lessons';
import { parseHex } from '@/lib/bytes';
import type { Field, Packet, Step } from '@/lessons/types';

export const step = (lessonId: string, stepId: string): Step => {
  const l = getLesson(lessonId);
  if (!l) throw new Error(`no lesson ${lessonId}`);
  const s = l.steps.find((x) => x.id === stepId);
  if (!s) throw new Error(`no step ${lessonId}#${stepId}`);
  return s;
};

export const packet = (lessonId: string, stepId: string): Packet => {
  const p = step(lessonId, stepId).packet;
  if (!p) throw new Error(`no packet in ${lessonId}#${stepId}`);
  return p;
};

/** 名前でフィールドを引く。同名が複数あるときは nth 番目 */
export const field = (lessonId: string, stepId: string, name: string, nth = 0): Field => {
  const f = packet(lessonId, stepId).fields.filter((x) => x.name === name)[nth];
  if (!f) throw new Error(`no field ${name} in ${lessonId}#${stepId}`);
  return f;
};

export const bytes = (lessonId: string, stepId: string, name: string, nth = 0): number[] => {
  const f = field(lessonId, stepId, name, nth);
  if (!f.hex) throw new Error(`field ${name} has no hex`);
  return Array.from(parseHex(f.hex));
};

/** パケットの全フィールドのバイトをつなげる(省略のないものだけ) */
export const allBytes = (lessonId: string, stepId: string): number[] =>
  packet(lessonId, stepId).fields.flatMap((f) => (f.hex ? Array.from(parseHex(f.hex)) : []));
