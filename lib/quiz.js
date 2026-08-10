/**
 * lib/quiz.js
 *
 * The domain-fit questionnaire, in two stages.
 *
 *  Stage 1 — four "which side" questions that say nothing about specific
 *            domains. They only measure pull towards building systems (tech)
 *            versus running and selling the club's work (corp).
 *
 *  Stage 2 — four questions drawn from whichever track stage 1 pointed at.
 *            Only these carry domain weights, so a candidate is never asked to
 *            choose between designing a poster and training a model.
 *
 * Scoring is plain arithmetic and runs locally, so the result stands on its own
 * when the AI advisor is unavailable.
 */

import { domainLabel } from './schemas.js'

export const TRACKS = { TECH: 'tech', CORP: 'corp' }

/** Stage 1: pure track sorting. `track` is the side each option pulls towards. */
export const TRACK_QUIZ = [
  {
    id: 't1',
    prompt: 'A club event is three weeks out. Which job do you actually want?',
    options: [
      { id: 'a', text: 'Build the thing people will use on the day', track: 'tech' },
      { id: 'b', text: 'Get the room, the money and the people there', track: 'corp' },
      { id: 'c', text: 'Make sure nothing breaks when it goes live', track: 'tech' },
      { id: 'd', text: 'Make everyone outside the club care that it exists', track: 'corp' },
    ],
  },
  {
    id: 't2',
    prompt: 'Which problem would you rather spend a whole weekend on?',
    options: [
      { id: 'a', text: 'Something is wrong in the code and you cannot see where', track: 'tech' },
      { id: 'b', text: 'Nobody replied to the last forty emails you sent', track: 'corp' },
      { id: 'c', text: 'The output is technically correct but obviously useless', track: 'tech' },
      { id: 'd', text: 'The idea is good but nobody understands it yet', track: 'corp' },
    ],
  },
  {
    id: 't3',
    prompt: 'Pick the compliment you would most want to hear.',
    options: [
      { id: 'a', text: '"How did you even build that?"', track: 'tech' },
      { id: 'b', text: '"I saw this everywhere, it was impossible to miss."', track: 'corp' },
      { id: 'c', text: '"This has not broken once."', track: 'tech' },
      { id: 'd', text: '"You got them to say yes? Really?"', track: 'corp' },
    ],
  },
  {
    id: 't4',
    prompt: 'Where does your day go when it goes well?',
    options: [
      { id: 'a', text: 'Head down in one hard problem for hours', track: 'tech' },
      { id: 'b', text: 'Twelve conversations that each moved something forward', track: 'corp' },
      { id: 'c', text: 'Reading docs and taking something apart to understand it', track: 'tech' },
      { id: 'd', text: 'Making something look and sound the way it should', track: 'corp' },
    ],
  },
]

/** Stage 2, technical track. Weights point at tech domains only. */
const TECH_QUIZ = [
  {
    id: 'x1',
    prompt: 'Which of these would you enjoy owning end to end?',
    options: [
      { id: 'a', text: 'A page thousands of people load on their phones', weights: { web: 3 } },
      { id: 'b', text: 'A model that has to be right more often than a guess', weights: { aiml: 3 } },
      { id: 'c', text: 'An app that has to work with no signal', weights: { app: 3 } },
      { id: 'd', text: 'A login screen nobody can get past', weights: { cyber: 3 } },
    ],
  },
  {
    id: 'x2',
    prompt: 'Something you shipped just broke in front of real users. First instinct?',
    options: [
      { id: 'a', text: 'Read the logs, reproduce it, patch it', weights: { web: 2, app: 2 } },
      { id: 'b', text: 'Write the test that should have caught this', weights: { qa: 3 } },
      { id: 'c', text: 'Check whether any data got exposed', weights: { cyber: 3 } },
      { id: 'd', text: 'Ask what the data says about who it hit', weights: { aiml: 2, qa: 1 } },
    ],
  },
  {
    id: 'x3',
    prompt: 'Which sentence sounds most like something you would say?',
    options: [
      { id: 'a', text: '"It works, but it breaks at 400px and that bothers me."', weights: { web: 3, app: 1 } },
      { id: 'b', text: '"94% accuracy, but the classes are imbalanced so that means nothing."', weights: { aiml: 3 } },
      { id: 'c', text: '"I found three ways past that login."', weights: { cyber: 3 } },
      { id: 'd', text: '"That works, but only if you do it in exactly that order."', weights: { qa: 3 } },
    ],
  },
  {
    id: 'x4',
    prompt: 'What do you most want to be much better at a year from now?',
    options: [
      { id: 'a', text: 'Shipping software real people depend on', weights: { web: 2, app: 2 } },
      { id: 'b', text: 'Reasoning about data, models and evidence', weights: { aiml: 3 } },
      { id: 'c', text: 'Breaking systems, then defending them', weights: { cyber: 3 } },
      { id: 'd', text: 'Proving something works before anyone else has to find out', weights: { qa: 3 } },
    ],
  },
]

/** Stage 2, corporate track. Weights point at corp domains only. */
const CORP_QUIZ = [
  {
    id: 'y1',
    prompt: 'Which of these would you enjoy owning end to end?',
    options: [
      { id: 'a', text: 'The poster and brand everyone recognises instantly', weights: { creatives: 3 } },
      { id: 'b', text: 'The pitch that gets a company to fund us', weights: { sponsi: 3 } },
      { id: 'c', text: 'The run sheet a 300-person day depends on', weights: { events: 3 } },
      { id: 'd', text: 'The aftermovie people rewatch weeks later', weights: { video: 3 } },
    ],
  },
  {
    id: 'y2',
    prompt: 'The event is in two days and one thing is going badly. You pick up…',
    options: [
      { id: 'a', text: 'The announcement nobody has seen yet', weights: { pr: 3 } },
      { id: 'b', text: 'The sponsor who has gone quiet', weights: { sponsi: 3 } },
      { id: 'c', text: 'The venue that just changed the timings', weights: { events: 3 } },
      { id: 'd', text: 'The artwork that still is not right', weights: { creatives: 2, video: 1 } },
    ],
  },
  {
    id: 'y3',
    prompt: 'Which sentence sounds most like something you would say?',
    options: [
      { id: 'a', text: '"The kerning on that poster is off and I cannot unsee it."', weights: { creatives: 3 } },
      { id: 'b', text: '"That caption is fine, but nobody is going to share it."', weights: { pr: 3 } },
      { id: 'c', text: '"I have followed up twice, I will call them tomorrow."', weights: { sponsi: 3 } },
      { id: 'd', text: '"That cut is four seconds too long."', weights: { video: 3 } },
    ],
  },
  {
    id: 'y4',
    prompt: 'What do you most want to be much better at a year from now?',
    options: [
      { id: 'a', text: 'Making things people feel and remember', weights: { creatives: 2, video: 2 } },
      { id: 'b', text: 'Getting a stranger to say yes', weights: { sponsi: 3 } },
      { id: 'c', text: 'Writing so people actually listen', weights: { pr: 3 } },
      { id: 'd', text: 'Running something big without it falling over', weights: { events: 3 } },
    ],
  },
]

export const STAGE_TWO = { tech: TECH_QUIZ, corp: CORP_QUIZ }

/** Total questions a candidate answers, either way through. */
export const TOTAL_QUESTIONS = TRACK_QUIZ.length + TECH_QUIZ.length

/**
 * Which track the stage-one answers point at.
 * Ties go to tech only because it is the larger half of the club.
 *
 * @returns {{ track: 'tech'|'corp', tech: number, corp: number, decided: boolean }}
 */
export function resolveTrack(answers = {}) {
  let tech = 0
  let corp = 0
  for (const q of TRACK_QUIZ) {
    const chosen = q.options.find((o) => o.id === answers[q.id])
    if (!chosen) continue
    if (chosen.track === 'tech') tech += 1
    else corp += 1
  }
  return {
    track: corp > tech ? TRACKS.CORP : TRACKS.TECH,
    tech,
    corp,
    decided: tech + corp === TRACK_QUIZ.length,
  }
}

/** The stage-two questions this candidate should see. */
export function questionsFor(answers = {}) {
  return STAGE_TWO[resolveTrack(answers).track]
}

/** Every question the candidate has been shown, in order. */
export function fullQuiz(answers = {}) {
  return [...TRACK_QUIZ, ...questionsFor(answers)]
}

/** Max achievable weight per domain within a track — used to normalise. */
function maxByDomain(questions) {
  const totals = {}
  for (const q of questions) {
    const best = {}
    for (const opt of q.options) {
      for (const [k, v] of Object.entries(opt.weights ?? {})) {
        best[k] = Math.max(best[k] ?? 0, v)
      }
    }
    for (const [k, v] of Object.entries(best)) totals[k] = (totals[k] ?? 0) + v
  }
  return totals
}

/**
 * Scores the stage-two answers into a ranked list of domains.
 *
 * @param {Record<string, string>} answers
 * @returns {{ key: string, label: string, score: number, pct: number }[]}
 */
export function scoreQuiz(answers = {}) {
  const questions = questionsFor(answers)
  const ceiling = maxByDomain(questions)
  const totals = {}

  for (const q of questions) {
    const chosen = q.options.find((o) => o.id === answers[q.id])
    if (!chosen) continue
    for (const [k, v] of Object.entries(chosen.weights ?? {})) {
      totals[k] = (totals[k] ?? 0) + v
    }
  }

  return Object.entries(totals)
    .map(([key, score]) => ({
      key,
      label: domainLabel(key),
      score,
      pct: Math.round((score / (ceiling[key] || 1)) * 100),
    }))
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
}

/** True once both stages are fully answered. */
export function isComplete(answers = {}) {
  const { decided } = resolveTrack(answers)
  if (!decided) return false
  return questionsFor(answers).every((q) => Boolean(answers[q.id]))
}

/** A compact transcript for the AI advisor's context. */
export function answerSummary(answers = {}) {
  const { track, tech, corp } = resolveTrack(answers)
  const lines = fullQuiz(answers)
    .map((q) => {
      const chosen = q.options.find((o) => o.id === answers[q.id])
      return chosen ? `- ${q.prompt} → ${chosen.text}` : null
    })
    .filter(Boolean)
  return `Track: ${track} (technical leanings ${tech}/4, corporate ${corp}/4)\n${lines.join('\n')}`
}
