import type { ClimateTopic } from './topics';
import type { CivicAction } from './recommend';
import type { Motivator, ToneTag } from '../browsing/profile';

// ---------------------------------------------------------------------------
// Composable frame templates: hook + bridge + nudge
// Each variant is tagged with 1-2 tones for vocabulary matching.
// ---------------------------------------------------------------------------

interface FrameVariant {
  text: string;
  tones: ToneTag[];
}

const HOOKS: Record<Motivator, FrameVariant[]> = {
  cost: [
    { text: 'Save money', tones: ['practical'] },
    { text: 'Cut your costs', tones: ['practical'] },
    { text: 'Keep more in your pocket', tones: ['practical'] },
    { text: 'Stretch your budget', tones: ['practical'] },
    { text: 'It pays to act', tones: ['practical', 'action'] },
    { text: 'Free to join', tones: ['practical', 'social'] },
    { text: 'This one saves you money', tones: ['practical'] },
  ],
  health: [
    { text: 'Protect your health', tones: ['emotional'] },
    { text: 'Breathe easier', tones: ['emotional'] },
    { text: 'Healthier for your family', tones: ['emotional', 'social'] },
    { text: 'Better for your body', tones: ['practical'] },
    { text: 'Safer for your kids', tones: ['emotional', 'urgent'] },
    { text: 'Cleaner living starts here', tones: ['practical', 'action'] },
    { text: 'Your wellbeing matters', tones: ['emotional'] },
  ],
  community: [
    { text: 'Your neighbors are on this', tones: ['social'] },
    { text: 'Join people near you', tones: ['social', 'action'] },
    { text: 'Rally your community', tones: ['social', 'action'] },
    { text: 'Be part of something local', tones: ['social'] },
    { text: 'Show up together', tones: ['social', 'action'] },
    { text: 'People near you care about this', tones: ['social', 'emotional'] },
    { text: 'Your community is moving on this', tones: ['social', 'urgent'] },
  ],
  identity: [
    { text: 'Live your values', tones: ['emotional'] },
    { text: 'Walk the talk', tones: ['emotional', 'action'] },
    { text: 'This is your kind of action', tones: ['emotional', 'action'] },
    { text: 'Stand for what matters', tones: ['emotional'] },
    { text: 'Put your beliefs into action', tones: ['emotional', 'action'] },
    { text: 'Make it count', tones: ['action', 'urgent'] },
    { text: 'This aligns with what you care about', tones: ['emotional'] },
  ],
};

const BRIDGES: Record<ClimateTopic, FrameVariant[]> = {
  energy: [
    { text: 'on clean energy in your area', tones: ['social'] },
    { text: 'to lower energy waste', tones: ['practical'] },
    { text: 'for renewable power locally', tones: ['social'] },
    { text: 'toward cheaper, cleaner electricity', tones: ['practical'] },
  ],
  transport: [
    { text: 'for greener commuting', tones: ['practical'] },
    { text: 'to cut transport emissions', tones: ['practical'] },
    { text: 'for better transit options', tones: ['practical'] },
    { text: 'for cleaner roads near you', tones: ['social'] },
  ],
  'built-environment': [
    { text: 'for greener buildings near you', tones: ['social'] },
    { text: 'to improve your living space', tones: ['practical'] },
    { text: 'toward climate-ready communities', tones: ['emotional'] },
  ],
  'food-land': [
    { text: 'for healthier local food', tones: ['social'] },
    { text: 'to reduce food waste', tones: ['practical'] },
    { text: 'for sustainable food choices', tones: ['emotional'] },
    { text: 'toward a cleaner food system', tones: ['emotional'] },
  ],
  nature: [
    { text: 'protecting nearby nature', tones: ['emotional', 'social'] },
    { text: 'for local green space', tones: ['social'] },
    { text: 'to preserve wildlife habitat', tones: ['emotional'] },
    { text: 'safeguarding natural areas', tones: ['emotional'] },
  ],
  'industry-materials': [
    { text: 'for a repair-and-reuse economy', tones: ['practical'] },
    { text: 'to keep products in use longer', tones: ['practical'] },
    { text: 'to cut waste locally', tones: ['practical', 'social'] },
    { text: 'for less plastic pollution', tones: ['emotional'] },
  ],
  policy: [
    { text: 'on climate policy that affects you', tones: ['practical'] },
    { text: 'to shape local climate rules', tones: ['social', 'action'] },
    { text: 'for stronger environmental standards', tones: ['emotional'] },
    { text: 'pushing for real policy change', tones: ['action'] },
  ],
  community: [
    { text: 'with people who share your values', tones: ['social'] },
    { text: 'in your local climate community', tones: ['social'] },
    { text: 'with neighbors who care', tones: ['social', 'emotional'] },
  ],
  professional: [
    { text: 'with climate leaders and innovators', tones: ['social'] },
    { text: 'to build your climate network', tones: ['social', 'practical'] },
    { text: 'with industry changemakers', tones: ['social', 'action'] },
  ],
  'hands-on': [
    { text: 'by getting your hands dirty', tones: ['action', 'practical'] },
    { text: 'by doing something tangible', tones: ['action'] },
    { text: 'with direct, local impact', tones: ['action', 'social'] },
  ],
  advocacy: [
    { text: 'against fossil fuel expansion', tones: ['emotional', 'action'] },
    { text: 'by making your voice count', tones: ['action'] },
    { text: 'by pushing for real change', tones: ['action', 'emotional'] },
  ],
  learning: [
    { text: 'to deepen your understanding', tones: ['practical'] },
    { text: 'with the latest climate insights', tones: ['practical'] },
    { text: 'from experts in the field', tones: ['social', 'practical'] },
  ],
  creative: [
    { text: 'through art and storytelling', tones: ['emotional'] },
    { text: 'through culture and creativity', tones: ['emotional', 'social'] },
    { text: 'by reimagining what\'s possible', tones: ['emotional'] },
  ],
};

interface NudgeContext {
  type: CivicAction['type'];
  daysLeft?: number;
  distanceMi?: number;
  signatures?: number;
}

function buildNudgePool(ctx: NudgeContext): FrameVariant[] {
  const pool: FrameVariant[] = [];

  if (ctx.daysLeft != null && ctx.daysLeft > 0 && ctx.daysLeft <= 14) {
    if (ctx.daysLeft <= 2) {
      pool.push({ text: `— only ${ctx.daysLeft} day${ctx.daysLeft === 1 ? '' : 's'} left`, tones: ['urgent'] });
    } else {
      pool.push({ text: `— ${ctx.daysLeft} days left`, tones: ['urgent'] });
    }
  }

  if (ctx.distanceMi != null && ctx.distanceMi < 50) {
    pool.push({ text: `— just ${Math.round(ctx.distanceMi)} mi away`, tones: ['social'] });
  }

  if (ctx.signatures && ctx.signatures >= 100) {
    const formatted = ctx.signatures >= 1000
      ? `${(ctx.signatures / 1000).toFixed(1).replace(/\.0$/, '')}k`
      : String(ctx.signatures);
    pool.push({ text: `— ${formatted} people already in`, tones: ['social'] });
  }

  switch (ctx.type) {
    case 'petition':
      pool.push(
        { text: '— add your name', tones: ['action'] },
        { text: '— sign in 30 seconds', tones: ['practical', 'action'] },
        { text: '— your signature counts', tones: ['emotional', 'action'] },
      );
      break;
    case 'event':
      pool.push(
        { text: '— happening soon', tones: ['urgent'] },
        { text: '— show up and be counted', tones: ['action', 'social'] },
      );
      break;
    case 'campaign':
      pool.push(
        { text: '— join the push', tones: ['action', 'social'] },
        { text: '— add your voice', tones: ['action'] },
        { text: '— momentum is building', tones: ['social', 'urgent'] },
      );
      break;
    case 'comment':
      pool.push(
        { text: '— public comment is open', tones: ['action'] },
        { text: '— make your voice heard', tones: ['emotional', 'action'] },
      );
      break;
  }

  return pool;
}

// ---------------------------------------------------------------------------
// Tone-aware selection: pick the variant whose tones best match the user
// ---------------------------------------------------------------------------

function scoreToneMatch(variant: FrameVariant, userTones: Record<ToneTag, number>): number {
  const totalToneHits = Object.values(userTones).reduce((s, v) => s + v, 0) || 1;
  let score = 0;
  for (const t of variant.tones) {
    score += (userTones[t] ?? 0) / totalToneHits;
  }
  return score;
}

function pickBest(
  pool: FrameVariant[],
  userTones: Record<ToneTag, number>,
  salt: number,
): FrameVariant {
  if (pool.length === 0) return { text: '', tones: [] };
  if (pool.length === 1) return pool[0];

  const scored = pool
    .map((v, i) => ({ v, score: scoreToneMatch(v, userTones), idx: i }))
    .sort((a, b) => b.score - a.score);

  // Among top candidates with similar scores (within 20% of best), pick deterministically
  const bestScore = scored[0].score;
  const threshold = bestScore * 0.8;
  const topCandidates = scored.filter((s) => s.score >= threshold);
  const pick = topCandidates[salt % topCandidates.length];
  return pick.v;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FrameContext {
  motivator: Motivator;
  tones: Record<ToneTag, number>;
  daysLeft?: number;
  distanceMi?: number;
}

export interface ActionFrame {
  hook: string;
  bridge: string;
  nudge: string;
  full: string;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function pickFrame(action: CivicAction, ctx: FrameContext): ActionFrame {
  const salt = hashCode(action.id);

  // Pick highest-weighted topic for bridge phrasing
  let topic: ClimateTopic = 'policy';
  let topWeight = 0;
  for (const [t, w] of Object.entries(action.topics) as [ClimateTopic, number][]) {
    if (w > topWeight) { topWeight = w; topic = t; }
  }

  const hookPool = HOOKS[ctx.motivator] ?? HOOKS.identity;
  const bridgePool = BRIDGES[topic] ?? BRIDGES.policy;
  const nudgeCtx: NudgeContext = {
    type: action.type,
    daysLeft: ctx.daysLeft,
    distanceMi: ctx.distanceMi,
    signatures: action.signatures,
  };
  const nudgePool = buildNudgePool(nudgeCtx);

  const hook = pickBest(hookPool, ctx.tones, salt);
  const bridge = pickBest(bridgePool, ctx.tones, salt + 1);
  const nudge = nudgePool.length > 0
    ? pickBest(nudgePool, ctx.tones, salt + 2)
    : { text: '', tones: [] };

  const full = nudge.text
    ? `${hook.text} ${bridge.text} ${nudge.text}`
    : `${hook.text} ${bridge.text}`;

  return { hook: hook.text, bridge: bridge.text, nudge: nudge.text, full };
}

export function dominantMotivator(motivators: Record<Motivator, number>): Motivator {
  let best: Motivator = 'identity';
  let bestScore = -1;
  for (const [m, score] of Object.entries(motivators) as [Motivator, number][]) {
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}
