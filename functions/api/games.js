// Cloudflare Pages Function: GET /api/games
// Returns the next 10 days of games for every sport, in the format index.html expects.
// Needs the environment variable ODDS_API_KEY (from the-odds-api.com).
const SPORTS = {
  NFL: 'americanfootball_nfl',
  NBA: 'basketball_nba',
  NHL: 'icehockey_nhl',
  'NCAA FB': 'americanfootball_ncaaf',
  'NCAA BB': 'basketball_ncaab',
  MLB: 'baseball_mlb',
  UFC: 'mma_mixed_martial_arts',
};

export async function onRequestGet({ request, env, waitUntil }) {
  // Serve a cached copy for an hour so visitors don't each use your API quota.
  let cache = null;
  try { cache = caches.default; const hit = await cache.match(request); if (hit) return hit; } catch (e) { cache = null; }

  const key = env.ODDS_API_KEY;
  if (!key) return new Response(JSON.stringify({ error: 'ODDS_API_KEY is not set' }), { status: 500, headers: { 'content-type': 'application/json' } });

  const now = Date.now();
  const end = now + 10 * 24 * 3600 * 1000;
  const games = {};
  await Promise.all(
    Object.entries(SPORTS).map(async ([label, sportKey]) => {
      try {
        const r = await fetch(`https://api.the-odds-api.com/v4/sports/${sportKey}/events?apiKey=${key}&dateFormat=iso`);
        if (!r.ok) { games[label] = []; return; }
        const events = await r.json();
        games[label] = events
          .filter((e) => { const t = Date.parse(e.commence_time); return t >= now - 3 * 3600 * 1000 && t <= end; })
          .sort((a, b) => Date.parse(a.commence_time) - Date.parse(b.commence_time))
          .map((e) => [e.commence_time, e.away_team, e.home_team, null, null]);
      } catch (err) { games[label] = []; }
    })
  );

  const res = new Response(JSON.stringify({ updated: new Date().toISOString(), games }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' },
  });
  if (cache && waitUntil) { try { waitUntil(cache.put(request, res.clone())); } catch (e) {} }
  return res;
}
