const baseUrl = (process.env.SEO_CHECK_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

const checks = [
  {
    path: '/api/share/page/directory',
    label: 'directory share page',
    required: [
      '<title>Celina Business Directory | Restaurants, Shops &amp; Services</title>',
      '<link rel="canonical" href="https://www.celinaconnection.com/directory" />',
      'property="og:image"',
      '"@type":"ItemList"',
      '"@type":"FAQPage"',
    ],
  },
  {
    path: '/api/share/page/pricing',
    label: 'pricing share page',
    required: [
      '<title>Claim Your Celina Business Listing | Celina Connection Plans</title>',
      '<link rel="canonical" href="https://www.celinaconnection.com/pricing" />',
      '"@type":"FAQPage"',
      'Which paid plan adds a website link and hours?',
    ],
  },
  {
    path: '/api/share/category/dining',
    label: 'dining category share page',
    required: [
      '<title>Celina Restaurants &amp; Dining | Celina Connection</title>',
      '<link rel="canonical" href="https://www.celinaconnection.com/directory/dining" />',
      '"@type":"CollectionPage"',
      'https://www.celinaconnection.com/directory/dining#business-list',
      "Lucy's on the Square",
    ],
    forbidden: ['Annie Jack Boutique'],
  },
  {
    path: '/api/share/business/annie-jack-boutique',
    label: 'business share page',
    required: [
      '<title>Annie Jack Boutique | Celina Connection</title>',
      '<link rel="canonical" href="https://www.celinaconnection.com/business/annie-jack-boutique" />',
      'property="og:image"',
      'name="twitter:image"',
      '"@type":"LocalBusiness"',
      'photo-1441986300917-64674bd600d8',
    ],
  },
  {
    path: '/sitemap.xml',
    label: 'sitemap',
    required: [
      '<loc>https://www.celinaconnection.com/directory</loc>',
      '<loc>https://www.celinaconnection.com/directory/dining</loc>',
      '<loc>https://www.celinaconnection.com/business/annie-jack-boutique</loc>',
    ],
    forbidden: [
      '<loc>https://www.celinaconnection.com/dashboard</loc>',
      '<loc>https://www.celinaconnection.com/owner-login</loc>',
      '<loc>https://www.celinaconnection.com/admin-login</loc>',
    ],
  },
];

async function fetchText(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'user-agent': 'CelinaConnectionSeoCheck/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}`);
  }

  return response.text();
}

function assertIncludes(text, expected, label, path) {
  if (!text.includes(expected)) {
    throw new Error(`${label} (${path}) is missing: ${expected}`);
  }
}

function assertExcludes(text, forbidden, label, path) {
  if (text.includes(forbidden)) {
    throw new Error(`${label} (${path}) should not include: ${forbidden}`);
  }
}

for (const check of checks) {
  const text = await fetchText(check.path);

  for (const expected of check.required) {
    assertIncludes(text, expected, check.label, check.path);
  }

  for (const forbidden of check.forbidden || []) {
    assertExcludes(text, forbidden, check.label, check.path);
  }

  console.log(`ok - ${check.label}`);
}

console.log(`SEO verification passed for ${baseUrl}`);
