import { useEffect } from 'react';
import { Business } from '../types';

const SITE_URL = 'https://www.celinaconnection.com';
const SITE_NAME = 'Celina Connection';
const DEFAULT_TITLE = 'Celina Connection | Celina TX Local Business Directory';
const DEFAULT_DESCRIPTION = 'Find local restaurants, shops, services, events, and featured small businesses in Celina, Texas. Claim a free Celina business listing on Celina Connection.';
const DEFAULT_IMAGE = `${SITE_URL}/celina-water-tower-bg.jpg`;
const LEGACY_HILLS_TITLE = 'Legacy Hills Community Petition | Celina Connection';
const LEGACY_HILLS_DESCRIPTION = 'Sign the Legacy Hills community petition and receive neighbor updates through Celina Connection.';

type SeoHeadProps = {
  activeTab: string;
  selectedBusiness?: Business | null;
  businessCount: number;
};

function ensureMeta(selector: string, create: () => HTMLMetaElement) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = create();
    document.head.appendChild(element);
  }
  return element;
}

function setMetaName(name: string, content: string) {
  const element = ensureMeta(`meta[name="${name}"]`, () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', name);
    return meta;
  });
  element.setAttribute('content', content);
}

function setMetaProperty(property: string, content: string) {
  const element = ensureMeta(`meta[property="${property}"]`, () => {
    const meta = document.createElement('meta');
    meta.setAttribute('property', property);
    return meta;
  });
  element.setAttribute('content', content);
}

function setCanonical(url: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', url);
}

function businessSlug(business: Business) {
  return business.slug || business.id;
}

function buildLocalBusinessSchema(business: Business) {
  const ratingCount = business.reviews?.length || 0;
  const averageRating = ratingCount
    ? business.reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / ratingCount
    : null;

  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE_URL}/business/${businessSlug(business)}#localbusiness`,
    name: business.name,
    description: business.description,
    url: `${SITE_URL}/business/${businessSlug(business)}`,
    telephone: business.phone,
    email: business.email,
    image: business.images?.[0] || business.logoUrl || DEFAULT_IMAGE,
    address: business.address
      ? {
          '@type': 'PostalAddress',
          streetAddress: business.address.replace(', Celina, TX 75009', '').replace(', TX 75009', ''),
          addressLocality: 'Celina',
          addressRegion: 'TX',
          postalCode: '75009',
          addressCountry: 'US',
        }
      : {
          '@type': 'PostalAddress',
          addressLocality: 'Celina',
          addressRegion: 'TX',
          postalCode: '75009',
          addressCountry: 'US',
        },
    areaServed: 'Celina, Texas',
    priceRange: '$$',
    sameAs: [business.website, business.socialLinks?.facebook, business.socialLinks?.instagram, business.socialLinks?.twitter].filter(Boolean),
    aggregateRating: averageRating
      ? {
          '@type': 'AggregateRating',
          ratingValue: Number(averageRating.toFixed(1)),
          reviewCount: ratingCount,
        }
      : undefined,
  };
}

function buildDirectorySchema(businessCount: number) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: DEFAULT_DESCRIPTION,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: DEFAULT_IMAGE,
      areaServed: {
        '@type': 'City',
        name: 'Celina',
        address: {
          '@type': 'PostalAddress',
          addressRegion: 'TX',
          addressCountry: 'US',
        },
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      '@id': `${SITE_URL}/#business-directory`,
      name: 'Celina TX Local Business Directory',
      description: `Browse ${businessCount || 'local'} Celina, Texas businesses by category, reviews, and location.`,
      numberOfItems: businessCount,
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${SITE_URL}/#faq`,
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Where can I find local businesses in Celina, Texas?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Celina Connection is a local business directory for Celina, TX with restaurants, shops, health and beauty providers, services, activities, and featured community businesses.',
          },
        },
        {
          '@type': 'Question',
          name: 'How can a Celina business claim a listing?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Celina business owners can claim a free listing on Celina Connection, add business details, and upgrade for premium placement, photos, analytics, and enhanced directory features.',
          },
        },
        {
          '@type': 'Question',
          name: 'What types of businesses are listed on Celina Connection?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'The directory includes dining, shopping, boutiques, health and beauty, home and professional services, and activities in Celina, Texas.',
          },
        },
      ],
    },
  ];
}

export default function SeoHead({ activeTab, selectedBusiness, businessCount }: SeoHeadProps) {
  useEffect(() => {
    const isBusinessPage = Boolean(selectedBusiness);
    const pageTitle = isBusinessPage
      ? `${selectedBusiness!.name} | Celina TX ${selectedBusiness!.category} | Celina Connection`
      : activeTab === 'pricing'
        ? 'Claim Your Celina Business Listing | Celina Connection Plans'
        : activeTab === 'legacyhillspetition'
          ? LEGACY_HILLS_TITLE
        : activeTab === 'dashboard'
          ? 'Add or Claim a Celina Business Listing | Celina Connection'
          : DEFAULT_TITLE;

    const pageDescription = isBusinessPage
      ? `${selectedBusiness!.description} View phone, address, reviews, and details for ${selectedBusiness!.name} in Celina, Texas.`
      : activeTab === 'pricing'
        ? 'Compare free, pro, and premium Celina Connection listing options for local businesses in Celina, Texas.'
        : activeTab === 'legacyhillspetition'
          ? LEGACY_HILLS_DESCRIPTION
        : activeTab === 'dashboard'
          ? 'Claim a free Celina Connection listing, update business details, and help local customers find your Celina, TX business.'
          : DEFAULT_DESCRIPTION;

    const canonical = isBusinessPage
      ? `${SITE_URL}/business/${businessSlug(selectedBusiness!)}`
      : activeTab === 'directory'
        ? SITE_URL
        : `${SITE_URL}/${activeTab}`;
    const image = selectedBusiness?.images?.[0] || selectedBusiness?.logoUrl || DEFAULT_IMAGE;

    document.title = pageTitle;
    setMetaName('description', pageDescription);
    setMetaName('robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
    setMetaName('keywords', 'Celina TX businesses, Celina Texas business directory, Celina restaurants, Celina shops, Celina services, Celina local businesses, Celina Connection');
    setCanonical(canonical);

    setMetaProperty('og:type', isBusinessPage ? 'business.business' : 'website');
    setMetaProperty('og:site_name', SITE_NAME);
    setMetaProperty('og:title', pageTitle);
    setMetaProperty('og:description', pageDescription);
    setMetaProperty('og:url', canonical);
    setMetaProperty('og:image', image);
    setMetaProperty('og:locale', 'en_US');
    setMetaName('twitter:card', 'summary_large_image');
    setMetaName('twitter:title', pageTitle);
    setMetaName('twitter:description', pageDescription);
    setMetaName('twitter:image', image);

    let schemaScript = document.getElementById('celina-seo-schema') as HTMLScriptElement | null;
    if (!schemaScript) {
      schemaScript = document.createElement('script');
      schemaScript.id = 'celina-seo-schema';
      schemaScript.type = 'application/ld+json';
      document.head.appendChild(schemaScript);
    }
    schemaScript.textContent = JSON.stringify(isBusinessPage ? buildLocalBusinessSchema(selectedBusiness!) : buildDirectorySchema(businessCount));
  }, [activeTab, selectedBusiness, businessCount]);

  return null;
}
