export interface CelinaEvent {
  id: string;
  title: string;
  category: string;
  date: string;
  time: string;
  location: string;
  address: string;
  description: string;
  imageUrl: string;
  organizer: string;
  link?: string;
  sourceLabel?: string;
  featured?: boolean;
}

export const CELINA_EVENTS: CelinaEvent[] = [
  {
    id: 'evt-1',
    title: 'Celina Friday Night Farmers Market',
    category: 'Community',
    date: '2026-08-07',
    time: '6:00 PM - 9:00 PM',
    location: 'Historic Celina Square',
    address: '127 N Ohio St, Celina, TX 75009',
    description: 'Experience local produce, handcrafted goods, live Texas acoustic music, and family food trucks under the square lights.',
    imageUrl: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=1200&q=80',
    organizer: 'Celina Main Street Center',
    link: 'https://www.lifeincelinatx.com/events',
    sourceLabel: 'Life in Celina Events',
    featured: true,
  },
  {
    id: 'evt-2',
    title: 'Downtown Celina Wine & Craft Walk',
    category: 'Festivals & Food',
    date: '2026-08-15',
    time: '4:00 PM - 8:00 PM',
    location: 'Downtown Celina Square',
    address: 'Celina, TX 75009',
    description: 'Stroll through historic downtown boutiques, sampling regional Texas wines and artisanal bites prepared by local chefs.',
    imageUrl: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1200&q=80',
    organizer: 'Celina Business Alliance',
    link: 'https://business.celinachamber.org/event-calendar',
    sourceLabel: 'Celina Chamber Calendar',
    featured: true,
  },
  {
    id: 'evt-3',
    title: 'Celina Bobcats Pre-Season Community Rally',
    category: 'Sports & Family',
    date: '2026-08-21',
    time: '6:30 PM - 8:30 PM',
    location: 'Bobcat Stadium',
    address: '315 E Pecan St, Celina, TX 75009',
    description: 'Join the community in celebrating football season kickoff with food trucks, band performances, and games.',
    imageUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
    organizer: 'Celina High School Athletics',
    link: 'https://www.celinaisd.com/who-we-are/event-calendars',
    sourceLabel: 'Celina ISD Calendar',
    featured: false,
  },
  {
    id: 'evt-4',
    title: 'Parks & Recreation Board Meeting',
    category: 'Public Meetings',
    date: '2026-08-05',
    time: '6:00 PM',
    location: 'Celina City Council Chambers',
    address: '112 N Colorado St, Celina, TX 75009',
    description: 'A public city meeting for Parks & Recreation updates, community planning items, and board discussion.',
    imageUrl: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
    organizer: 'City of Celina',
    link: 'https://www.celina-tx.gov/Calendar/home',
    sourceLabel: 'City Calendar',
  },
  {
    id: 'evt-5',
    title: 'Library Board Meeting',
    category: 'Public Meetings',
    date: '2026-08-05',
    time: '6:00 PM',
    location: 'Celina City Council Chambers',
    address: '112 N Colorado St, Celina, TX 75009',
    description: 'Public library board meeting listed through the City of Celina calendar.',
    imageUrl: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1200&q=80',
    organizer: 'City of Celina',
    link: 'https://www.celina-tx.gov/Calendar/home',
    sourceLabel: 'City Calendar',
  },
  {
    id: 'evt-6',
    title: 'Ribbon Cutting - Costco',
    category: 'Chamber',
    date: '2026-08-26',
    time: '7:30 AM - 10:00 AM',
    location: 'Celina Area',
    address: 'Celina, TX 75009',
    description: 'A Celina Chamber ribbon cutting event celebrating a local grand opening.',
    imageUrl: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80',
    organizer: 'Celina Chamber of Commerce',
    link: 'https://business.celinachamber.org/event-calendar',
    sourceLabel: 'Celina Chamber Calendar',
  },
  {
    id: 'evt-7',
    title: 'Ribbon Cutting - CAVEIRINHA JIU-JITSU',
    category: 'Chamber',
    date: '2026-08-27',
    time: 'Evening',
    location: 'Celina Area',
    address: 'Celina, TX 75009',
    description: 'A Celina Chamber ribbon cutting for a new CAVEIRINHA JIU-JITSU academy serving the Celina community.',
    imageUrl: 'https://images.unsplash.com/photo-1555597673-b21d5c935865?auto=format&fit=crop&w=1200&q=80',
    organizer: 'Celina Chamber of Commerce',
    link: 'https://business.celinachamber.org/event-calendar',
    sourceLabel: 'Celina Chamber Calendar',
  },
  {
    id: 'evt-8',
    title: 'Movie Night at the Park',
    category: 'Family',
    date: '2026-08-28',
    time: 'Evening',
    location: 'Celina Parks',
    address: 'Celina, TX 75009',
    description: 'A family-friendly movie night hosted as part of Celina community programming.',
    imageUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=80',
    organizer: 'Life in Celina',
    link: 'https://www.lifeincelinatx.com/events',
    sourceLabel: 'Life in Celina Events',
    featured: true,
  }
];
