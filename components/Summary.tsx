'use client';

import { useState } from 'react';
import type { Answers } from '@/lib/answers';

/** 모델에 허용한 문법만 그린다: '## 소제목', '- 목록', 빈 줄로 나뉜 문단, **강조**. */
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={`${keyBase}-${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={`${keyBase}-${i}`}>{part}</span>
    )
  );
}

function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flushList = (i: number) => {
    if (!list.length) return;
    blocks.push(
      <ul key={`ul-${i}`}>
        {list.map((li, j) => (
          <li key={j}>{renderInline(li, `li-${i}-${j}`)}</li>
        ))}
      </ul>
    );
    list = [];
  };

  text.split('\n').forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('- ')) {
      list.push(t.slice(2));
      return;
    }
    flushList(i);
    if (!t) return;
    if (t.startsWith('## ')) blocks.push(<h2 key={i}>{t.slice(3)}</h2>);
    else if (t.startsWith('# ')) blocks.push(<h2 key={i}>{t.slice(2)}</h2>);
    else blocks.push(<p key={i}>{renderInline(t, `p-${i}`)}</p>);
  });
  flushList(-1);

  return <>{blocks}</>;
}

type Props = { name: string; answers: Answers; answered: number };

export default function Summary({ name, answers, answered }: Props) {
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  async function run() {
    setState('loading');
    setText('');
    setError('');
    try {
      const res = await fetch('/api/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, answers }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: '요약을 받지 못했습니다.' }));
        setError(data.error ?? '요약을 받지 못했습니다.');
        setState('error');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setText(acc);
      }
      setState('done');
    } catch {
      setError('네트워크가 끊겼습니다. 다시 시도해 주세요.');
      setState('error');
    }
  }

  if (state === 'idle') {
    return (
      <div className="ai-idle">
        <p>
          답한 {answered}문항을 AI가 읽고, 어떤 사람인지 정리해 줍니다.
          <br />
          심리, 만날 사람, 만날 자리까지 열한 꼭지로 나옵니다.
          <br />
          많이 채웠을수록 길고 자세해집니다. 1분에서 2분 걸립니다.
        </p>
        <button type="button" className="btn primary" onClick={run}>
          요약 받기
        </button>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="ai-idle">
        <p className="ai-err">{error}</p>
        <button type="button" className="btn" onClick={run}>
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="ai">
      {text ? <Markdown text={text} /> : <p>읽는 중입니다…</p>}
      {state === 'loading' && <span className="cursor" />}
    </div>
  );
}
