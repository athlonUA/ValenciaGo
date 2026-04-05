export enum EventCategory {
  MUSIC = 'music',
  ARTS = 'arts',
  PERFORMING = 'performing-arts',
  FESTIVALS = 'festivals',
  TECH = 'tech',
  BUSINESS = 'business',
  WORKSHOPS = 'workshops',
  NETWORKING = 'networking',
  EXPAT = 'expat',
  SPORTS = 'sports',
  NIGHTLIFE = 'nightlife',
  FOOD = 'food-drink',
  FAMILY = 'kids-family',
  CULTURAL = 'cultural',
  WELLNESS = 'wellness',
  OTHER = 'other',
}

export interface CategoryDef {
  slug: EventCategory;
  nameEn: string;
  nameEs: string;
  emoji: string;
  keywords: string[];
}

export const CATEGORIES: CategoryDef[] = [
  {
    slug: EventCategory.MUSIC,
    nameEn: 'Music',
    nameEs: 'Música',
    emoji: '🎵',
    keywords: [
      'concierto', 'concert', 'musica', 'music', 'dj', 'live',
      'recital', 'banda', 'band', 'acustico', 'acoustic',
      'sinfonica', 'orquesta', 'orchestra', 'jazz', 'rock',
      'flamenco', 'reggaeton', 'indie', 'clasica', 'classical',
      'coral', 'choir', 'cantante', 'singer',
    ],
  },
  {
    slug: EventCategory.ARTS,
    nameEn: 'Art & Exhibitions',
    nameEs: 'Arte y Exposiciones',
    emoji: '🎨',
    keywords: [
      'exposicion', 'exhibition', 'museo', 'museum', 'galeria',
      'gallery', 'arte', 'art', 'muestra', 'instalacion',
      'vernissage', 'inauguracion', 'pintura', 'escultura',
      'fotografia', 'photography',
    ],
  },
  {
    slug: EventCategory.PERFORMING,
    nameEn: 'Theater & Dance',
    nameEs: 'Teatro y Danza',
    emoji: '🎭',
    keywords: [
      'teatro', 'theatre', 'theater', 'obra', 'play', 'danza',
      'dance', 'ballet', 'circo', 'circus', 'comedia', 'comedy',
      'standup', 'stand-up', 'monologos', 'impro', 'opera',
      'zarzuela', 'espectaculo', 'performance',
    ],
  },
  {
    slug: EventCategory.FESTIVALS,
    nameEn: 'Festivals',
    nameEs: 'Festivales',
    emoji: '🎉',
    keywords: [
      'festival', 'feria', 'festes', 'fiestas', 'fallas',
      'tomatina', 'moros y cristianos', 'mascleta', 'desfile',
      'parade', 'carnaval', 'carnival', 'nit de foc', 'crema',
    ],
  },
  {
    slug: EventCategory.TECH,
    nameEn: 'Tech',
    nameEs: 'Tecnología',
    emoji: '💻',
    keywords: [
      'tech', 'tecnologia', 'programming', 'programacion',
      'software', 'developer', 'desarrollador', 'hackathon',
      'codigo', 'code', 'javascript', 'python', 'ai', 'ia',
      'machine learning', 'data', 'blockchain', 'web3', 'devops',
      'cloud', 'frontend', 'backend', 'fullstack', 'cybersecurity',
      'startup', 'emprendimiento', 'emprendedor',
    ],
  },
  {
    slug: EventCategory.BUSINESS,
    nameEn: 'Business',
    nameEs: 'Negocios',
    emoji: '💼',
    keywords: [
      'business', 'negocio', 'profesional', 'professional',
      'liderazgo', 'leadership', 'management', 'gestion',
      'marketing', 'ventas', 'sales', 'branding', 'estrategia',
      'finanzas', 'finance', 'consulting', 'conferencia',
      'conference', 'congreso', 'summit', 'keynote', 'ponencia',
    ],
  },
  {
    slug: EventCategory.WORKSHOPS,
    nameEn: 'Workshops & Classes',
    nameEs: 'Talleres y Clases',
    emoji: '🛠️',
    keywords: [
      'taller', 'workshop', 'clase', 'class', 'curso', 'course',
      'formacion', 'training', 'masterclass', 'tutorial',
      'aprende', 'learn', 'bootcamp', 'seminario', 'seminar',
      'hands-on', 'laboratorio', 'lab',
    ],
  },
  {
    slug: EventCategory.NETWORKING,
    nameEn: 'Networking',
    nameEs: 'Networking',
    emoji: '🤝',
    keywords: [
      'networking', 'meetup', 'encuentro', 'afterwork',
      'after work', 'happy hour', 'mixer', 'coworking',
      'co-working', 'brunch', 'social',
    ],
  },
  {
    slug: EventCategory.EXPAT,
    nameEn: 'Expat & International',
    nameEs: 'Internacional',
    emoji: '🌍',
    keywords: [
      'expat', 'international', 'internacional', 'erasmus',
      'foreigners', 'extranjeros', 'newcomers', 'welcome',
      'digital nomad', 'nomada digital', 'intercambio de idiomas',
      'language exchange', 'tandem', 'english practice',
      'spanish practice',
    ],
  },
  {
    slug: EventCategory.SPORTS,
    nameEn: 'Sports & Fitness',
    nameEs: 'Deportes',
    emoji: '⚽',
    keywords: [
      'deporte', 'sport', 'fitness', 'yoga', 'running', 'carrera',
      'maraton', 'marathon', 'ciclismo', 'cycling', 'futbol',
      'padel', 'tenis', 'natacion', 'swimming', 'senderismo',
      'hiking', 'escalada', 'climbing', 'surf', 'crossfit',
      'pilates', 'entrenamiento', 'workout',
    ],
  },
  {
    slug: EventCategory.NIGHTLIFE,
    nameEn: 'Nightlife',
    nameEs: 'Vida Nocturna',
    emoji: '🌙',
    keywords: [
      'fiesta', 'party', 'club', 'discoteca', 'nightclub',
      'electronica', 'house', 'techno', 'noche', 'night',
      'after party', 'rave', 'sesion', 'rooftop', 'terraza',
    ],
  },
  {
    slug: EventCategory.FOOD,
    nameEn: 'Food & Drink',
    nameEs: 'Gastronomía',
    emoji: '🍽️',
    keywords: [
      'gastronomia', 'gastronomy', 'cata', 'tasting', 'vino',
      'wine', 'cerveza', 'beer', 'cocina', 'cooking', 'paella',
      'tapas', 'chef', 'food truck', 'mercado', 'market',
      'degustacion', 'horchata', 'vermut', 'cocktail', 'coctel',
    ],
  },
  {
    slug: EventCategory.FAMILY,
    nameEn: 'Kids & Family',
    nameEs: 'Niños y Familia',
    emoji: '👨‍👩‍👧',
    keywords: [
      'ninos', 'kids', 'children', 'familia', 'family',
      'infantil', 'bebe', 'baby', 'cuentacuentos', 'storytelling',
      'manualidades', 'crafts', 'titeres', 'puppets', 'ludoteca',
    ],
  },
  {
    slug: EventCategory.CULTURAL,
    nameEn: 'Cultural & Tours',
    nameEs: 'Cultural',
    emoji: '🏛️',
    keywords: [
      'cultural', 'cultura', 'heritage', 'patrimonio', 'historia',
      'history', 'tradicion', 'visita guiada', 'guided tour',
      'tour', 'ruta', 'route', 'monumento', 'arquitectura',
      'lonja', 'catedral', 'albufera', 'cine', 'cinema',
      'pelicula', 'film', 'documental', 'documentary',
    ],
  },
  {
    slug: EventCategory.WELLNESS,
    nameEn: 'Wellness',
    nameEs: 'Bienestar',
    emoji: '🧘',
    keywords: [
      'bienestar', 'wellness', 'meditacion', 'meditation',
      'mindfulness', 'retiro', 'retreat', 'salud', 'health',
      'terapia', 'therapy', 'holistic', 'respiracion',
      'breathwork', 'sound bath',
    ],
  },
  {
    slug: EventCategory.OTHER,
    nameEn: 'Other',
    nameEs: 'Otros',
    emoji: '📌',
    keywords: [],
  },
];

export const CATEGORY_MAP = new Map(CATEGORIES.map(c => [c.slug, c]));

export function getCategoryDisplay(slug: string): string {
  const cat = CATEGORY_MAP.get(slug as EventCategory);
  return cat ? `${cat.emoji} ${cat.nameEn}` : '📌 Other';
}
