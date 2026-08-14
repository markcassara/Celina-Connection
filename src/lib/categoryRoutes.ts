export type CategoryLandingPage = {
  name: string;
  slug: string;
  title: string;
  description: string;
  intro: string;
};

export const CATEGORY_LANDING_PAGES: CategoryLandingPage[] = [
  {
    name: 'Dining',
    slug: 'dining',
    title: 'Celina Restaurants & Dining | Celina Connection',
    description: 'Find Celina, TX restaurants, bakeries, coffee shops, bars, barbecue, and local dining favorites on Celina Connection.',
    intro: 'Browse Celina restaurants, bakeries, coffee shops, barbecue spots, bars, and other local dining favorites.',
  },
  {
    name: 'Shopping & Boutiques',
    slug: 'shopping-boutiques',
    title: 'Celina Shopping & Boutiques | Celina Connection',
    description: 'Browse Celina, TX boutiques, gift shops, retail stores, apparel, home goods, and local shopping destinations.',
    intro: 'Explore Celina boutiques, gift shops, apparel, home goods, retail stores, and local shopping destinations.',
  },
  {
    name: 'Health & Beauty',
    slug: 'health-beauty',
    title: 'Celina Health & Beauty Businesses | Celina Connection',
    description: 'Find Celina, TX health, wellness, beauty, fitness, dental, barber, salon, and personal care businesses.',
    intro: 'Find Celina health, wellness, beauty, fitness, dental, barber, salon, and personal care providers.',
  },
  {
    name: 'Automotive',
    slug: 'automotive',
    title: 'Celina Automotive Services | Celina Connection',
    description: 'Find Celina, TX automotive repair, maintenance, detailing, tire, diesel, and vehicle service businesses.',
    intro: 'Browse local Celina automotive repair, maintenance, detailing, tire, diesel, and vehicle service businesses.',
  },
  {
    name: 'Real Estate',
    slug: 'real-estate',
    title: 'Celina Real Estate Businesses | Celina Connection',
    description: 'Find Celina, TX real estate agents, brokerages, property professionals, and local housing service providers.',
    intro: 'Find Celina real estate agents, brokerages, property professionals, and housing service providers.',
  },
  {
    name: 'Insurance',
    slug: 'insurance',
    title: 'Celina Insurance Agencies | Celina Connection',
    description: 'Find Celina, TX insurance agencies and local providers for home, auto, life, business, and specialty coverage.',
    intro: 'Browse Celina insurance agencies and providers for home, auto, life, business, and specialty coverage.',
  },
  {
    name: 'Estate Planning',
    slug: 'estate-planning',
    title: 'Celina Estate Planning Services | Celina Connection',
    description: 'Find Celina, TX estate planning professionals, legacy planning resources, trusts, wills, and family planning services.',
    intro: 'Find Celina estate planning professionals, legacy planning resources, trusts, wills, and family planning services.',
  },
  {
    name: 'Financial Services',
    slug: 'financial-services',
    title: 'Celina Financial Services | Celina Connection',
    description: 'Find Celina, TX financial advisors, wealth education, bookkeeping, tax, lending, and local money professionals.',
    intro: 'Browse Celina financial advisors, wealth education, bookkeeping, tax, lending, and local money professionals.',
  },
  {
    name: 'Legal Services',
    slug: 'legal-services',
    title: 'Celina Legal Services | Celina Connection',
    description: 'Find Celina, TX attorneys, legal service providers, business law, family law, estate law, and local legal resources.',
    intro: 'Find Celina attorneys, legal service providers, business law, family law, estate law, and local legal resources.',
  },
  {
    name: 'Mortgage & Lending',
    slug: 'mortgage-lending',
    title: 'Celina Mortgage & Lending Services | Celina Connection',
    description: 'Find Celina, TX mortgage lenders, loan officers, home financing specialists, and local lending resources.',
    intro: 'Browse Celina mortgage lenders, loan officers, home financing specialists, and local lending resources.',
  },
  {
    name: 'Home Services',
    slug: 'home-services',
    title: 'Celina Home Services | Celina Connection',
    description: 'Find Celina, TX contractors, plumbers, lawn care, cleaners, repair pros, and home service providers.',
    intro: 'Find Celina contractors, plumbers, lawn care, cleaners, repair pros, and other home service providers.',
  },
  {
    name: 'Professional Services',
    slug: 'professional-services',
    title: 'Celina Professional Services | Celina Connection',
    description: 'Find Celina, TX professional service providers including consultants, business services, marketing, finance, and operations support.',
    intro: 'Browse Celina consultants, business services, marketing, finance, and operations support providers.',
  },
  {
    name: 'Home & Professional Services',
    slug: 'home-professional-services',
    title: 'Celina Home & Professional Services | Celina Connection',
    description: 'Find Celina, TX home service providers, consultants, financial professionals, local service companies, and business support providers.',
    intro: 'Find Celina home service providers, consultants, financial professionals, local service companies, and business support providers.',
  },
  {
    name: 'Activities & Community',
    slug: 'activities-community',
    title: 'Celina Activities & Community | Celina Connection',
    description: 'Find Celina, TX activities, community businesses, local experiences, family destinations, and things to do.',
    intro: 'Explore Celina activities, community businesses, local experiences, family destinations, and things to do.',
  },
];

export function categoryLandingForSlug(slug = '') {
  return CATEGORY_LANDING_PAGES.find((category) => category.slug === slug.toLowerCase()) || null;
}

export function categoryLandingForName(name = '') {
  return CATEGORY_LANDING_PAGES.find((category) => category.name === name) || null;
}
