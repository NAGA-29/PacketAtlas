'use client';
import { Fragment, useState } from 'react';
import type { Field, Packet } from '@/lessons/types';
import { byteCount, hexTokens, isComplete, parseHex, splitBitStrings } from '@/lib/bytes';
import { dict, type Locale } from '@/lib/i18n';
import styles from './PacketInspector.module.css';

interface Props {
  packet?: Packet;
  locale: Locale;
}

const color = (i: number) => `c${i % 6}`;

function BitDiagram({ field }: { field: Field }) {
  if (!field.bits || !field.hex || !isComplete(field.hex)) return null;
  const bytes = parseHex(field.hex);
  const values = splitBitStrings(bytes, field.bits.map((b) => b.bits));
  const total = bytes.length * 8;
  return (
    <div className={styles.bits} style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
      {field.bits.map((b, i) => (
        <div key={i} className={styles.bit} style={{ gridColumn: `span ${b.bits}` }}>
          <span className={styles.bitVal}>{values[i]}</span>
          <span className={styles.bitName}>{b.name}</span>
          {b.desc && <span className={styles.bitDesc}>{b.desc}</span>}
        </div>
      ))}
    </div>
  );
}

export function PacketInspector({ packet, locale }: Props) {
  const t = dict(locale);
  const [hot, setHot] = useState<number | null>(null);
  const [open, setOpen] = useState<Set<number>>(new Set());

  if (!packet) {
    return (
      <section className={styles.insp} aria-label={t.packetPanel}>
        <h3 className={styles.head}>{t.noPacket}</h3>
        <div className={styles.empty}>{t.noPacketBody}</div>
      </section>
    );
  }

  const total = packet.fields.reduce((a, f) => a + (f.hex ? byteCount(f.hex) : 0), 0);
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  const hl = (i: number) => ({
    onMouseEnter: () => setHot(i),
    onMouseLeave: () => setHot((h) => (h === i ? null : h)),
  });

  return (
    <section className={styles.insp} aria-label={t.packetPanel}>
      <h3 className={styles.head}>
        <span className={styles.name}>{packet.name}</span>
        {total > 0 && <span>{t.bytesShown(total)}</span>}
      </h3>

      {packet.layers && packet.layers.length > 0 && (
        <ol className={styles.layers} aria-label={t.layers}>
          {packet.layers.map((l, i) => (
            <li key={i} className={i === packet.layers!.length - 1 ? styles.inner : undefined}>
              {l}
            </li>
          ))}
        </ol>
      )}

      {(packet.fictional || packet.view === 'decrypted') && (
        <div className={styles.notices}>
          {packet.fictional && <p className={styles.fictional}>{t.fictional}</p>}
          {packet.view === 'decrypted' && <p className={styles.decrypted}>{t.decrypted}</p>}
        </div>
      )}

      <div className={styles.raw} aria-hidden="true">
        {packet.fields.map((f, i) => (
          <Fragment key={i}>
            {f.hex
              ? hexTokens(f.hex).map((b, k) => (
                  <span key={k} className={`${styles.byte} ${color(i)} ${hot === i ? styles.hot : ''}`} {...hl(i)}>
                    {b}
                  </span>
                ))
              : (
                  <span className={`${styles.tok} ${color(i)} ${hot === i ? styles.hot : ''}`} {...hl(i)}>
                    {f.text}
                  </span>
                )}
            {f.text && f.lineBreak && <span className={styles.br} />}
          </Fragment>
        ))}
      </div>

      <table className={styles.fields}>
        <tbody>
          {packet.fields.map((f, i) => {
            const isOpen = open.has(i);
            return (
              <Fragment key={i}>
                <tr
                  tabIndex={0}
                  className={hot === i ? styles.hot : undefined}
                  {...hl(i)}
                  onFocus={() => setHot(i)}
                  onBlur={() => setHot((h) => (h === i ? null : h))}
                >
                  <td className={styles.sw}>
                    <i className={color(i)} />
                  </td>
                  <td className={styles.fn}>{f.name}</td>
                  <td className={styles.fd}>
                    {f.hex && <div className={styles.fv}>{f.hex}</div>}
                    {!f.hex && f.text && <div className={styles.fv}>{f.text}</div>}
                    {f.desc && <div>{f.desc}</div>}
                    {f.bits && (
                      <button type="button" className={styles.bitsBtn} aria-expanded={isOpen} onClick={() => toggle(i)}>
                        {isOpen ? t.bitsHide : t.bitsToggle}
                      </button>
                    )}
                  </td>
                </tr>
                {f.bits && isOpen && (
                  <tr className={styles.bitsRow}>
                    <td />
                    <td colSpan={2}>
                      <BitDiagram field={f} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {packet.note && <div className={styles.note}>{packet.note}</div>}
    </section>
  );
}
