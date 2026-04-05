# Sports Events Sources in Valencia - Research Findings

## 1. Valencia CF (Football - La Liga)

### Schedule URL
```
https://www.valenciacf.com/results?range=next
```
- `?range=next` shows upcoming fixtures (use `?range=prev` for past results)
- Competition filter via query param: `?range=next&competition=23` (LaLiga = 23)

### Tech Stack
- jQuery-based server-rendered HTML (no Next.js, no SPA framework)
- No `__NEXT_DATA__`, no JSON-LD, no API endpoints exposed
- Google Tag Manager: `GTM-WTHDW9W`

### Structured Data Available
**None.** All data must be scraped from HTML.

### HTML Selectors

Top-level match cards (filter out nested children):
```js
// Get all card-game elements, then keep only those whose parent is NOT also card-game
document.querySelectorAll('[class^="card-game "]')
// Filter: !el.parentElement.className.includes('card-game')
```

Per-card selectors:
| Field | Selector | Example Value |
|-------|----------|---------------|
| Date + Matchday | `.card-game__date__date` | `"Sun 05 Apr / Jor. 30"` |
| Venue | `.card-game__date__location` | `"Mestalla"` |
| Competition | `.card-game__date__competicion__name` | `"LaLiga"` |
| Home team | `.card-game__teams__name--left` | `"Valencia CF"` |
| Away team | `.card-game__teams__name--right` | `"Celta de Vigo"` |
| Kick-off time | `.card-game__teams__time` | `"16:15"` (contains `<span>:</span>`) |
| Score (past) | `.card-game__teams__score` | `"2 - 1"` |
| Competition logo | `.card-game__competition__logo img` | `/svg/competitions/ico-laliga.svg` |
| Team badges | `.card-game__teams__logo img` | `/images/teams/celtadevigo.png` |
| Ticket links | `.card-game__links a` | VIP + standard ticket URLs |

Card color modifiers indicate status:
- `card-game--orange` = next home match (highlighted)
- `card-game` (no modifier) = other upcoming matches

### Competition Filter Options
| Value | Competition |
|-------|-------------|
| (empty) | All competitions |
| 23 | LaLiga |
| 331 | Copa Del Rey |
| 99990 | Pretemporada |
| 99991 | Amistosos |
| 99992 | Trofeu Taronja |

### Event Count
- **10 upcoming matches** currently listed (rest of the 2025-26 season)
- Only 2 have confirmed dates/times; remaining 8 show `"VS"` with TBD times

### Scraping Approach
Standard HTTP GET + HTML parsing (Cheerio, BeautifulSoup). No JS rendering needed -- content is server-rendered.

---

## 2. Levante UD (Football - La Liga)

### Schedule URL
```
https://www.levanteud.com/partidos
```
URL pattern for individual matches:
```
/partidos/temporada-2025-2026-laliga-ea-sports-{matchday}-{home-team}-vs-{away-team}
```

### Tech Stack
- **Next.js** with styled-components
- `__NEXT_DATA__` present but match data is loaded client-side (not in SSR payload)
- Build ID changes on deployments (current: `GDP31seLzoWioc7OZ0a2J`)

### Structured Data Available
**`__NEXT_DATA__`** contains page config but NOT the match list itself. The match data is rendered client-side from an internal CMS. However, the full season schedule IS present in the rendered DOM after hydration.

### HTML Selectors

Match cards:
```js
// All match articles
document.querySelectorAll('article[class*="MkFootballMatchCard"]')

// Only upcoming (exclude finished)
document.querySelectorAll('article[class*="MkFootballMatchCard"]:not([class*="status-finished"])')
```

Per-card selectors (use `*=` attribute-contains since class names include styled-component hashes):
| Field | Selector | Example Value |
|-------|----------|---------------|
| Competition | `[class*="MatchCard__competition"]` | `"LALIGA EA SPORTS"` |
| Matchday | `[class*="MatchCard__matchWeek"]` | `"J31"` |
| Home team | `[class*="homeTeam"] [class*="teamName"]` | `"Levante UD"` |
| Away team | `[class*="awayTeam"] [class*="teamName"]` | `"Getafe CF"` |
| Date | `[class*="MatchCard__date"]` or `time` | `"lun, 13 abr"` |
| Score | `[class*="MatchCard__result"]` | `"2-1"` |
| Home score | `[class*="MatchCard__homeScore"]` | `"2"` |
| Away score | `[class*="MatchCard__awayScore"]` | `"1"` |
| Team badge | `img[class*="MatchCard__teamShield"]` | team crest image |
| Match link | `a` (within card) | Full URL to match center |

Status modifier classes:
- `MkFootballMatchCard--status-finished` = completed
- `MkFootballMatchCard--status-pending` = upcoming

Month grouping:
- `.MkFootballModuleListMatches__monthGroup` = groups cards by month
- `.MkFootballModuleListMatches__monthName` = month label (e.g., "abril")

### Event Count
- **8 upcoming matches** (matchdays 31-38, April-May 2026)
- Full season (38 matchdays + cup) all listed on one page
- Dates in Spanish format: `"lun, 13 abr"`, `"jue, 23 abr"`

### Scraping Approach
**Requires JavaScript rendering** (Puppeteer/Playwright). The match data is NOT in the initial HTML payload -- it's loaded client-side after Next.js hydration. Use headless browser, wait for `article[class*="MkFootballMatchCard"]` elements to appear.

### Other Team Calendars
- Women: `/calendario-femenino-23-24`
- Atletico Levante: `/calendario-atletico-levante-ud`

---

## 3. Valencia Basket (Basketball - Liga Endesa + EuroLeague)

### Schedule URL
```
https://www.valenciabasket.com/calendario
```

### Filter Parameters (query string on GET request)
| Parameter | Values | Description |
|-----------|--------|-------------|
| `teamId` | (empty)=all, `57`=Masculino, `1074`=Femenino | Team filter |
| `competitionId` | (empty)=all, `2`=Liga Endesa, `14`=EuroLeague, `213`=Supercopa, `18`=Copa del Rey, `255`=Liga Femenina, `256`=EuroLeague Women | Competition |
| `place` | (empty)=all, `home`=home, `away`=away | Venue filter |

Example filtered URL (men's home games only):
```
https://www.valenciabasket.com/calendario?teamId=57&competitionId=&place=home
```

### Tech Stack
- jQuery-based server-rendered HTML (similar to Valencia CF)
- Slick carousel, custom dropdown filters
- No Next.js, no `__NEXT_DATA__`, no JSON-LD

### iCal Calendar Feed (BONUS!)
```
https://calendar.google.com/calendar/ical/veefrssbs0o4mlc1cmi30s5roo%40group.calendar.google.com/public/basic.ics
```
- **400+ events** spanning multiple seasons
- Valid iCal format with VEVENT entries
- Includes both men's and women's team games
- SUMMARY field uses emoji prefixes for home/away and gender identification
- Actively maintained, includes current 2025-26 season
- Link found at: `/valencia-basket-actualiza-el-calendario-on-line-para-usuarios-de-google-y-outlook`

### HTML Selectors

Page structure:
```
.result-list                          -- main container
  .result-list__filters               -- filter form
  .result-list__inner                 -- matches container
    .result-list__group               -- month group
      h3.result-list__group__title    -- month name ("abril 2026")
      .card-game                      -- individual game card
```

Per-card selectors:
| Field | Selector | Example Value |
|-------|----------|---------------|
| Competition + Matchday | `.card-game__date__competicion__name > div:first-child` | `"Liga Endesa / J25"` |
| Team category | `.card-game__parent` | `"Masculino"` or `"Femenino"` |
| Home team | `.card-game__teams__team--left` | `"Valencia Basket"` |
| Away team | `.card-game__teams__team--right` | `"Río Breogán"` |
| Time | `.card-game__teams__time` | `"18:00"` or `"VS"` (TBD) |
| Ticket VIP | `a[href*="vip"]` | OneBOX ticket URL |
| Ticket standard | `a[href*="entradas-valenciabasket"]` | OneBOX ticket URL |

Date is embedded in fullText of each card (e.g., `"05 abr."`) but does NOT have a dedicated selector. Extract from the card's text content using regex: `/(\d{2}\s\w+\.)/`.

### Event Count
- **18 upcoming games** (all teams, all competitions, April-May 2026)
- Men's home only: **5 games**
- Grouped by month with `h3.result-list__group__title`

### Scraping Approach
Standard HTTP GET + HTML parsing. Content is server-rendered. The filter parameters work as standard GET query params, so you can fetch filtered views directly without JS.

The **iCal feed is the best structured data source** -- parse it with an ics library for clean event objects with proper datetime, summary, and location.

---

## 4. Meetup Sports Events in Valencia

### Schedule URL
```
https://www.meetup.com/find/es--valencia/?categoryId=32
```
Note: `categoryId=32` is "Sports & Fitness" on Meetup.

### Tech Stack
- **Next.js** application
- `__NEXT_DATA__` contains all event data in SSR payload
- Build ID changes on deployments (current: `21747b5f7a6351c15366e7186e0053e9cdedb997`)

### Structured Data Available
**`__NEXT_DATA__`** contains rich structured JSON. Sports events are at:

```
__NEXT_DATA__.props.pageProps.topicalEventsSports[]
```

General events (all categories):
```
__NEXT_DATA__.props.pageProps.eventsInLocation[]
```

Other available arrays:
```
__NEXT_DATA__.props.pageProps.todayEvents[]
__NEXT_DATA__.props.pageProps.thisWeekendEvents[]
__NEXT_DATA__.props.pageProps.topicalEventsMusic[]
__NEXT_DATA__.props.pageProps.topicalEventsSocial[]
__NEXT_DATA__.props.pageProps.topicalEventsOutdoor[]
__NEXT_DATA__.props.pageProps.popularGroups[]
```

### Next.js Data API Endpoint
```
https://www.meetup.com/_next/data/{buildId}/find/es--valencia.json?categoryId=32&city=es--valencia
```
Returns the same JSON as `__NEXT_DATA__` but directly as a JSON endpoint. Note: `buildId` changes on each deployment and must be extracted first.

### Event Object Schema
Each event in `topicalEventsSports[]`:
```json
{
  "id": "314004760",
  "title": "Run & Coffee - 10km",
  "dateTime": "2026-04-18T10:00:00+02:00",
  "endTime": "2026-04-18T12:00:00+02:00",
  "eventUrl": "https://www.meetup.com/valencia-runner-club/events/314004760/",
  "eventType": "PHYSICAL",
  "isOnline": false,
  "going": { "totalCount": 10 },
  "group": {
    "name": "Valencia runner club",
    "urlname": "valencia-runner-club"
  },
  "venue": {
    "name": "Jardi del Turia - Tram IV",
    "city": "valencia",
    "address": "..."
  },
  "featuredEventPhoto": { "baseUrl": "...", "highResUrl": "..." },
  "rsvps": { "edges": [...] }
}
```

### Event Count
- **8 sports events** in `topicalEventsSports`
- **8 events per topical category** (hard cap by Meetup)
- No visible pagination / cursor mechanism in the SSR data

### Types of Sports Events Found
- Running clubs (Valencia Runner Club, Valencia Social Runners)
- Beach volleyball (Las Arenas Volley)
- Acroyoga / yoga (Life In Motion)
- Kundalini + Hatha yoga

### Scraping Approach
**Two options:**

1. **Simple fetch + parse `__NEXT_DATA__`:** HTTP GET the page, extract the `<script id="__NEXT_DATA__">` tag, parse as JSON. No JS rendering needed.

2. **Next.js data API:** Fetch `/_next/data/{buildId}/find/es--valencia.json?...` directly. Requires knowing the current `buildId` (extract from any page load first).

### Limitation
Only 8 sports events are returned per page load. No pagination. For more events, you would need to scrape individual group pages (e.g., `/valencia-runner-club/events/`) which have their own `__NEXT_DATA__` with more events per group.

---

## Summary Comparison

| Source | URL | Data Format | JS Required? | Events Count | Best Method |
|--------|-----|-------------|-------------|-------------|-------------|
| Valencia CF | `/results?range=next` | HTML | No | ~10 upcoming | HTTP + HTML parse |
| Levante UD | `/partidos` | HTML (CSR) | **Yes** | ~8 upcoming | Headless browser |
| Valencia Basket | `/calendario` | HTML + **iCal** | No | ~18 upcoming | **iCal feed** (best) or HTML parse |
| Meetup Sports | `/find/es--valencia/?categoryId=32` | `__NEXT_DATA__` JSON | No | 8 per load | HTTP + JSON extract |

### Recommended Priority
1. **Valencia Basket iCal feed** -- best structured source, standard format, 400+ events, parseable with any ics library
2. **Meetup `__NEXT_DATA__`** -- clean JSON with ISO 8601 dates, venue, group info; limited to 8 events
3. **Valencia CF HTML** -- straightforward server-rendered HTML scraping
4. **Levante UD** -- most complex, requires headless browser for client-rendered content
