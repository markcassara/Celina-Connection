export interface CelinaEvent {
  id: string;
  title: string;
  description: string;
  date: string; // ISO String or YYYY-MM-DD
  time: string;
  location: string;
  category: 'Festivals' | 'Farmers Market' | 'Chamber' | 'City' | 'Sports';
  organizer: string;
  link?: string;
}

export const CELINA_EVENTS: CelinaEvent[] = [
  {
    id: 'evt-friday-market',
    title: "Celina Friday Night Market",
    description: "The beloved Friday Night Market on the historic downtown square features over 75 local vendors, fresh North Texas produce, hand-crafted artisanal items, live acoustic music, and family-friendly activities.",
    date: "2026-07-10",
    time: "6:00 PM - 9:00 PM",
    location: "Historic Celina Square, 100 block of Ohio St",
    category: "Farmers Market",
    organizer: "City of Celina",
    link: "https://www.celina-tx.gov"
  },
  {
    id: 'evt-cajunfest',
    title: "Celina Cajunfest 2026",
    description: "The largest Cajun festival in North Texas! Featuring a massive crawfish boil, live Cajun and zydeco music, alligator shows, a custom car show, local retail pop-ups, and kids play zone. Over 20,000 visitors gather on the Square.",
    date: "2026-07-25",
    time: "11:00 AM - 10:00 PM",
    location: "Downtown Celina Square",
    category: "Festivals",
    organizer: "Celina Chamber of Commerce",
    link: "https://www.celinachamber.org"
  },
  {
    id: 'evt-chamber-coffee',
    title: "Chamber Networking Coffee Connection",
    description: "Join fellow Celina business owners, managers, and entrepreneurs for morning coffee and professional networking. Pitch your business, share referrals, and discuss local business growth.",
    date: "2026-07-14",
    time: "8:00 AM - 9:30 AM",
    location: "Lucy's on the Square (127 N Ohio St)",
    category: "Chamber",
    organizer: "Celina Chamber of Commerce",
    link: "https://www.celinachamber.org"
  },
  {
    id: 'evt-council-meeting',
    title: "Celina City Council Regular Meeting",
    description: "Regular public session of the Celina City Council to review local development permits, public safety budgets, and road improvement projects on the Preston Road corridor.",
    date: "2026-07-14",
    time: "5:00 PM - 7:30 PM",
    location: "Celina Council Chambers (142 N Ohio St)",
    category: "City",
    organizer: "City of Celina",
    link: "https://www.celina-tx.gov"
  },
  {
    id: 'evt-bobcat-rally',
    title: "Bobcat Athletics Season Pep Rally",
    description: "Get ready for Friday Night Lights! Meet the coaches, cheer squad, and athletes for the legendary Celina Bobcats. Face-painting, marching band showcase, and Bobcat merchandise stalls.",
    date: "2026-07-28",
    time: "6:30 PM - 8:30 PM",
    location: "Bobcat Stadium (Celina High School)",
    category: "Sports",
    organizer: "Celina ISD & Boosters",
    link: "https://www.celinaisd.com"
  },
  {
    id: 'evt-music-square',
    title: "Music on the Square: Saturday Series",
    description: "Bring your lawn chairs and blankets for an evening of live classic country and Texas rock underneath the historic Celina water tower. Free admission, coolers welcome!",
    date: "2026-07-18",
    time: "7:00 PM - 9:30 PM",
    location: "Downtown Celina Square Stage",
    category: "Festivals",
    organizer: "City of Celina",
    link: "https://www.celina-tx.gov"
  },
  {
    id: 'evt-chamber-luncheon',
    title: "Chamber Quarterly Business Luncheon",
    description: "Focus on local economic forecasts, Preston Road corridor expansions, and city development roadmap. Guest speaker is the Celina Economic Development Director.",
    date: "2026-07-22",
    time: "11:30 AM - 1:00 PM",
    location: "Two29 on the Square (229 W Pecan St)",
    category: "Chamber",
    organizer: "Celina Chamber of Commerce",
    link: "https://www.celinachamber.org"
  },
  {
    id: 'evt-planning-zoning',
    title: "Planning & Zoning Commission Hearing",
    description: "Public hearing regarding master-planned residential communities and commercial development requests in North Celina.",
    date: "2026-07-21",
    time: "6:00 PM - 8:00 PM",
    location: "Celina Council Chambers",
    category: "City",
    organizer: "City of Celina"
  }
];
