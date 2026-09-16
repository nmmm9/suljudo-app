'use client';

import { useState } from 'react';
import type { Answers } from '@/lib/answers';

export type Session = { name: string; slug: string; token: string };

type Props = { onDone: (session: Session, answers: Answers, created: boolean) => void };

export default function Gate({ onDone }: Props) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? '들어갈 수 없습니다.');
        setBusy(false);
        return;
      }
      onDone({ name: data.name, slug: data.slug, token: data.token }, data.answers ?? {}, data.created);
    } catch {
      setError('연결에 실패했습니다. 잠시 뒤 다시 시도해 주세요.');
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <div className="gate-box">
        <h1>술주도 이상형 설문지</h1>
        <p className="gate-lead">
          543문항입니다. 한 번에 다 못 채웁니다.
          <br />
          이름과 비밀번호를 정해두면 다음에 이어서 할 수 있습니다.
        </p>

        <form onSubmit={submit}>
          <label className="gate-field">
            <span>이름</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="친구들이 알아볼 이름"
              autoComplete="username"
              maxLength={20}
              required
            />
          </label>
          <label className="gate-field">
            <span>비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="네 자 이상, 간단해도 됩니다"
              autoComplete="current-password"
              minLength={4}
              required
            />
          </label>

          {error && <p className="gate-err">{error}</p>}

          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? '확인하는 중…' : '시작하기'}
          </button>
        </form>

        <p className="gate-note">
          처음 쓰는 이름이면 그대로 새로 시작합니다. 이미 쓴 이름이면 비밀번호가 맞아야 이어집니다.
          <br />
          답변은 서버에 저장되고, 들어온 사람끼리 비교 탭에서 서로 볼 수 있습니다.
        </p>
      </div>
    </div>
  );
}
