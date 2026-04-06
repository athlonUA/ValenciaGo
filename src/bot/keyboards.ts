import { InlineKeyboard } from 'grammy';
import { CATEGORIES, getCategoryName } from '../types/category.js';
import type { StoredEvent } from '../types/index.js';
import { t, type Locale } from './i18n.js';

// 3 events per page keeps Telegram messages compact (each card is ~5 lines)
const PAGE_SIZE = 3;

/**
 * Build the category selection inline keyboard.
 * 3 buttons per row, excludes 'other'.
 */
export function buildCategoryKeyboard(locale: Locale = 'en'): InlineKeyboard {
  const kb = new InlineKeyboard();
  const displayCategories = CATEGORIES.filter(c => c.slug !== 'other');

  for (let i = 0; i < displayCategories.length; i++) {
    const cat = displayCategories[i];
    kb.text(`${cat.emoji} ${getCategoryName(cat, locale)}`, `cat:${cat.slug}`);
    if ((i + 1) % 3 === 0 && i < displayCategories.length - 1) {
      kb.row();
    }
  }

  return kb;
}

/**
 * Build pagination + hide buttons for event lists.
 *
 * Layout:
 *   [ Hide 1 ] [ Hide 2 ] [ Hide 3 ] [ Hide 4 ]
 *   [ « Prev ]   [ 1/4 ]   [ Next » ]
 */
export function buildEventListKeyboard(
  events: StoredEvent[],
  command: string,
  currentPage: number,
  totalPages: number,
  filter: string = '',
  locale: Locale = 'en',
): InlineKeyboard {
  const kb = new InlineKeyboard();

  // Row 1: Like buttons
  for (let i = 0; i < events.length; i++) {
    kb.text(`❤️ ${i + 1}`, `like:${events[i].id}`);
  }
  // Row 2: Share buttons
  kb.row();
  for (let i = 0; i < events.length; i++) {
    kb.text(`📤 ${i + 1}`, `share:${events[i].id}`);
  }

  // Pagination row (callback_data max 64 bytes — truncate filter)
  if (totalPages > 1) {
    kb.row();
    const shortFilter = filter.substring(0, 20);
    if (currentPage > 1) {
      kb.text(t(locale, 'keyboard.prev'), `p:${command}:${currentPage - 1}:${shortFilter}`);
    } else {
      kb.text(t(locale, 'keyboard.prev'), 'noop');
    }
    kb.text(`${currentPage}/${totalPages}`, 'noop');
    if (currentPage < totalPages) {
      kb.text(t(locale, 'keyboard.next'), `p:${command}:${currentPage + 1}:${shortFilter}`);
    } else {
      kb.text(t(locale, 'keyboard.next'), 'noop');
    }
  }

  // Back to categories
  if (command === 'cat') {
    kb.row().text(t(locale, 'keyboard.categories'), 'categories');
  }

  return kb;
}

export { PAGE_SIZE };
