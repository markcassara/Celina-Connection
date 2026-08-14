import { useEffect } from 'react';
import { Business } from '../types';
import { categoryLandingForName } from '../lib/categoryRoutes';
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_SOCIAL_IMAGE,
  DIRECTORY_FAQ,
  PAGE_META,
  PRICING_FAQ,
  SITE_NAME,
  SITE_URL,
} from '../lib/seoMetadata';

type SeoHeadProps = {
  activeTab: string;
  selectedBusiness?: Business | null;
  businessCount: number;
  selectedCategory?: string;
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

function canonicalForPath(path: string) {
  return path === '/' ? SITE_URL : `${SITE_URL}${path}`;
}

function socialImageForBusiness(business: Business) {
  const image = business.images?.[0] || business.logoUrl || '';
  if (/^https?:\/\//i.test(image)) return image;
  if (/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/i.test(image)) {
    return `${SITE_URL}/api/social-image/business/${encodeURIComponent(businessSlug(business))}`;
  }
  return DEFAULT_SOCIAL_IMAGE;
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
    image: socialImageForBusiness(business),
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

function buildPageSchema(activeTab: string, businessCount: number, canonical: string, categoryName?: string) {
  const pageMeta = PAGE_META[activeTab] || PAGE_META.home;
  const categoryLanding = activeTab === 'directory' ? categoryLandingForName(categoryName || '') : null;
  const schemaName = categoryLanding?.title || pageMeta.title;
  const schemaDescription = categoryLanding?.description || pageMeta.description;
  const schema: unknown[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: DEFAULT_DESCRIPTION,
      inLanguage: 'en-US',
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/directory?search={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: DEFAULT_SOCIAL_IMAGE,
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
      '@type': pageMeta.schemaType,
      '@id': `${canonical}#webpage`,
      name: schemaName,
      headline: schemaName,
      description: schemaDescription,
      url: canonical,
      inLanguage: 'en-US',
      isPartOf: { '@id': `${SITE_URL}/#website` },
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  ];

  if (activeTab === 'home' || activeTab === 'directory') {
    schema.push(
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
        '@id': `${canonical}#faq`,
        mainEntity: [
          ...DIRECTORY_FAQ.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.answer,
            },
          })),
        ],
      },
    );
  }

  if (activeTab === 'pricing') {
    schema.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${canonical}#faq`,
      mainEntity: [
        ...PRICING_FAQ.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      ],
    });
  }

  if (activeTab !== 'home') {
    schema.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: SITE_URL,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: schemaName,
          item: canonical,
        },
      ],
    });
  }

  return schema;
}

export default function SeoHead({ activeTab, selectedBusiness, businessCount, selectedCategory }: SeoHeadProps) {
  useEffect(() => {
    const isBusinessPage = Boolean(selectedBusiness);
    const pageMeta = PAGE_META[activeTab] || PAGE_META.home;
    const categoryLanding = activeTab === 'directory' ? categoryLandingForName(selectedCategory || '') : null;
    const pageTitle = isBusinessPage
      ? `${selectedBusiness!.name} | Celina TX ${selectedBusiness!.category} | Celina Connection`
      : categoryLanding?.title || pageMeta.title;
    const pageDescription = isBusinessPage
      ? `${selectedBusiness!.description} View phone, address, reviews, and details for ${selectedBusiness!.name} in Celina, Texas.`
      : categoryLanding?.description || pageMeta.description;
    const canonical = isBusinessPage
      ? `${SITE_URL}/business/${businessSlug(selectedBusiness!)}`
      : categoryLanding ? canonicalForPath(`/directory/${categoryLanding.slug}`) : canonicalForPath(pageMeta.path);
    const image = selectedBusiness ? socialImageForBusiness(selectedBusiness) : DEFAULT_SOCIAL_IMAGE;
    const shouldNoindex = activeTab === 'dashboard' || activeTab === 'owner-login' || activeTab === 'admin-login';

    document.title = pageTitle;
    setMetaName('description', pageDescription);
    setMetaName('robots', shouldNoindex ? 'noindex,follow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
    setMetaName('keywords', 'Celina TX businesses, Celina Texas business directory, Celina restaurants, Celina shops, Celina services, Celina local businesses, Celina Connection');
    setCanonical(canonical);

    setMetaProperty('og:type', isBusinessPage ? 'business.business' : 'website');
    setMetaProperty('og:site_name', SITE_NAME);
    setMetaProperty('og:title', pageTitle);
    setMetaProperty('og:description', pageDescription);
    setMetaProperty('og:url', canonical);
    setMetaProperty('og:image', image);
    setMetaProperty('og:image:secure_url', image);
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
    schemaScript.textContent = JSON.stringify(isBusinessPage ? buildLocalBusinessSchema(selectedBusiness!) : buildPageSchema(activeTab, businessCount, canonical, selectedCategory));
  }, [activeTab, selectedBusiness, businessCount, selectedCategory]);

  return null;
}
