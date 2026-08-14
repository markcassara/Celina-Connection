export const SITE_URL = 'https://www.celinaconnection.com';
export const SITE_NAME = 'Celina Connection';
export const DEFAULT_SOCIAL_IMAGE = `${SITE_URL}/assets/social/business-owners-banner.jpg`;
export const BRAND_LOGO_IMAGE = `${SITE_URL}/images/celina-connection-logo.png`;

export type PublicPageKey = 'home' | 'directory' | 'events' | 'pricing' | 'launch' | 'legacyhillspetition';

export type PageMeta = {
  title: string;
  description: string;
  path: string;
  h1: string;
  intro: string;
  schemaType: 'CollectionPage' | 'WebPage';
};

export const DEFAULT_TITLE = 'Celina Connection | Celina TX Local Business Directory';
export const DEFAULT_DESCRIPTION = 'Find Celina, Texas restaurants, shops, services, events, and featured small businesses. Browse local favorites or claim a Celina business listing.';

export const PUBLIC_PAGE_META: Record<PublicPageKey, PageMeta> = {
  home: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    path: '/',
    h1: 'Celina Connection local business directory',
    intro: 'Celina Connection helps residents discover trusted local restaurants, shops, services, events, and small businesses in Celina, Texas.',
    schemaType: 'CollectionPage',
  },
  directory: {
    title: 'Celina Business Directory | Restaurants, Shops & Services',
    description: 'Browse Celina, TX businesses by category, including dining, shopping, health, home services, professional services, and community favorites.',
    path: '/directory',
    h1: 'Celina business directory',
    intro: 'Search the Celina Connection directory for local businesses, service providers, restaurants, boutiques, and community resources.',
    schemaType: 'CollectionPage',
  },
  events: {
    title: 'Celina TX Events | Local Community Calendar',
    description: 'Find local Celina, Texas events, community happenings, business events, and family-friendly activities through Celina Connection.',
    path: '/events',
    h1: 'Celina local events',
    intro: 'Explore community events and local happenings in Celina, Texas.',
    schemaType: 'CollectionPage',
  },
  pricing: {
    title: 'Claim Your Celina Business Listing | Celina Connection Plans',
    description: 'Compare free, basic, pro, and premium Celina Connection listing options for local businesses in Celina, Texas.',
    path: '/pricing',
    h1: 'Celina Connection listing plans',
    intro: 'Business owners can claim a free listing or choose a paid visibility plan with richer profile features and placement options.',
    schemaType: 'WebPage',
  },
  launch: {
    title: 'Celina Connection Launch | First 100 Free Listings',
    description: 'Join the Celina Connection launch and claim one of the first 100 free local business listings for Celina, Texas.',
    path: '/launch',
    h1: 'Celina Connection launch',
    intro: 'The launch campaign helps the first Celina business owners claim a local directory presence and reach nearby customers.',
    schemaType: 'WebPage',
  },
  legacyhillspetition: {
    title: 'Legacy Hills Community Petition | Celina Connection',
    description: 'Sign the Legacy Hills community petition and receive neighbor updates through Celina Connection.',
    path: '/legacyhillspetition',
    h1: 'Legacy Hills community petition',
    intro: 'Celina Connection is collecting Legacy Hills neighbor signatures so residents can be counted together and contacted with petition updates.',
    schemaType: 'WebPage',
  },
};

export const PRIVATE_PAGE_META: Record<string, PageMeta> = {
  dashboard: {
    title: 'Add or Claim a Celina Business Listing | Celina Connection',
    description: 'Claim a free Celina Connection listing, update business details, and help local customers find your Celina, TX business.',
    path: '/dashboard',
    h1: 'Add or claim a Celina business listing',
    intro: 'Business owners can sign in, claim listings, and manage local business profiles.',
    schemaType: 'WebPage',
  },
  'owner-login': {
    title: 'Business Owner Login | Celina Connection',
    description: 'Sign in to manage your Celina Connection business listing, reviews, photos, hours, and listing plan.',
    path: '/owner-login',
    h1: 'Business owner login',
    intro: 'Sign in to manage your Celina Connection business listing.',
    schemaType: 'WebPage',
  },
  'admin-login': {
    title: 'Admin Login | Celina Connection',
    description: 'Administrative access for Celina Connection listing management.',
    path: '/admin-login',
    h1: 'Admin login',
    intro: 'Administrative access for Celina Connection listing management.',
    schemaType: 'WebPage',
  },
};

export const PAGE_META: Record<string, PageMeta> = {
  ...PUBLIC_PAGE_META,
  ...PRIVATE_PAGE_META,
};

export const DIRECTORY_FAQ = [
  {
    question: 'Where can I find local businesses in Celina, Texas?',
    answer: 'Use Celina Connection to browse restaurants, shops, service providers, health and beauty businesses, activities, and featured community businesses in Celina, TX.',
  },
  {
    question: 'How can a Celina business claim a listing?',
    answer: 'Business owners can claim a free listing, update business details, add photos, and choose paid visibility plans when they want more placement.',
  },
  {
    question: 'What types of businesses are listed?',
    answer: 'The directory includes dining, shopping, boutiques, home services, professional services, financial services, legal services, real estate, wellness, and community categories.',
  },
];

export const PRICING_FAQ = [
  {
    question: 'Is the free launch listing really free?',
    answer: 'Yes. The free launch listing is a no-card-required starter option for early Celina businesses while the first 100 free slots remain available.',
  },
  {
    question: 'Which paid plan adds a website link and hours?',
    answer: 'Local Pioneer Basic adds a website link and hours of operation while keeping the listing at the standard directory placement level.',
  },
  {
    question: 'Which plan is best for more visibility?',
    answer: 'Celina Champion Pro and Preston Elite Premium are built for businesses that want stronger placement, galleries, review tools, and featured visibility.',
  },
];

export function publicPagePath(page: PublicPageKey) {
  return PUBLIC_PAGE_META[page].path === '/' ? SITE_URL : `${SITE_URL}${PUBLIC_PAGE_META[page].path}`;
}

export function isPublicPageKey(value: string): value is PublicPageKey {
  return value in PUBLIC_PAGE_META;
}
