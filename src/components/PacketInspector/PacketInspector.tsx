'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
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
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const hot = hovered ?? selected;
  const [open, setOpen] = useState<Set<number>>(new Set());

  const contentRef = useRef<HTMLDivElement>(null);
  const [connector, setConnector] = useState('');

  useEffect(() => {
    const content = contentRef.current;
    if (!content || hot === null) { setConnector(''); return; }
    const update = () => {
      const bytes = content.querySelectorAll<HTMLElement>(`[data-byte-field="${hot}"]`);
      const byte = bytes.item(bytes.length - 1);
      const row = content.querySelector<HTMLElement>(`[data-field-row="${hot}"]`);
      const raw = byte?.closest('[data-raw]');
      const table = row?.closest('[data-field-scroll]');
      if (!byte || !row || !raw || !table) { setConnector(''); return; }
      const box = content.getBoundingClientRect();
      const from = byte.getBoundingClientRect();
      const to = row.getBoundingClientRect();
      const rawBox = raw.getBoundingClientRect();
      const tableBox = table.getBoundingClientRect();
      const endY = to.top + to.height / 2;
      // 項目がスクロールで隠れている間は、無関係な行に線を結ばない。
      if (from.right > rawBox.right || from.left < rawBox.left || from.bottom > rawBox.bottom || from.top < rawBox.top || endY < tableBox.top + 38 || endY > tableBox.bottom || tableBox.left < rawBox.right - 2) {
        setConnector('');
        return;
      }
      const x = from.right - box.left + 1;
      const y = from.top + from.height / 2 - box.top;
      const bottom = rawBox.bottom - box.top + 22;
      const seam = tableBox.left - box.left - 8;
      setConnector(`M ${x - 3} ${y} H ${x} V ${bottom} H ${seam} V ${endY - box.top} H ${tableBox.left - box.left + 8}`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(content);
    content.addEventListener('scroll', update, true);
    return () => { observer.disconnect(); content.removeEventListener('scroll', update, true); };
  }, [hot, packet]);

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
    onMouseEnter: () => setHovered(i),
    onMouseLeave: () => setHovered(null),
  });

  const hexOnly = packet.fields.every((f) => f.hex && isComplete(f.hex));
  const cells = hexOnly ? packet.fields.flatMap((f, field) => hexTokens(f.hex!).map((value) => ({ value, field }))) : [];
  const rows = Array.from({ length: Math.ceil(cells.length / 16) }, (_, i) => cells.slice(i * 16, i * 16 + 16));
  const select = (i: number) => setSelected((prev) => prev === i ? null : i);

  return (
    <section className={styles.insp} aria-label={t.packetPanel}>
      <h3 className={styles.head}>
        <span className={styles.name}><span className={styles.kicker}>{t.packetBytes}</span>{packet.name}</span>
        {total > 0 && <span>{t.bytesShown(total)}</span>}
      </h3>

      <div className={styles.content} ref={contentRef}>
      {connector && <svg className={styles.connector} aria-hidden="true"><path d={connector} /></svg>}
      <div className={styles.bytesCol}>
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

      <div className={`${styles.raw} ${hexOnly ? styles.hexRaw : ''}`} aria-hidden="true" data-raw>
        {hexOnly ? (
          <>
            <div className={styles.hexRow}>
              <span className={styles.offset}>{t.offset}</span>
              {Array.from({ length: 16 }, (_, i) => <span key={i} className={styles.ruler}>{i.toString(16).toUpperCase().padStart(2, '0')}</span>)}
            </div>
            {rows.map((row, ri) => (
              <div className={styles.hexRow} key={ri}>
                <span className={styles.offset}>{(ri * 16).toString(16).toUpperCase().padStart(4, '0')}</span>
                {row.map((b, bi) => (
                  <span key={bi} data-byte-field={b.field} className={`${styles.byte} ${color(b.field)} ${hot === b.field ? styles.hot : ''}`} {...hl(b.field)} onClick={() => select(b.field)} title={packet.fields[b.field]?.name}>{b.value}</span>
                ))}
              </div>
            ))}
          </>
        ) : packet.fields.map((f, i) => (
          <Fragment key={i}>
            {f.hex ? hexTokens(f.hex).map((b, k) => (
              <span key={k} data-byte-field={i} className={`${styles.byte} ${color(i)} ${hot === i ? styles.hot : ''}`} {...hl(i)} onClick={() => select(i)}>{b}</span>
            )) : <span data-byte-field={i} className={`${styles.tok} ${color(i)} ${hot === i ? styles.hot : ''}`} {...hl(i)} onClick={() => select(i)}>{f.text}</span>}
            {f.text && f.lineBreak && <span className={styles.br} />}
          </Fragment>
        ))}
      </div>
      <p className={styles.hint} aria-live="polite">{hot !== null ? packet.fields[hot]?.name : t.fieldHint}</p>
      </div>
      <div className={styles.fieldScroll} data-field-scroll tabIndex={0} role="region" aria-label={t.field}>
      <table className={styles.fields}>
        <thead><tr><th aria-label={t.field} /><th scope="col">{t.field}</th><th scope="col">{t.bitLength}</th><th scope="col">{t.value}</th><th scope="col">{t.description}</th></tr></thead>
        <tbody>
          {packet.fields.map((f, i) => {
            const isOpen = open.has(i);
            return (
              <Fragment key={i}>
                <tr
                  data-field-row={i}
                  tabIndex={0}
                  className={hot === i ? styles.hot : undefined}
                  {...hl(i)}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered(null)}
                  onClick={(e) => { if (!(e.target instanceof Element && e.target.closest('button'))) select(i); }}
                  onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(i); } }}
                  aria-current={selected === i ? 'true' : undefined}
                >
                  <td className={styles.sw}>
                    <i className={color(i)} />
                  </td>
                  <td className={styles.fn}>{f.name}</td>
                  <td className={styles.length}>{f.hex && isComplete(f.hex) ? byteCount(f.hex) * 8 : '—'}</td>
                  <td className={styles.value}>
                    {f.hex && <div className={styles.fv}>{f.hex}</div>}
                    {!f.hex && f.text && <div className={styles.fv}>{f.text}</div>}
                  </td>
                  <td className={styles.fd}>
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
                    <td colSpan={4}>
                      <BitDiagram field={f} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      </div>
      </div>
      {packet.note && <div className={styles.note}>{packet.note}</div>}
    </section>
  );
}
