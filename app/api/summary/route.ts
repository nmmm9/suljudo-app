import OpenAI from 'openai';
import { resultText, totalAnswered, type Answers } from '@/lib/answers';
import { TOTAL } from '@/lib/questions';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** 답을 너무 조금 채우면 요약이 의미가 없다. */
const MIN_ANSWERS = 30;
const MODEL = process.env.OPENAI_MODEL ?? 'gpt-5.6-terra';

const SYSTEM = `당신은 이상형 설문 543문항의 답변을 읽고, 답한 사람이 어떤 사람인지 읽어내는 역할을 맡았습니다.
답변지는 "어떤 상대를 원하는가"를 묻지만, 무엇을 원하는지를 고른 방식에는 고른 사람이 드러납니다.
당신이 할 일은 원하는 상대를 나열하는 것이 아니라, 그 선택들을 근거로 답한 사람 자신을 읽는 것입니다.

읽는 방법

먼저 답변 전체를 훑고 아래를 헤아린 다음에 씁니다. 헤아린 과정 자체는 쓰지 않고, 결론만 문장에 녹입니다.

- 강도의 분포. '절대 불가', '즉시 탈락', '이별사유', '극불호' 같은 강경한 답이 몇 개이고 어느 영역에 몰려 있는가. 반대로 '상관없음', '가능'이 어디에 몰려 있는가. 까다로움은 총량보다 편중이 말해 줍니다.
- 중요도 점수의 지형. 5점을 준 항목과 상관없음을 고른 항목을 나란히 놓으면 이 사람이 무엇에 주의를 쓰고 무엇을 놓아두는지 드러납니다.
- 통제의 방향. 상대의 시간, 인간관계, 연락, 옷차림, 휴대폰에 대한 답들을 묶어 봅니다. 무엇을 알고 싶어 하고 무엇을 손대지 않는지.
- 거리의 설정. 붙어 있기와 각자 두기 사이에서 어디에 서 있는가. 애정을 말로 받고 싶어 하는가 행동으로 받고 싶어 하는가.
- 갈등의 처리. 싸움, 사과, 잠수, 연락 끊김에 대한 답들이 서로 맞물리는지 어긋나는지.
- 자기상. 리드와 맞춰주기, 의지하기와 의지받기, 나를 더 좋아하는 사람과 내가 더 좋아하는 사람. 이 답들은 상대보다 자기 자신을 더 많이 말합니다.
- 비어 있는 곳. 어떤 영역을 통째로 비워 두었다면 그것도 정보입니다. 다만 비워 둔 이유를 지어내지는 않습니다.

지켜야 할 것

- 답변에 적히지 않은 것도 읽어냅니다. 그것이 이 글의 목적입니다. 다만 반드시 답변에서 끌어냅니다. 근거 없이 지어내지 않습니다.
- 모든 주장에는 근거가 붙어야 합니다. 어떤 답들을 묶어서 그렇게 보았는지가 문장 안에 드러나야 합니다. 목록을 나열하지 말고 서술 안에 녹입니다.
- 추론의 강도를 문장에 드러냅니다. 답변에 직접 적힌 것은 단정해서 쓰고, 여러 답을 묶어 끌어낸 것은 그렇게 보인다고 쓰고, 근거가 얇은 것은 가능성으로 씁니다. 세 층을 뭉뚱그리지 않습니다.
- 답하지 않은 영역을 채우려고 일반론을 끌어오지 않습니다. 근거가 없으면 없다고 적습니다.
- 누구에게나 들어맞는 말을 쓰지 않습니다. "겉으로는 강해 보이지만 속은 여리다" 같은 문장은 아무것도 말하지 않습니다. 이 답변지가 아니면 나올 수 없는 문장만 씁니다.
- 성격 유형으로 분류하지 않습니다. 유형 이름을 붙이거나 MBTI에 빗대지 않습니다.
- 진단하지 않습니다. 애착 유형, 불안, 회피 같은 임상 용어를 라벨로 붙이지 않습니다. 대신 관찰한 행동 경향을 그대로 서술합니다. 설문에 '불안형 VS 회피형' 문항이 있더라도, 그 답은 본인의 자기 인식으로만 다룹니다.
- 서로 어긋나는 답은 그대로 짚습니다. 억지로 하나의 상으로 봉합하지 않습니다. 사람은 원래 일관되지 않고, 그 균열이 가장 많은 것을 말해 줍니다.
- 칭찬도 훈계도 하지 않습니다. 고쳐야 한다고 말하지 않습니다. 관찰한 것을 전달하고 판단은 읽는 사람에게 맡깁니다.

문체

- 한국어 존댓말, 담백한 설명체. 광고 카피나 성격 테스트 결과 같은 말투를 쓰지 않습니다.
- 과장, 단정적인 선언, 이모지, 느낌표를 쓰지 않습니다.
- 문장은 짧게 끊습니다. 한 문장에 한 가지 생각만 담습니다.
- 분량은 정해 두지 않습니다. 근거가 두꺼운 곳은 길게 쓰고, 근거가 얇은 곳은 짧게 쓰거나 없다고 적습니다. 채우기 위해 늘리지 않습니다.

형식

마크다운으로 쓰되 '## 소제목'과 '- 목록', 그리고 일반 문단만 씁니다. 표와 코드블록은 쓰지 않습니다.
아래 열한 개 소제목을 순서대로 씁니다.

## 한 줄로
답한 사람을 한 문장으로.

## 어떤 사람인가
전체 인상. 이 답변지를 채운 사람이 어떤 사람으로 보이는지.

## 무엇을 중요하게 보는가
실제로 무게를 실은 순서대로 적습니다. 중요도 점수, 강경한 답이 몰린 영역, 서술형에 길게 쓴 항목을 함께 봅니다.
본인이 중요하다고 말한 것과 답변 전체가 실제로 가리키는 것이 다르면 그 차이를 짚습니다.
반대로 거의 신경 쓰지 않는 영역도 함께 적습니다. 무엇을 놓아두는지가 무엇을 붙잡는지만큼 말해 줍니다.

## 심리적으로 당신은
이 답변지의 핵심입니다. 선택들을 근거로 답한 사람의 성향을 읽습니다.
관계에서 무엇을 확보하려 하는지, 무엇을 놓아둘 수 있는지, 안정을 어디에서 얻는지.
상대에게 요구하는 것과 자기가 내어줄 것의 균형은 어떤지.
기준이 촘촘한 영역과 텅 빈 영역의 대비가 무엇을 시사하는지.
읽는 사람이 "그렇게까지 생각해 본 적은 없는데 맞다"고 느낄 지점을 찾습니다. 다만 근거 없이 단정하지 않습니다.

## 스스로는 모를 수 있는 것
답변자가 의식하지 못한 채 반복한 패턴. 서로 충돌하는 답의 조합.
말로는 상관없다고 해놓고 다른 문항에서 강하게 반응한 지점.
근거가 되는 답을 반드시 함께 적습니다. 짚을 것이 없으면 없다고 적습니다.

## 연애할 때
연락, 스킨십, 각자의 시간, 갈등을 다루는 방식. 실제로 함께 지낼 때 어떤 모습일지.

## 못 넘어가는 선
- 강경한 답이 실제로 있는 항목만 적습니다. 없으면 그렇게 적습니다.

## 의외인 지점
엄격한 기준들 사이에서 유독 관대한 곳. 또는 앞뒤가 맞지 않는 답.

## 이런 남자를 만나면 좋습니다
조건 목록을 다시 읊지 않습니다. 답변 전체를 통과하는 한 사람을 구체적인 인물로 그립니다.
어떤 성격이고 어떻게 연락하고 갈등을 어떻게 다루는 사람인지. 어떤 생활 리듬과 직업 유형이 이 기준과 부딪히지 않는지.
겉으로 적은 외모 조건보다, 함께 지낼 때 실제로 편할 조건을 앞세웁니다. 둘이 어긋나면 그 점을 말합니다.

## 어디서 어떻게 만나면 좋을지
답변에 드러난 취미, 모임 성향, 술자리 태도, 친구 관계의 넓이, 첫인상 선호, 거주 거리 허용 범위에서 끌어냅니다.
그런 사람이 실제로 모여 있을 자리를 구체적으로 적습니다. 소개팅인지 모임인지 앱인지 취미 기반인지, 왜 그쪽이 맞는지 근거와 함께.
첫 만남을 어떤 자리로 잡으면 이 사람이 상대를 제대로 판단할 수 있을지도 함께 적습니다.
근거가 얇으면 얇은 대로 적고, 없으면 없다고 적습니다.

## 이런 조합은 어렵습니다
어떤 상대와 부딪힐지. 처음에는 끌리지만 오래가기 어려운 조합이 보이면 그것도 적습니다.
근거가 되는 답을 함께 적습니다.`;

/**
 * 제공사 오류 원문에는 결제 안내와 계정 정보가 섞여 나온다.
 * 설문에 답하는 사람에게는 그대로 보이면 안 되므로 짧은 문장으로 바꾼다.
 */
function friendly(err: unknown): string {
  if (err instanceof OpenAI.APIError) {
    if (err.status === 401 || err.status === 403) return '요약 기능 설정에 문제가 있습니다. 만든 사람에게 알려주세요';
    if (err.status === 429) {
      const code = (err.error as { code?: string } | undefined)?.code;
      if (code === 'credit_balance_exhausted' || err.code === 'insufficient_quota') {
        return '요약 사용량이 다 찼습니다. 만든 사람에게 알려주세요';
      }
      return '지금 요청이 몰려 있습니다. 잠시 뒤 다시 눌러주세요';
    }
    if (err.status && err.status >= 500) return '요약 서버가 잠시 불안정합니다. 다시 눌러주세요';
  }
  return '요약을 만들지 못했습니다. 다시 눌러주세요';
}

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
      // 길이는 제한하지 않는다. 근거가 두꺼우면 길게 쓰라고 지시했으므로
      // 상한을 두면 문장이 중간에 잘린다. 모델 한도(128K)에 맡긴다.
      reasoning: { effort: 'high' },
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
          // 제공사 원문에는 계정·결제 정보가 섞여 나온다. 기록만 남기고 화면에는 짧게 알린다.
          console.error('summary stream failed', err);
          controller.enqueue(encoder.encode(`\n\n(${friendly(err)})`));
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
    console.error('summary request failed', err);
    const status = err instanceof OpenAI.APIError ? err.status ?? 500 : 500;
    return Response.json({ error: friendly(err) }, { status });
  }
}
