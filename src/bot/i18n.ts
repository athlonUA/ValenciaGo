export type Locale = 'en' | 'uk' | 'es';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'uk', 'es'];

export function isLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export function resolveLocale(languageCode?: string): Locale {
  if (languageCode?.startsWith('uk')) return 'uk';
  if (languageCode?.startsWith('es')) return 'es';
  return 'en';
}

/**
 * Resolve locale with DB override: saved preference > Telegram language_code > 'en'.
 */
export function resolveLocaleWithOverride(savedLocale: string | null, languageCode?: string): Locale {
  if (savedLocale && isLocale(savedLocale)) return savedLocale;
  return resolveLocale(languageCode);
}

import type { Context } from 'grammy';
import type { Queryable } from '../db/types.js';
import { getUserLocale } from '../db/preferences.js';

/**
 * Resolve locale for a Telegram context: check DB preference first, fallback to Telegram language.
 */
export async function resolveCtxLocale(ctx: Context, pool: Queryable): Promise<Locale> {
  const userId = ctx.from?.id;
  if (userId) {
    const saved = await getUserLocale(pool, userId);
    if (saved && isLocale(saved)) return saved;
  }
  return resolveLocale(ctx.from?.language_code);
}

const translations = {
  en: {
    // Formatters
    'free': 'Free',
    'from': 'From',
    'map': 'Map',
    'details': 'Details',
    'noEventsFound': 'No events found.',

    // Welcome
    'welcome.title': 'Valencia Events',
    'welcome.today': '/today — Events today',
    'welcome.tomorrow': '/tomorrow — Tomorrow',
    'welcome.weekend': '/weekend — This weekend',
    'welcome.week': '/week — Next 7 days',
    'welcome.free': '/free — Free events',
    'welcome.category': '/category — By category',
    'welcome.likes': '/likes — Your saved events',
    'welcome.lang': '/lang — Language',

    // Event headers
    'events.today': 'Events today, {date}',
    'events.tomorrow': 'Events tomorrow, {date}',
    'events.weekend': 'Weekend events',
    'events.freeThisWeek': 'Free events this week',
    'events.thisWeek': 'Events this week',
    'events.categoryWeek': '{emoji} {name} events this week',
    'events.noEvents': 'No events found. {hint}',
    'events.hint.today': 'Try /tomorrow or /week.',
    'events.hint.tomorrow': 'Try /today or /week.',
    'events.hint.weekend': 'Try /week.',
    'events.hint.week': 'Try /category.',
    'events.hint.free': 'Try /week.',
    'events.unknownCategory': 'Unknown category',

    // Misc
    'misc.unknownCategory': 'Unknown category. Send /category to see available categories.',
    'misc.unknownCategoryNamed': 'Unknown category "{name}". Send /category to see available categories.',
    'misc.browseByCategory': 'Browse by category:',
    'misc.eventNotFound': 'Event not found',
    'misc.deleteData': 'Your data has been deleted ({deleted} liked events removed). Your Telegram ID is no longer stored.',

    // Stats
    'stats.title': 'Event Statistics',
    'stats.total': 'Total events: {count}',
    'stats.upcoming': 'Upcoming: {count}',
    'stats.bySource': 'By source:',
    'stats.byCategory': 'Upcoming by category:',

    // Likes
    'likes.empty': 'No liked events. Tap ❤️ on any event to save it.',
    'likes.header': '❤️ Your liked events ({total})',
    'likes.saved': '❤️ Saved! View with /likes',
    'likes.removed': 'Removed from likes',

    // Search
    'search.noResults': 'No events found for "{query}". Try a shorter or different term.',
    'search.noResultsSmart': 'No events found for "{query}". Try /week or /category to browse.',
    'search.header': 'Search: "{query}" ({count} found)',
    'search.found': 'Found {count} events',
    'search.expired': 'Search results expired. Please search again.',
    'search.voiceNotConfigured': 'Voice search is not configured.',
    'search.voiceOwnerOnly': 'Voice search is available to the bot owner only.',
    'search.voiceTooLong': 'Voice message too long. Please keep it under 30 seconds.',
    'search.voiceUnsupported': 'Unsupported file format. Please send a voice message.',
    'search.voiceNotUnderstood': 'Could not understand the voice message. Try again.',
    'search.voiceSearching': '🎙 "{text}"\n\nSearching...',
    'search.voiceFailed': 'Failed to process voice message. Try typing your search instead.',
    'search.unknownCommand': 'Unknown command. Send /today or /category to browse events.',

    // Bot
    'rateLimit.callback': 'Too many requests. Please wait.',
    'rateLimit.message': 'Too many requests. Please wait a moment.',

    // Keyboards
    'keyboard.prev': '« Prev',
    'keyboard.next': 'Next »',
    'keyboard.categories': '« Categories',

    // Language
    'lang.choose': 'Choose language:',
    'lang.set': 'Language set to English.',

    // Command descriptions (for setMyCommands)
    'cmd.lang': 'Set interface language',
    'cmd.today': 'Events happening today',
    'cmd.tomorrow': 'Tomorrow\'s events',
    'cmd.weekend': 'Saturday & Sunday',
    'cmd.week': 'Next 7 days',
    'cmd.free': 'Free events this week',
    'cmd.category': 'Browse by category',
    'cmd.likes': 'Your liked events',
    'cmd.stats': 'Event statistics',
  },
  uk: {
    // Formatters
    'free': 'Безкоштовно',
    'from': 'Від',
    'map': 'Карта',
    'details': 'Деталі',
    'noEventsFound': 'Подій не знайдено.',

    // Welcome
    'welcome.title': 'Valencia Events',
    'welcome.today': '/today — Події сьогодні',
    'welcome.tomorrow': '/tomorrow — Завтра',
    'welcome.weekend': '/weekend — Ці вихідні',
    'welcome.week': '/week — Наступні 7 днів',
    'welcome.free': '/free — Безкоштовні події',
    'welcome.category': '/category — За категорією',
    'welcome.likes': '/likes — Збережені події',
    'welcome.lang': '/lang — Мова',

    // Event headers
    'events.today': 'Події сьогодні, {date}',
    'events.tomorrow': 'Події завтра, {date}',
    'events.weekend': 'Події на вихідних',
    'events.freeThisWeek': 'Безкоштовні події цього тижня',
    'events.thisWeek': 'Події цього тижня',
    'events.categoryWeek': '{emoji} {name} — події цього тижня',
    'events.noEvents': 'Подій не знайдено. {hint}',
    'events.hint.today': 'Спробуйте /tomorrow або /week.',
    'events.hint.tomorrow': 'Спробуйте /today або /week.',
    'events.hint.weekend': 'Спробуйте /week.',
    'events.hint.week': 'Спробуйте /category.',
    'events.hint.free': 'Спробуйте /week.',
    'events.unknownCategory': 'Невідома категорія',

    // Misc
    'misc.unknownCategory': 'Невідома категорія. Надішліть /category, щоб побачити доступні категорії.',
    'misc.unknownCategoryNamed': 'Невідома категорія "{name}". Надішліть /category, щоб побачити доступні категорії.',
    'misc.browseByCategory': 'Обрати категорію:',
    'misc.eventNotFound': 'Подію не знайдено',
    'misc.deleteData': 'Ваші дані видалено ({deleted} збережених подій). Ваш Telegram ID більше не зберігається.',

    // Stats
    'stats.title': 'Статистика подій',
    'stats.total': 'Всього подій: {count}',
    'stats.upcoming': 'Майбутніх: {count}',
    'stats.bySource': 'За джерелом:',
    'stats.byCategory': 'Майбутні за категорією:',

    // Likes
    'likes.empty': 'Немає збережених подій. Натисніть ❤️ на будь-якій події, щоб зберегти.',
    'likes.header': '❤️ Збережені події ({total})',
    'likes.saved': '❤️ Збережено! Переглянути: /likes',
    'likes.removed': 'Видалено зі збережених',

    // Search
    'search.noResults': 'Подій не знайдено за запитом "{query}". Спробуйте коротший або інший запит.',
    'search.noResultsSmart': 'Подій не знайдено за запитом "{query}". Спробуйте /week або /category.',
    'search.header': 'Пошук: "{query}" ({count} знайдено)',
    'search.found': 'Знайдено {count} подій',
    'search.expired': 'Результати пошуку застаріли. Будь ласка, повторіть пошук.',
    'search.voiceNotConfigured': 'Голосовий пошук не налаштовано.',
    'search.voiceOwnerOnly': 'Голосовий пошук доступний лише власнику бота.',
    'search.voiceTooLong': 'Голосове повідомлення надто довге. Будь ласка, до 30 секунд.',
    'search.voiceUnsupported': 'Непідтримуваний формат. Будь ласка, надішліть голосове повідомлення.',
    'search.voiceNotUnderstood': 'Не вдалося розпізнати голосове повідомлення. Спробуйте ще раз.',
    'search.voiceSearching': '🎙 "{text}"\n\nШукаю...',
    'search.voiceFailed': 'Не вдалося обробити голосове повідомлення. Спробуйте ввести пошук текстом.',
    'search.unknownCommand': 'Невідома команда. Надішліть /today або /category для перегляду подій.',

    // Bot
    'rateLimit.callback': 'Забагато запитів. Зачекайте.',
    'rateLimit.message': 'Забагато запитів. Зачекайте трохи.',

    // Keyboards
    'keyboard.prev': '« Назад',
    'keyboard.next': 'Далі »',
    'keyboard.categories': '« Категорії',

    // Language
    'lang.choose': 'Оберіть мову:',
    'lang.set': 'Мову змінено на українську.',

    // Command descriptions (for setMyCommands)
    'cmd.lang': 'Обрати мову інтерфейсу',
    'cmd.today': 'Події сьогодні',
    'cmd.tomorrow': 'Події завтра',
    'cmd.weekend': 'Субота та неділя',
    'cmd.week': 'Наступні 7 днів',
    'cmd.free': 'Безкоштовні події',
    'cmd.category': 'За категорією',
    'cmd.likes': 'Збережені події',
    'cmd.stats': 'Статистика подій',
  },
  es: {
    // Formatters
    'free': 'Gratis',
    'from': 'Desde',
    'map': 'Mapa',
    'details': 'Detalles',
    'noEventsFound': 'No se encontraron eventos.',

    // Welcome
    'welcome.title': 'Valencia Events',
    'welcome.today': '/today — Eventos de hoy',
    'welcome.tomorrow': '/tomorrow — Mañana',
    'welcome.weekend': '/weekend — Este fin de semana',
    'welcome.week': '/week — Próximos 7 días',
    'welcome.free': '/free — Eventos gratuitos',
    'welcome.category': '/category — Por categoría',
    'welcome.likes': '/likes — Tus eventos guardados',
    'welcome.lang': '/lang — Idioma',

    // Event headers
    'events.today': 'Eventos hoy, {date}',
    'events.tomorrow': 'Eventos mañana, {date}',
    'events.weekend': 'Eventos del fin de semana',
    'events.freeThisWeek': 'Eventos gratuitos esta semana',
    'events.thisWeek': 'Eventos esta semana',
    'events.categoryWeek': '{emoji} {name} — eventos esta semana',
    'events.noEvents': 'No se encontraron eventos. {hint}',
    'events.hint.today': 'Prueba /tomorrow o /week.',
    'events.hint.tomorrow': 'Prueba /today o /week.',
    'events.hint.weekend': 'Prueba /week.',
    'events.hint.week': 'Prueba /category.',
    'events.hint.free': 'Prueba /week.',
    'events.unknownCategory': 'Categoría desconocida',

    // Misc
    'misc.unknownCategory': 'Categoría desconocida. Envía /category para ver las categorías disponibles.',
    'misc.unknownCategoryNamed': 'Categoría desconocida "{name}". Envía /category para ver las categorías disponibles.',
    'misc.browseByCategory': 'Buscar por categoría:',
    'misc.eventNotFound': 'Evento no encontrado',
    'misc.deleteData': 'Tus datos han sido eliminados ({deleted} eventos guardados eliminados). Tu ID de Telegram ya no se almacena.',

    // Stats
    'stats.title': 'Estadísticas de eventos',
    'stats.total': 'Total de eventos: {count}',
    'stats.upcoming': 'Próximos: {count}',
    'stats.bySource': 'Por fuente:',
    'stats.byCategory': 'Próximos por categoría:',

    // Likes
    'likes.empty': 'No tienes eventos guardados. Pulsa ❤️ en cualquier evento para guardarlo.',
    'likes.header': '❤️ Tus eventos guardados ({total})',
    'likes.saved': '❤️ ¡Guardado! Ver con /likes',
    'likes.removed': 'Eliminado de guardados',

    // Search
    'search.noResults': 'No se encontraron eventos para "{query}". Prueba un término más corto o diferente.',
    'search.noResultsSmart': 'No se encontraron eventos para "{query}". Prueba /week o /category.',
    'search.header': 'Búsqueda: "{query}" ({count} encontrados)',
    'search.found': '{count} eventos encontrados',
    'search.expired': 'Los resultados de búsqueda han expirado. Por favor, busca de nuevo.',
    'search.voiceNotConfigured': 'La búsqueda por voz no está configurada.',
    'search.voiceOwnerOnly': 'La búsqueda por voz solo está disponible para el propietario del bot.',
    'search.voiceTooLong': 'Mensaje de voz demasiado largo. Máximo 30 segundos.',
    'search.voiceUnsupported': 'Formato no compatible. Por favor, envía un mensaje de voz.',
    'search.voiceNotUnderstood': 'No se pudo entender el mensaje de voz. Inténtalo de nuevo.',
    'search.voiceSearching': '🎙 "{text}"\n\nBuscando...',
    'search.voiceFailed': 'Error al procesar el mensaje de voz. Prueba a escribir tu búsqueda.',
    'search.unknownCommand': 'Comando desconocido. Envía /today o /category para ver eventos.',

    // Bot
    'rateLimit.callback': 'Demasiadas solicitudes. Espera un momento.',
    'rateLimit.message': 'Demasiadas solicitudes. Espera un momento.',

    // Keyboards
    'keyboard.prev': '« Anterior',
    'keyboard.next': 'Siguiente »',
    'keyboard.categories': '« Categorías',

    // Language
    'lang.choose': 'Elige idioma:',
    'lang.set': 'Idioma cambiado a español.',

    // Command descriptions (for setMyCommands)
    'cmd.lang': 'Cambiar idioma',
    'cmd.today': 'Eventos de hoy',
    'cmd.tomorrow': 'Eventos de mañana',
    'cmd.weekend': 'Sábado y domingo',
    'cmd.week': 'Próximos 7 días',
    'cmd.free': 'Eventos gratuitos esta semana',
    'cmd.category': 'Por categoría',
    'cmd.likes': 'Tus eventos guardados',
    'cmd.stats': 'Estadísticas de eventos',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function t(locale: Locale, key: TranslationKey, params?: Record<string, string | number>): string {
  // Runtime fallback to English if key somehow missing in target locale
  const value = translations[locale][key] ?? translations.en[key];
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (_, k: string) =>
    params[k] !== undefined ? String(params[k]) : `{${k}}`,
  );
}

/** Build the Telegram command list for a given locale */
export function buildCommandList(locale: Locale): Array<{ command: string; description: string }> {
  return [
    { command: 'today', description: t(locale, 'cmd.today') },
    { command: 'tomorrow', description: t(locale, 'cmd.tomorrow') },
    { command: 'weekend', description: t(locale, 'cmd.weekend') },
    { command: 'week', description: t(locale, 'cmd.week') },
    { command: 'free', description: t(locale, 'cmd.free') },
    { command: 'category', description: t(locale, 'cmd.category') },
    { command: 'likes', description: t(locale, 'cmd.likes') },
    { command: 'stats', description: t(locale, 'cmd.stats') },
    { command: 'lang', description: t(locale, 'cmd.lang') },
  ];
}

/** Get the Intl date locale string for a given Locale */
export function dateLocale(locale: Locale): string {
  switch (locale) {
    case 'uk': return 'uk';
    case 'es': return 'es';
    default: return 'en-GB';
  }
}
