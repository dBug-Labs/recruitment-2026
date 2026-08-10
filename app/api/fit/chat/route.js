/**
 * app/api/fit/chat/route.js
 *
 * POST /api/fit/chat
 *
 * Thin server-side proxy to Groq's OpenAI-compatible chat endpoint, used by the
 * domain-fit advisor at /fit. The key never reaches the browser, the prompt is
 * pinned server-side, and the request is rate limited and size capped so this
 * cannot be turned into a free general-purpose chatbot.
 *
 * Set GROQ_API_KEY in .env.local. Without it the route returns 503 and the /fit
 * page falls back to the locally scored ranking.
 */

import { withErrorHandling } from '@/lib/rbac'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { scoreQuiz, answerSummary, isComplete, resolveTrack } from '@/lib/quiz'
import { DOMAIN_CARDS } from '@/app/_components/domains'
import { z } from 'zod'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'

const MAX_TURNS = 12
const MAX_CHARS = 800
const TIMEOUT_MS = 25_000

/** Hard ceiling on advisor calls per IP. The opening question counts as one. */
const MAX_PROMPTS = 5
const WINDOW_SECONDS = 6 * 60 * 60

const BodySchema = z.object({
  answers: z.record(z.string(), z.string()).default({}),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(MAX_CHARS),
      })
    )
    .max(MAX_TURNS)
    .default([]),
})

/** The domain catalogue, compressed to keep the prompt small. */
function domainBrief() {
  return DOMAIN_CARDS.map(
    (d) => `${d.label} (${d.group}): ${d.teaser} Looks for: ${d.looking.join('; ')}. Tools: ${d.tools.join(', ')}.`
  ).join('\n')
}

function systemPrompt(ranking, answers) {
  const top = ranking.slice(0, 4).map((r) => `${r.label} (${r.pct}%)`).join(', ')
  const { track } = resolveTrack(answers)
  return [
    'You are the domain-fit advisor for dBug Labs, a student technology club at SRM.',
    'A candidate has just taken an eight-question quiz: four questions sorted them towards the technical or corporate side, then four narrowed down the domain within that side.',
    `Their answers put them on the ${track === 'corp' ? 'CORPORATE' : 'TECHNICAL'} side.`,
    'Help them decide which TWO domains to pick on their application form.',
    '',
    'THE TEN DOMAINS:',
    domainBrief(),
    '',
    'THEIR QUIZ ANSWERS:',
    answerSummary(answers) || '(no answers recorded)',
    '',
    `LOCAL SCORING PUT THEM AT: ${top || '(no ranking)'}`,
    '',
    'HOW TO BEHAVE:',
    '- Open by naming the two domains you would pick for them and why, in three sentences or fewer.',
    '- Be direct and specific. Reference their actual answers, not generic advice.',
    '- Both domains you suggest should normally come from their own side; only cross over if they explicitly ask.',
    '- dBug Labs recruits for eagerness to learn, not existing skill. Never tell someone they lack the experience for a domain — say what they would learn there instead.',
    '- Disagree with the local ranking when their answers justify it, and say so plainly.',
    '- Ask at most one follow-up question per reply, only when it would genuinely change your advice.',
    '- Keep replies under 130 words. No headings, no bullet-point walls, no emoji.',
    '- The form allows a maximum of two domains. Never suggest more than two as the final answer.',
    '- If asked about deadlines: applications close 28 August 2026, and each candidate gets 5 days from their own application date to submit the task.',
    '- Stay on the topic of dBug Labs domains and recruitment. If asked about anything else, say that is outside what you can help with and steer back.',
    '- Never claim to know their application status, and never promise selection.',
  ].join('\n')
}

export const POST = withErrorHandling(async function handler(request) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return json(
      {
        error: 'The AI advisor is not configured yet. Your quiz result below is still accurate.',
        code: 'no_api_key',
      },
      503
    )
  }

  // Five advisor calls per IP, full stop — this is a decision aid, not a chatbot
  const ip = getClientIp(request)
  const rl = await checkRateLimit(`fit:${ip}`, { limit: MAX_PROMPTS, windowSeconds: WINDOW_SECONDS })
  if (!rl.allowed) {
    return json(
      {
        error: `That's all ${MAX_PROMPTS} advisor questions used up. Your ranking still stands — go pick your two domains.`,
        code: 'limit_reached',
        remaining: 0,
      },
      429
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return json({ error: 'That message was too long or malformed.' }, 422)
  }

  const { answers, messages } = parsed.data
  if (!isComplete(answers)) {
    return json({ error: 'Finish the quiz first.' }, 422)
  }

  const ranking = scoreQuiz(answers)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let res
  try {
    res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.6,
        max_tokens: 400,
        messages: [
          { role: 'system', content: systemPrompt(ranking, answers) },
          ...messages,
        ],
      }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    const timedOut = err.name === 'AbortError'
    console.error('[fit] Groq request failed:', err.message)
    return json(
      { error: timedOut ? 'The advisor took too long to answer. Try again.' : 'Could not reach the advisor right now.' },
      504
    )
  }
  clearTimeout(timeout)

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error(`[fit] Groq responded ${res.status}:`, detail.slice(0, 400))
    if (res.status === 401) return json({ error: 'The advisor is misconfigured (bad API key).' }, 502)
    if (res.status === 429) return json({ error: 'The advisor is busy. Give it a moment.' }, 429)
    return json({ error: 'The advisor could not answer that one.' }, 502)
  }

  const data = await res.json()
  const reply = data?.choices?.[0]?.message?.content?.trim()
  if (!reply) {
    return json({ error: 'The advisor returned an empty answer.' }, 502)
  }

  return json({ reply, model: data.model ?? MODEL, remaining: rl.remaining })
})

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
