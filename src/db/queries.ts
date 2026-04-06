// Barrel re-export for backward compatibility
export type { Queryable } from './types.js';
export { rowToStoredEvent } from './mapper.js';
export {
  upsertEvent,
  getEventById,
  getEventsInRange,
  countEventsInRange,
  searchEvents,
  countSearchEvents,
  getEventStats,
} from './events.js';
export {
  likeEvent,
  unlikeEvent,
  getLikedEventsPaginated,
  countLikedEvents,
  isEventLiked,
  getUserLocale,
  setUserLocale,
  deleteUserData,
} from './preferences.js';
