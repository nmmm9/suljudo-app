'use client';

import { useEffect, useMemo, useState } from 'react';
import { SECTIONS } from '@/lib/questions';
import type { CompareData } from '@/app/api/everyone/route';

type Props = { token: string; mySlug: string };

export default function Compare({ token, mySlug }: Props) {
  const [data, setData] = useState<CompareData | null>(null);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [section, setSection] = useState(0);

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
        setPicked((json as CompareData).people.map((p) => p.slug).slice(0, 6));
      } catch {
        if (alive) setError('연결에 실패했습니다.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const rowsForSection = useMemo(() => {
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

  if (error) return <p className="cmp-msg">{error}</p>;
  if (!data) return <p className="cmp-msg">불러오는 중입니다…</p>;
  if (data.people.length === 0) return <p className="cmp-msg">아직 아무도 답하지 않았습니다.</p>;

  const toggle = (slug: string) =>
    setPicked((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : [...p, slug]));

  return (
    <>
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
      </div>

      {picked.length === 0 ? (
        <p className="cmp-msg">비교할 사람을 한 명 이상 골라주세요.</p>
      ) : rowsForSection.length === 0 ? (
        <p className="cmp-msg">이 장에는 보여줄 문항이 없습니다.</p>
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
              {rowsForSection.map((r) => (
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
