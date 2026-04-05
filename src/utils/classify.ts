import { EventCategory, CATEGORIES } from '../types/category.js';

interface ClassifyResult {
  category: EventCategory;
  tags: string[];
  confidence: number;
}

const TITLE_WEIGHT = 3;
const DESCRIPTION_WEIGHT = 1;

// Pre-compiled word boundary regexes for each keyword per category
const categoryPatterns = new Map<EventCategory, Array<{ regex: RegExp; keyword: string }>>();

for (const cat of CATEGORIES) {
  const patterns = cat.keywords.map(keyword => {
    const kw = keyword
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    // Use word boundary matching to avoid substring false positives
    // (e.g., "ia" matching inside "valencia")
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return {
      regex: new RegExp(`\\b${escaped}\\b`, 'i'),
      keyword: kw,
    };
  });
  categoryPatterns.set(cat.slug, patterns);
}

/**
 * Classify an event into a category based on whole-word keyword matching
 * against title and description. Bilingual (Spanish + English).
 */
export function classifyEvent(
  titleNormalized: string,
  description?: string,
): ClassifyResult {
  const descNormalized = (description ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .substring(0, 1000);

  const scores = new Map<EventCategory, number>();

  for (const cat of CATEGORIES) {
    const patterns = categoryPatterns.get(cat.slug);
    if (!patterns || patterns.length === 0) continue;

    let score = 0;
    for (const { regex } of patterns) {
      if (regex.test(titleNormalized)) {
        score += TITLE_WEIGHT;
      } else if (regex.test(descNormalized)) {
        score += DESCRIPTION_WEIGHT;
      }
    }

    if (score > 0) {
      scores.set(cat.slug, score);
    }
  }

  if (scores.size === 0) {
    return { category: EventCategory.OTHER, tags: [], confidence: 0 };
  }

  const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
  const topScore = sorted[0][1];
  const maxPossible = TITLE_WEIGHT * 5;
  const confidence = Math.min(topScore / maxPossible, 1.0);

  const tags = sorted
    .filter(([, score]) => score >= topScore * 0.6)
    .map(([slug]) => slug);

  return {
    category: sorted[0][0],
    tags,
    confidence,
  };
}
