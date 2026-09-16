import OpenAI from 'openai';
import { resultText, totalAnswered, type Answers } from '@/lib/answers';
import { TOTAL } from '@/lib/questions';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** 답을 너무 조금 채우면 요약이 의미가 없다. */
const MIN_ANSWERS = 30;
const MODEL = process.env.OPENAI_MODEL ?? 'gpt-5.6-terra';

const SYSTEM = `당신은 이상형 설문 543문항의 답변을 읽고, 답한 사람이 어떤 사람인지 정리해주는 역할을 맡았습니다.

무엇을 쓰는가
- 답변에 실제로 적힌 것만 근거로 삼습니다. 답하지 않은 항목은 없는 것으로 두고, 추측해서 채우지 않습니다.
- 여러 답을 가로질러 드러나는 경향을 찾습니다. 한 문항을 그대로 옮겨 적는 것은 요약이 아닙니다.
- 서로 어긋나는 답이 있으면 그 긴장을 그대로 짚습니다. 억지로 하나의 상으로 봉합하지 않습니다.
- 구체적인 답변을 근거로 인용하되, 목록을 나열하지 말고 문장 안에 녹입니다.

어떻게 쓰는가
- 한국어 존댓말, 담백한 설명체로 씁니다.
- 광고 카피나 성격유형 테스트 같은 말투를 쓰지 않습니다. 단정적인 선언, 과장, 이모지, 느낌표를 쓰지 않습니다.
- 칭찬도 훈계도 하지 않습니다. 관찰한 것을 그대로 전달합니다.
- 문장은 짧게 끊습니다. 한 문장에 한 가지 생각만 담습니다.

형식
- 마크다운으로 쓰되 '## 소제목'과 '- 목록', 그리고 일반 문단만 씁니다. 표와 코드블록은 쓰지 않습니다.
- 아래 여섯 개 소제목을 순서대로 씁니다.

## 한 줄로
답한 사람을 한 문장으로. 30자 안팎.

## 어떤 사람인가
두세 문단. 무엇을 중요하게 보고 무엇에 관심이 없는지, 그 기준이 무엇을 향하는지.

## 연애할 때
한두 문단. 연락, 스킨십, 각자의 시간, 갈등을 다루는 방식.

## 못 넘어가는 선
- 절대 불가, 즉시 탈락, 이별사유 같은 강경한 답이 실제로 있는 항목만 3~6개. 없으면 그렇게 적습니다.

## 의외인 지점
한 문단. 엄격한 기준들 사이에서 유독 관대한 곳, 또는 서로 어긋나는 답.

## 이런 사람과 맞습니다
한 문단. 어떤 상대가 이 기준을 편하게 통과하는지.`;

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: 'OPENAI_API_KEY가 설정되지 않았습니다. 배포 환경변수를 확인해 주세요.' },
      { status: 500 }
    );
  }

  let body: { name?: string; answers?: Answers };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: '요청을 읽을 수 없습니다.' }, { status: 400 });
  }

  const answers = body.answers;
  if (!answers || typeof answers !== 'object') {
    return Response.json({ error: '답변이 없습니다.' }, { status: 400 });
  }

  const answered = totalAnswered(answers);
  if (answered < MIN_ANSWERS) {
    return Response.json(
      { error: `답한 문항이 ${answered}개입니다. ${MIN_ANSWERS}개 이상 답해야 요약할 수 있습니다.` },
      { status: 400 }
    );
  }

  const name = (body.name ?? '').toString().trim().slice(0, 40);
  const text = resultText(answers, name, answered, TOTAL);

  const client = new OpenAI();
  const encoder = new TextEncoder();

  try {
    const stream = await client.responses.create({
      model: MODEL,
      instructions: SYSTEM,
      reasoning: { effort: 'medium' },
      max_output_tokens: 4000,
      input: [
        {
          role: 'user',
          content: `아래는 한 사람이 채운 이상형 설문지입니다. 전체 ${TOTAL}문항 중 ${answered}문항에 답했습니다.\n\n${text}`,
        },
      ],
      stream: true,
    });

    const out = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'response.output_text.delta') {
              controller.enqueue(encoder.encode(event.delta));
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : '알 수 없는 오류';
          controller.enqueue(encoder.encode(`\n\n(요약이 중간에 끊겼습니다: ${msg})`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(out, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    const status = err instanceof OpenAI.APIError ? err.status ?? 500 : 500;
    const message =
      err instanceof OpenAI.APIError
        ? `AI 호출이 실패했습니다 (${status}). ${err.message}`
        : 'AI 호출이 실패했습니다.';
    return Response.json({ error: message }, { status });
  }
}
