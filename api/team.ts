// Online save for a team, keyed by its team code. Each team is one JSON document in Upstash Redis (connected to
// the Vercel project under Storage), with a revision number so two phones saving at once can't silently
// overwrite each other, and the last 20 versions kept as a safety net.

const REDIS_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

/** Biggest team document accepted, well under Upstash's 1 MB request limit. */
const MAX_BYTES = 800_000;
const KEEP_VERSIONS = 20;

// Saves `ARGV[2]` only if the team is still at revision `ARGV[1]`, keeping the old copy in the versions list.
// Returns {1, newRev} when saved, or {0, currentRev} when another phone saved first.
const SAVE_IF_UNCHANGED = `
local rev = tonumber(redis.call('GET', KEYS[2]) or '0')
if rev ~= tonumber(ARGV[1]) then return {0, rev} end
local old = redis.call('GET', KEYS[1])
if old then
  redis.call('LPUSH', KEYS[3], old)
  redis.call('LTRIM', KEYS[3], 0, tonumber(ARGV[3]) - 1)
end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], rev + 1)
return {1, rev + 1}
`;

type Stored = { data: Record<string, unknown>; updatedAt: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });

const redis = async (...command: (string | number)[]): Promise<unknown> => {
  const res = await fetch(REDIS_URL!, {
    method: 'POST',
    headers: { authorization: `Bearer ${REDIS_TOKEN}` },
    body: JSON.stringify(command)
  });
  const body = (await res.json()) as { result?: unknown; error?: string };
  if (!res.ok || body.error) throw new Error(body.error ?? `Redis said ${res.status}`);
  return body.result;
};

/** Upper-case letters, digits and dashes, 6 to 32 long; spaces are dropped. Null if it isn't a usable code. */
const teamCode = (request: Request) => {
  const code = (new URL(request.url).searchParams.get('code') ?? '').toUpperCase().replace(/\s+/g, '');
  return /^[A-Z0-9-]{6,32}$/.test(code) ? code : null;
};

const keys = (code: string) => [`team:${code}`, `team:${code}:rev`, `team:${code}:versions`];

const load = async (code: string) => {
  const [doc, rev] = (await redis('MGET', ...keys(code).slice(0, 2))) as [string | null, string | null];
  const stored = doc ? (JSON.parse(doc) as Stored) : null;
  return { rev: Number(rev ?? 0), data: stored?.data ?? null, updatedAt: stored?.updatedAt ?? null };
};

const guard = (request: Request) => {
  if (!REDIS_URL || !REDIS_TOKEN) return { error: json({ error: 'not-configured' }, 503) };
  const code = teamCode(request);
  if (!code) return { error: json({ error: 'bad-code' }, 400) };
  return { code };
};

/** The team's saved data and revision; 404 if nobody has saved under that code yet. */
export async function GET(request: Request) {
  const { code, error } = guard(request);
  if (error) return error;
  try {
    const team = await load(code!);
    return team.data ? json(team) : json({ error: 'not-found', rev: team.rev }, 404);
  } catch {
    return json({ error: 'storage' }, 502);
  }
}

/** Saves `{ baseRev, data }`. 409 with the current copy if another phone saved since `baseRev`. */
export async function PUT(request: Request) {
  const { code, error } = guard(request);
  if (error) return error;

  const text = await request.text();
  if (text.length > MAX_BYTES) return json({ error: 'too-big' }, 413);
  let body: { baseRev?: unknown; data?: unknown };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    return json({ error: 'bad-json' }, 400);
  }
  const baseRev = Number(body.baseRev);
  if (!Number.isInteger(baseRev) || baseRev < 0 || !body.data || typeof body.data !== 'object' || Array.isArray(body.data)) {
    return json({ error: 'bad-body' }, 400);
  }

  try {
    const updatedAt = new Date().toISOString();
    const stored: Stored = { data: body.data as Record<string, unknown>, updatedAt };
    const [saved, rev] = (await redis('EVAL', SAVE_IF_UNCHANGED, 3, ...keys(code!), baseRev, JSON.stringify(stored), KEEP_VERSIONS)) as [
      number,
      number
    ];
    if (saved) return json({ rev, updatedAt });
    return json({ error: 'conflict', ...(await load(code!)) }, 409);
  } catch {
    return json({ error: 'storage' }, 502);
  }
}
