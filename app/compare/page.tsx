'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Compare from '@/components/Compare';
import { loadSession, type Session } from '@/lib/session';

export default function ComparePage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(loadSession());
    setReady(true);
  }, []);

  if (!ready) return <p className="boot">불러오는 중입니다…</p>;

  if (!session) {
    return (
      <div className="cmp-page">
        <p className="cmp-msg">
          비교를 보려면 먼저 들어와야 합니다.
          <br />
          <Link href="/">설문지로 가기</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="cmp-page">
      <header className="cmp-head">
        <div>
          <h1>다 같이 비교</h1>
          <p>답한 사람들의 답을 문항별로 나란히 놓습니다.</p>
        </div>
        <Link className="btn" href="/">
          설문지로
        </Link>
      </header>
      <Compare token={session.token} mySlug={session.slug} />
    </div>
  );
}
