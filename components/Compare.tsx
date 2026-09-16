'use client';

import { useEffect, useMemo, useState } from 'react';
import { SECTIONS, TOTAL } from '@/lib/questions';
import type { CompareData } from '@/app/api/everyone/route';
import SummaryText from './SummaryText';

type Props = { token: string; mySlug: string };
type View = 'answers' | 'summaries';

export default function Compare({ token, mySlug }: Props) {
  const [data, setData] = useState<CompareData | null>(null);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [section, setSection] = useState(0);
  const [view, setView] = useState<View>('answers');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/everyone', { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) {
          setError(json.error ?? '불러오지 못했습니다.');
          return;
        }
        setData(json as CompareData);
        setPicked((json as CompareData).people.map((p) => p.slug));
      } catch {
        if (alive) setError('연결에 실패했습니다.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const rows = useMemo(() => {
    if (!data) return [];
    const out: { key: string; label: string; heading?: string; cells: string[] }[] = [];
    let heading = '';
    for (const item of SECTIONS[section].items) {
      if (item.kind === 'heading') {
        heading = item.label;
        continue;
      }
      const byPerson = data.rows[item.key] ?? {};
      const cells = picked.map((s) => byPerson[s] ?? '');
      if (cells.every((c) => c === '')) continue;
      if (onlyDiff) {
        const filled = cells.filter(Boolean);
        if (filled.length < 2 || new Set(filled).size === 1) continue;
      }
      out.push({ key: item.key, label: item.label, heading: heading || undefined, cells });
      heading = '';
    }
    return out;
  }, [data, picked, onlyDiff, section]);

  /** 이 장에서 사람들이 실제로 답한 문항 수. 표가 짧을 때 왜 짧은지 알려준다. */
  const sectionTotal = SECTIONS[section].count;

  if (error) return <p className="cmp-msg">{error}</p>;
  if (!data) return <p className="cmp-msg">불러오는 중입니다…</p>;
  if (data.people.length === 0) return <p className="cmp-msg">아직 아무도 답하지 않았습니다.</p>;

  const toggle = (slug: string) =>
    setPicked((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : [...p, slug]));

  return (
    <>
      <div className="cmp-bar">
        <div className="cmp-people">
          {data.people.map((p) => (
            <button
              key={p.slug}
              type="button"
              className="chip"
              data-on={picked.includes(p.slug)}
              onClick={() => toggle(p.slug)}
            >
              {p.name}
              {p.slug === mySlug ? ' (나)' : ''} · {p.answered}
            </button>
          ))}
        </div>

        <div className="cmp-controls">
          <div className="cmp-view">
            <button type="button" data-on={view === 'answers'} onClick={() => setView('answers')}>
              답변 비교
            </button>
            <button type="button" data-on={view === 'summaries'} onClick={() => setView('summaries')}>
              AI 요약
            </button>
          </div>

          {view === 'answers' && (
            <>
              <select value={section} onChange={(e) => setSection(Number(e.target.value))}>
                {SECTIONS.map((s, i) => (
                  <option key={s.tab} value={i}>
                    {s.title}
                  </option>
                ))}
              </select>
              <label className="cmp-check">
                <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} />
                답이 갈린 문항만
              </label>
              <span className="cmp-count">
                {rows.length} / {sectionTotal}문항 · 전체 {TOTAL}
              </span>
            </>
          )}
        </div>
      </div>

      {picked.length === 0 ? (
        <p className="cmp-msg">비교할 사람을 한 명 이상 골라주세요.</p>
      ) : view === 'summaries' ? (
        <div className="cmp-sums">
          {picked.map((slug) => {
            const p = data.people.find((x) => x.slug === slug);
            if (!p) return null;
            return (
              <section className="cmp-sum" key={slug}>
                <header>
                  <b>
                    {p.name}
                    {slug === mySlug ? ' (나)' : ''}
                  </b>
                  <span>
                    {p.summary
                      ? `${p.summaryAnswered ?? p.answered}문항 기준 · ${new Date(
                          p.summaryAt ?? p.updatedAt
                        ).toLocaleDateString('ko-KR')}`
                      : '아직 요약 없음'}
                  </span>
                </header>
                {p.summary ? (
                  <div className="ai">
                    <SummaryText text={p.summary} />
                    {p.summaryAnswered != null && p.answered > p.summaryAnswered && (
                      <p className="cmp-stale">
                        이 요약 이후 {p.answered - p.summaryAnswered}문항을 더 채웠습니다.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="cmp-none-sum">
                    아직 요약을 돌리지 않았습니다. 설문지에서 결과 보기를 눌러 요약을 받으면 여기에
                    올라옵니다.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      ) : rows.length === 0 ? (
        <p className="cmp-msg">
          {onlyDiff ? '이 장에서는 답이 갈린 문항이 없습니다.' : '이 장에는 아직 답한 문항이 없습니다.'}
        </p>
      ) : (
        <div className="cmp-scroll">
          <table className="cmp-table">
            <thead>
              <tr>
                <th className="cmp-q">문항</th>
                {picked.map((s) => (
                  <th key={s}>{data.people.find((p) => p.slug === s)?.name ?? s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <th className="cmp-q" scope="row">
                    {r.heading && <em>{r.heading}</em>}
                    {r.label}
                  </th>
                  {r.cells.map((c, i) => (
                    <td key={picked[i]}>{c || <span className="cmp-none">—</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
