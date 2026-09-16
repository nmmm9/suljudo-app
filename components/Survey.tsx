'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SECTIONS, TOTAL } from '@/lib/questions';
import {
  STORAGE_KEY,
  answeredCount,
  buildResult,
  resultText,
  totalAnswered,
  type Answer,
  type Answers,
} from '@/lib/answers';
import QuestionField from './QuestionField';
import Summary from './Summary';
import Gate, { type Session } from './Gate';
import Compare from './Compare';

const NAME_KEY = '__name';
const SESSION_KEY = 'suljudo-session';
/** 손을 멈춘 뒤 이만큼 지나면 서버에 올린다. 타이핑마다 올리지 않는다. */
const SYNC_DELAY_MS = 1500;

export default function Survey() {
  const [session, setSession] = useState<Session | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [cur, setCur] = useState(0);
  const [result, setResult] = useState<'closed' | 'list' | 'ai'>('closed');
  const [menu, setMenu] = useState(false);
  const [compare, setCompare] = useState(false);
  const [toast, setToast] = useState('');
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = useRef(false);

  // 지난 세션 복원. 토큰이 아직 살아 있으면 서버에서 최신 답을 받아온다.
  useEffect(() => {
    let alive = true;
    (async () => {
      let saved: Session | null = null;
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) saved = JSON.parse(raw) as Session;
      } catch {
        /* 읽기 실패하면 로그인 화면으로 */
      }
      if (!saved?.token) {
        if (alive) setReady(true);
        return;
      }
      try {
        const res = await fetch('/api/answers', { headers: { Authorization: `Bearer ${saved.token}` } });
        if (!alive) return;
        if (res.ok) {
          const data = await res.json();
          setSession(saved);
          setAnswers(data.answers ?? {});
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      } catch {
        // 오프라인이면 로컬 사본으로 버틴다.
        if (!alive) return;
        try {
          const cached = localStorage.getItem(STORAGE_KEY);
          if (cached) setAnswers(JSON.parse(cached) as Answers);
        } catch {
          /* 무시 */
        }
        setSession(saved);
      }
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 로컬 사본. 서버가 죽어도 답이 날아가지 않게 둔다.
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
    } catch {
      /* 저장 못 해도 진행은 막지 않는다 */
    }
  }, [answers, ready]);

  // 서버 동기화. 답이 바뀐 뒤 잠깐 조용해지면 통째로 올린다.
  useEffect(() => {
    if (!ready || !session || !dirty.current) return;
    const t = setTimeout(async () => {
      setSync('saving');
      try {
        const res = await fetch('/api/answers', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
          body: JSON.stringify({ answers }),
        });
        setSync(res.ok ? 'saved' : 'failed');
        if (res.ok) dirty.current = false;
      } catch {
        setSync('failed');
      }
    }, SYNC_DELAY_MS);
    return () => clearTimeout(t);
  }, [answers, ready, session]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const set = useCallback((key: string, value: Answer | undefined) => {
    dirty.current = true;
    setAnswers((prev) => {
      if (value === undefined) {
        const { [key]: _drop, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const name = session?.name ?? (typeof answers[NAME_KEY] === 'string' ? (answers[NAME_KEY] as string) : '');
  const answered = useMemo(() => totalAnswered(answers), [answers]);
  const counts = useMemo(() => SECTIONS.map((s) => answeredCount(s, answers)), [answers]);
  const section = SECTIONS[cur];

  const go = (i: number) => {
    setCur(i);
    window.scrollTo({ top: 0 });
  };

  const download = () => {
    const blob = new Blob([JSON.stringify({ name, savedAt: new Date().toISOString(), answers }, null, 1)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `술주도_${name || '답변'}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setToast('파일로 저장했어요');
  };

  const load = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object') throw new Error('not an object');
      const wrapped = (parsed as { answers?: unknown }).answers;
      const next = (wrapped && typeof wrapped === 'object' ? wrapped : parsed) as Answers;
      dirty.current = true;
      setAnswers(next);
      setToast('불러왔어요');
    } catch {
      setToast('파일을 읽을 수 없어요');
    }
  };

  const copy = async () => {
    const text = resultText(answers, name, answered, TOTAL);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setToast('복사했어요');
  };

  const reset = () => {
    if (!confirm('모든 답변을 지울까요? 서버에 저장된 것도 비워집니다.')) return;
    dirty.current = true;
    setAnswers({});
    setCur(0);
    setToast('초기화했어요');
  };

  const logout = () => {
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* 무시 */
    }
    setSession(null);
    setAnswers({});
    setCur(0);
  };

  const enter = (s: Session, loaded: Answers, created: boolean) => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch {
      /* 저장 못 해도 이번 방문은 쓸 수 있다 */
    }
    dirty.current = false;
    setSession(s);
    setAnswers(loaded);
    setReady(true);
    setToast(created ? `${s.name}님, 처음이시네요` : `${s.name}님, 이어서 합니다`);
  };

  const sections = buildResult(answers);

  if (!ready) return <p className="boot">불러오는 중입니다…</p>;
  if (!session) return <Gate onDone={enter} />;

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="head">
            <h1>
              술주도 이상형 설문지
              <small>
                {answered} / {TOTAL} 답변
              </small>
            </h1>
            <div className="who">
              <b>{name}</b>
              <span className="sync" data-state={sync}>
                {sync === 'saving' ? '저장 중' : sync === 'failed' ? '저장 실패' : sync === 'saved' ? '저장됨' : ' '}
              </span>
            </div>
          </div>
          <nav className="tabs">
            {SECTIONS.map((s, i) => (
              <button key={s.tab} type="button" className="tab" data-on={i === cur} onClick={() => go(i)}>
                {s.tab}
                <small>
                  {counts[i]}/{s.count}
                </small>
              </button>
            ))}
          </nav>
        </div>
        <div className="prog">
          <i style={{ width: `${TOTAL ? (answered / TOTAL) * 100 : 0}%` }} />
        </div>
      </header>

      <main className="wrap">
        <h2 className="sec-title">{section.title}</h2>
        <p className="sec-sub">{section.count}문항</p>
        {section.items.map((item, i) =>
          item.kind === 'heading' ? (
            <h3 className="sub-head" key={`h-${i}`}>
              {item.label}
            </h3>
          ) : (
            <QuestionField key={item.key} q={item} answers={answers} set={set} />
          )
        )}

        <p className="foot-note">
          답변은 이 브라우저에만 저장됩니다. 아래 메뉴에서 파일로 받아 둘 수 있습니다.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void load(f);
          }}
        />
      </main>

      <div className="bar">
        <div className="wrap">
          <button type="button" className="btn" disabled={cur === 0} onClick={() => go(cur - 1)}>
            이전
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => (cur < SECTIONS.length - 1 ? go(cur + 1) : setResult('ai'))}
          >
            {cur < SECTIONS.length - 1 ? '다음' : '결과 보기'}
          </button>
          {/* 문항이 많은 장은 페이지가 14,000px를 넘는다. 이 버튼들이 문서 끝에 있으면 닿지 않는다. */}
          <button type="button" className="btn btn-menu" onClick={() => setMenu(true)}>
            메뉴
          </button>
        </div>
      </div>

      {menu && (
        <div className="sheet" onClick={(e) => e.target === e.currentTarget && setMenu(false)}>
          <div className="panel menu">
            <h2>메뉴</h2>
            <button type="button" className="btn" onClick={() => { setMenu(false); setResult('ai'); }}>
              결과 보기
            </button>
            <button type="button" className="btn" onClick={() => { setMenu(false); setCompare(true); }}>
              다 같이 비교
            </button>
            <button type="button" className="btn" onClick={() => { setMenu(false); download(); }}>
              파일로 저장
            </button>
            <button type="button" className="btn" onClick={() => { setMenu(false); fileRef.current?.click(); }}>
              불러오기
            </button>
            <button type="button" className="btn" onClick={() => { setMenu(false); reset(); }}>
              전체 초기화
            </button>
            <button type="button" className="btn" onClick={() => { setMenu(false); logout(); }}>
              나가기
            </button>
            <button type="button" className="btn ghost" onClick={() => setMenu(false)}>
              닫기
            </button>
          </div>
        </div>
      )}

      {result !== 'closed' && (
        <div className="sheet" onClick={(e) => e.target === e.currentTarget && setResult('closed')}>
          <div className="panel">
            <h2>결과</h2>
            <div className="panel-tabs">
              <button type="button" data-on={result === 'ai'} onClick={() => setResult('ai')}>
                AI 요약
              </button>
              <button type="button" data-on={result === 'list'} onClick={() => setResult('list')}>
                내 답변
              </button>
            </div>

            <div className="out">
              {result === 'ai' ? (
                <Summary name={name} answers={answers} answered={answered} />
              ) : (
                <>
                  <div className="rs-h">
                    <b>{name || '이름 없음'}</b>
                    <span>
                      {answered} / {TOTAL} 답변
                    </span>
                  </div>
                  {sections.length === 0 ? (
                    <p className="rs-empty">아직 답한 항목이 없어요.</p>
                  ) : (
                    sections.map((s) => (
                      <div className="rs-s" key={s.title}>
                        <h4>{s.title}</h4>
                        {s.groups.map((g, gi) => (
                          <div key={gi}>
                            {g.sub && <p className="rs-sub">{g.sub}</p>}
                            <dl>
                              {g.rows.map(([k, v]) => (
                                <span key={k} style={{ display: 'contents' }}>
                                  <dt>{k}</dt>
                                  <dd>{v}</dd>
                                </span>
                              ))}
                            </dl>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </>
              )}
            </div>

            <div className="acts">
              <button type="button" className="btn" onClick={copy}>
                텍스트 복사
              </button>
              <button type="button" className="btn" onClick={() => setResult('closed')}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {compare && (
        <div className="sheet" onClick={(e) => e.target === e.currentTarget && setCompare(false)}>
          <div className="panel wide">
            <h2>다 같이 비교</h2>
            <div className="out">
              <Compare token={session.token} mySlug={session.slug} />
            </div>
            <div className="acts">
              <button type="button" className="btn" onClick={() => setCompare(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
