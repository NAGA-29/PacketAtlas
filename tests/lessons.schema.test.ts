import { describe, expect, it } from 'vitest';
import { LESSONS, PARTS, PLANNED, catalog, lessonNeighbors } from '@/lessons';
import { HEX_PATTERN, byteCount, isComplete } from '@/lib/bytes';

const RESERVED_ROUTES = new Set(['compare', 'about']);

describe('レッスン全体', () => {
  it('id が一意で、予約されたルート名と衝突しない', () => {
    const ids = PARTS.flatMap((p) => catalog(p.no).map((l) => l.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(RESERVED_ROUTES.has(id)).toBe(false);
  });

  it('予定の id は書き上がったレッスンか、まだ書かれていないもの', () => {
    const planned = new Set(PLANNED.map((p) => p.id));
    for (const l of LESSONS) if (l.part <= 5) expect(planned.has(l.id), l.id).toBe(true);
  });

  it('全21レッスンが部に振り分けられている', () => {
    const total = PARTS.reduce((a, p) => a + catalog(p.no).length, 0);
    expect(total).toBe(21);
  });

  it('同じ部の中で order が重ならない', () => {
    for (const p of PARTS) {
      const orders = catalog(p.no).map((l) => l.order);
      expect(new Set(orders).size).toBe(orders.length);
    }
  });

  it('前後のレッスンへのリンクが張られ、部の最後は比較ページにつながる', () => {
    expect(lessonNeighbors('websocket', 'ja').next?.href).toBe('/ja/webrtc/');
    expect(lessonNeighbors('webtransport', 'ja').next?.href).toBe('/ja/compare/realtime/');
    expect(lessonNeighbors('udp', 'ja').next?.href).toBe('/ja/tcp/');
    expect(lessonNeighbors('tcp', 'ja').next?.href).toBe('/ja/compare/transport/');
    expect(lessonNeighbors('tls13', 'ja').next?.href).toBe('/ja/compare/naming-security/');
  });
});

for (const lesson of LESSONS) {
  describe(`レッスン ${lesson.id}`, () => {
    const laneIds = new Set(lesson.lanes.map((l) => l.id));

    it('基本の項目がそろっている', () => {
      expect(lesson.title).not.toBe('');
      expect(lesson.tagline).not.toBe('');
      expect(lesson.lead).not.toBe('');
      expect(lesson.sources.length).toBeGreaterThanOrEqual(1);
      for (const s of lesson.sources) expect(s.url).toMatch(/^https:\/\//);
      expect(lesson.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(laneIds.size).toBe(lesson.lanes.length);
    });

    it('手順は5〜10個で、id がレッスン内で一意', () => {
      expect(lesson.steps.length).toBeGreaterThanOrEqual(5);
      expect(lesson.steps.length).toBeLessThanOrEqual(10);
      const ids = lesson.steps.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    });

    for (const step of lesson.steps) {
      describe(`手順 ${step.id}`, () => {
        it('ホップは実在するレーンを指す', () => {
          expect(step.hops.length).toBeGreaterThan(0);
          for (const h of step.hops) {
            expect(laneIds.has(h.from), `${h.from}`).toBe(true);
            expect(laneIds.has(h.to), `${h.to}`).toBe(true);
            expect(h.label.length).toBeLessThanOrEqual(24);
            if (h.from === h.to) expect(h.lost).toBeFalsy();
          }
        });

        it('本文は1〜4段落', () => {
          const paras = step.body.split(/\n\n+/).filter(Boolean);
          expect(paras.length).toBeGreaterThanOrEqual(1);
          expect(paras.length).toBeLessThanOrEqual(4);
        });

        if (!step.packet) return;
        const packet = step.packet;

        it('フィールドは hex と text のどちらか一方だけを持つ', () => {
          expect(packet.fields.length).toBeGreaterThan(0);
          for (const f of packet.fields) {
            expect(Boolean(f.hex) !== Boolean(f.text), f.name).toBe(true);
          }
        });

        it('hex は大文字2桁か … の空白区切り', () => {
          for (const f of packet.fields) if (f.hex) expect(f.hex, f.name).toMatch(HEX_PATTERN);
        });

        it('bits の幅の合計がバイト数×8に一致し、hex のフィールドにだけ付く', () => {
          for (const f of packet.fields) {
            if (!f.bits) continue;
            expect(f.hex, f.name).toBeDefined();
            expect(isComplete(f.hex ?? ''), f.name).toBe(true);
            const total = f.bits.reduce((a, b) => a + b.bits, 0);
            expect(total, f.name).toBe(byteCount(f.hex ?? '') * 8);
          }
        });

        it('layers は空でない名前の並び', () => {
          if (!packet.layers) return;
          expect(packet.layers.length).toBeGreaterThan(0);
          for (const l of packet.layers) expect(l.trim()).not.toBe('');
        });
      });
    }
  });
}

describe('架空フォーマット', () => {
  it('ゲームのネットコード章のバイナリは fictional が付いている', () => {
    const game = LESSONS.find((l) => l.id === 'game');
    expect(game).toBeDefined();
    for (const s of game?.steps ?? []) {
      const p = s.packet;
      if (p && p.fields.some((f) => f.hex)) expect(p.fictional, s.id).toBe(true);
    }
  });
});

describe('例のアドレスとドメイン', () => {
  const ipv4 = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g;
  const docOrPrivate = (a: number, b: number, c: number) =>
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a === 127 ||
    a === 0 || // 0.0.0.0(未設定・デフォルト経路)
    a === 255 || // 255.255.255.255(ブロードキャスト)やサブネットマスク
    a === 10 ||
    (a === 192 && b === 168);
  const texts = LESSONS.flatMap((l) => [
    l.lead,
    ...l.lanes.map((x) => x.sub ?? ''),
    ...l.steps.flatMap((s) => [s.body, ...(s.packet?.fields ?? []).flatMap((f) => [f.text ?? '', f.desc ?? ''])]),
  ]);

  it('IPv4 は文書用の範囲(またはNATの内側を表すプライベート範囲)だけ', () => {
    for (const t of texts) {
      for (const m of t.matchAll(ipv4)) {
        const [a, b, c] = [Number(m[1]), Number(m[2]), Number(m[3])];
        expect(docOrPrivate(a, b, c), m[0]).toBe(true);
      }
    }
  });

  it('ドメインは example.com / example.net だけ', () => {
    const domain = /\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|jp|example)\b/g;
    for (const t of texts) {
      for (const m of t.matchAll(domain)) expect(m[0], m[0]).toMatch(/(^|\.)example\.(com|net)$/);
    }
  });
});

import { laneLabelWidth, layoutDiagram, selfBoxWidth } from '@/lib/diagram';

describe('シーケンス図の座標', () => {
  for (const lesson of LESSONS) {
    it(`${lesson.id}: 手元の処理の箱が図の幅に収まり、手順番号と重ならない`, () => {
      const layout = layoutDiagram(lesson);
      for (const r of layout.rows) {
        if (r.x1 !== r.x2) continue;
        const half = selfBoxWidth(r.hop.label) / 2;
        expect(r.x1 - half).toBeGreaterThanOrEqual(34);
        expect(r.x1 + half).toBeLessThanOrEqual(layout.width);
      }
    });
    it(`${lesson.id}: 端のレーンの見出しが図からはみ出さない`, () => {
      const layout = layoutDiagram(lesson);
      const first = lesson.lanes[0];
      const last = lesson.lanes.at(-1);
      expect((layout.laneX[first?.id ?? ''] ?? 0) - laneLabelWidth(first) / 2).toBeGreaterThanOrEqual(0);
      expect((layout.laneX[last?.id ?? ''] ?? 0) + laneLabelWidth(last) / 2).toBeLessThanOrEqual(layout.width);
    });
  }
});

import { activeEdges, clipToBoxes, layoutTopology, NODE_H } from '@/lib/topology';

describe('プロトコルの概要カード', () => {
  for (const lesson of LESSONS) {
    it(`${lesson.id}: 全項目が埋まり、規定は一次資料の一覧にある`, () => {
      const o = lesson.overview;
      for (const v of [o.layer, o.transport, o.ports, o.format, o.key.label, o.key.value]) expect(v.trim()).not.toBe('');
      expect(o.specs.length).toBeGreaterThan(0);
      for (const spec of o.specs) expect(lesson.sources.some((s) => s.label.startsWith(spec)), spec).toBe(true);
      // ポート番号として書いた数字は 0〜65535
      for (const m of o.ports.matchAll(/\d+/g)) expect(Number(m[0])).toBeLessThanOrEqual(65535);
    });
  }

  it('既定のポートが、パケットの中のポート番号と食い違わない', () => {
    const portOf = (id: string) => LESSONS.find((l) => l.id === id)?.overview.ports ?? '';
    expect(portOf('dns')).toContain('53');
    expect(portOf('ssh')).toContain('22');
    expect(portOf('dhcp')).toMatch(/67.*68/);
    expect(portOf('https')).toContain('443');
    expect(portOf('http11')).toContain('80');
  });
});

describe('つながり図の配置', () => {
  for (const lesson of LESSONS) {
    it(`${lesson.id}: 全レーンが箱になり、箱は重ならず図に収まる`, () => {
      const t = layoutTopology(lesson);
      expect(t.nodes.map((n) => n.id).sort()).toEqual(lesson.lanes.map((l) => l.id).sort());
      for (const n of t.nodes) {
        expect(n.x - n.w / 2).toBeGreaterThanOrEqual(0);
        expect(n.x + n.w / 2).toBeLessThanOrEqual(t.width);
        expect(n.y - NODE_H / 2).toBeGreaterThanOrEqual(0);
        expect(n.y + NODE_H / 2).toBeLessThanOrEqual(t.height);
      }
      for (let i = 0; i < t.nodes.length; i++)
        for (let j = i + 1; j < t.nodes.length; j++) {
          const p = t.nodes[i]!;
          const q = t.nodes[j]!;
          const apart = Math.abs(p.x - q.x) >= (p.w + q.w) / 2 + 8 || Math.abs(p.y - q.y) >= NODE_H + 8;
          expect(apart, `${p.id} と ${q.id}`).toBe(true);
        }
    });

    it(`${lesson.id}: 線は箱の外側に十分な長さを持つ(ラベルが箱にかからない)`, () => {
      const t = layoutTopology(lesson);
      for (const e of t.edges) {
        const p = t.nodes.find((n) => n.id === e.a)!;
        const q = t.nodes.find((n) => n.id === e.b)!;
        const [x1, y1, x2, y2] = clipToBoxes(p, q);
        expect(Math.hypot(x2 - x1, y2 - y1), `${e.a}-${e.b}`).toBeGreaterThanOrEqual(40);
      }
    });

    it(`${lesson.id}: 手元の処理以外のホップは、すべて線になっている`, () => {
      const t = layoutTopology(lesson);
      const keys = new Set(t.edges.map((e) => `${e.a}|${e.b}`));
      lesson.steps.forEach((_, si) => {
        for (const k of activeEdges(lesson, si).keys()) expect(keys.has(k), k).toBe(true);
      });
    });
  }

  it('DNS ではリゾルバーが中心、IP には中心を置かない、ゲームは一列', () => {
    expect(layoutTopology(LESSONS.find((l) => l.id === 'dns')!).hub).toBe('resolver');
    expect(layoutTopology(LESSONS.find((l) => l.id === 'ip')!).hub).toBeUndefined();
    const game = layoutTopology(LESSONS.find((l) => l.id === 'game')!);
    expect(new Set(game.nodes.map((n) => n.y)).size).toBe(1);
  });
});

import { deviceIcon } from '@/lib/device';

describe('機器のアイコン', () => {
  it('全レッスンの全レーンにアイコンが決まる', () => {
    for (const l of LESSONS) for (const lane of l.lanes) expect(deviceIcon(lane), `${l.id}: ${lane.name}`).toBeDefined();
  });
  it('名前から期待どおりに決まる', () => {
    expect(deviceIcon({ name: 'ルーター1' })).toBe('router');
    expect(deviceIcon({ name: 'DHCPサーバー' })).toBe('server');
    expect(deviceIcon({ name: 'リゾルバー' })).toBe('resolver');
    expect(deviceIcon({ name: 'メールソフト' })).toBe('mail');
    expect(deviceIcon({ name: 'STUN / TURN' })).toBe('relay');
    expect(deviceIcon({ name: 'Peer A' })).toBe('client');
  });
});

import { EDGE_LABEL_PX, offsetSegment, trackLabel, TRACK_GAP } from '@/lib/topology';
import { textWidth } from '@/lib/diagram';

describe('つながり図:1本の線を複数の種類のパケットが通る手順', () => {
  const lesson = (id: string) => LESSONS.find((l) => l.id === id)!;
  const stepIndex = (id: string, stepId: string) => lesson(id).steps.findIndex((s) => s.id === stepId);

  it('全レッスン・全手順で、どのホップも自分の種類のトラックに載っている', () => {
    for (const l of LESSONS) {
      const order = l.lanes.map((x) => x.id);
      l.steps.forEach((st, si) => {
        const act = activeEdges(l, si);
        for (const h of st.hops) {
          if (h.from === h.to) continue;
          const [a, b] = order.indexOf(h.from) <= order.indexOf(h.to) ? [h.from, h.to] : [h.to, h.from];
          const tr = act.get(`${a}|${b}`)?.find((x) => x.kind === h.kind);
          expect(tr, `${l.id}#${st.id}: ${h.label}`).toBeDefined();
          expect(h.from === a ? tr!.forward : tr!.backward).toBe(true);
          expect(tr!.labels.some((x) => x.text === h.label)).toBe(true);
        }
      });
    }
  });

  it('WebRTC の TURN:A と STUN/TURN の線に、接続制御とメディアの2本が並ぶ', () => {
    const tracks = activeEdges(lesson('webrtc'), stepIndex('webrtc', 'turn')).get('stun|a')!;
    expect(tracks.map((t) => t.kind)).toEqual(['control', 'media']);
    expect(tracks.map((t) => t.offset)).toEqual([-TRACK_GAP / 2, TRACK_GAP / 2]);
    expect(tracks[0]).toMatchObject({ forward: true, backward: true });
    expect(tracks[1]).toMatchObject({ forward: false, backward: true });
  });

  it('WebTransport のデータグラム:データとメディアが分かれ、メディアは一部だけ消える', () => {
    const tracks = activeEdges(lesson('webtransport'), stepIndex('webtransport', 'datagram')).get('client|server')!;
    expect(tracks.map((t) => t.kind)).toEqual(['data', 'media']);
    expect(tracks[1]).toMatchObject({ lostAny: true, lostAll: false });
    expect(tracks[0]).toMatchObject({ lostAny: false });
    expect(trackLabel(tracks[1]!)).toBe('DATAGRAM: 状態 ×3(1つ消失)');
  });

  it('横一列の配置では、どの線のラベルも線の長さに収まる', () => {
    for (const l of LESSONS) {
      const t = layoutTopology(l);
      if (new Set(t.nodes.map((n) => n.y)).size !== 1) continue;
      l.steps.forEach((_, si) => {
        for (const [k, tracks] of activeEdges(l, si)) {
          const [a, b] = k.split('|');
          const p = t.nodes.find((n) => n.id === a)!;
          const q = t.nodes.find((n) => n.id === b)!;
          const [x1, , x2] = clipToBoxes(p, q);
          for (const tr of tracks) expect(textWidth(trackLabel(tr), EDGE_LABEL_PX), `${l.id} ${k}`).toBeLessThanOrEqual(Math.abs(x2 - x1));
        }
      });
    }
  });

  it('ゲームのロス:同じ種類で一部だけ消えるときは lostAll にならない', () => {
    const tracks = activeEdges(lesson('game'), stepIndex('game', 'loss')).get('a|server')!;
    const media = tracks.find((t) => t.kind === 'media')!;
    expect(media).toMatchObject({ lostAny: true, lostAll: false, offset: -TRACK_GAP / 2 });
    expect(media.labels).toEqual([
      { text: 'SNAPSHOT t=8007', total: 1, lost: 1 },
      { text: 'SNAPSHOT t=8010', total: 1, lost: 0 },
    ]);
    expect(trackLabel(media)).toBe('SNAPSHOT t=8007(消失) / SNAPSHOT t=8010');
  });

  it('平行線はもとの線から同じ距離だけ離れる', () => {
    const [x1, y1, x2, y2] = offsetSegment(0, 0, 100, 0, 7);
    expect([x1, x2]).toEqual([0, 100]);
    expect(Math.abs(y1)).toBe(7);
    expect(y1).toBe(y2);
  });
});
