import * as turf from '@turf/turf';

export interface Venue {
  id: string;
  name: string;
  type: 'cafe' | 'restaurant' | 'bar';
  coords: [number, number]; // [lng, lat]
  address: string;
  city?: string;
  openingHours?: string;
  cuisine?: string;
  matchScore: number;
  timeA: number; // minutes
  timeB: number; // minutes
  distanceMeters: number;
  imageUrl: string;
  isRealPhoto: boolean;
  photoSource?: string;
  googleMapsUrl: string;
  phone?: string;
  website?: string;
  rawTags?: Record<string, string>;
}

// Curated high-resolution Unsplash photography as reliable initial/fallback preview
const VENUE_PHOTOS: Record<string, string[]> = {
  cafe: [
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1453614512568-c4024d13c247?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=600&q=80',
  ],
  restaurant: [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=600&q=80',
  ],
  bar: [
    'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1536935338788-846bb9981813?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1560512823-829485b8bf24?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1575444758702-4a6b9222336e?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1574096079513-d8259312b785?auto=format&fit=crop&w=600&q=80',
  ],
};

function getFallbackVenueImage(id: string, name: string, type: 'cafe' | 'restaurant' | 'bar'): string {
  const pool = VENUE_PHOTOS[type] || VENUE_PHOTOS.restaurant;
  let hash = 0;
  const str = id + name;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % pool.length;
  return pool[index];
}

/**
 * Free Real-Photo Resolver: Queries Openverse (Creative Commons & Flickr) and Wikimedia APIs
 * to fetch authentic photos of the actual restaurant/venue without requiring paid Google API keys.
 */
export async function fetchRealPhotoForVenue(venue: Venue): Promise<{ url: string; source: string } | null> {
  const tags = venue.rawTags || {};

  // 1. Direct OSM image or Wikimedia Commons tag
  if (tags.image && tags.image.startsWith('http')) {
    return { url: tags.image, source: 'OSM' };
  }
  if (tags.wikimedia_commons) {
    const file = tags.wikimedia_commons.replace(/^File:/i, '');
    return { 
      url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=600`, 
      source: 'Wikimedia Commons' 
    };
  }

  // 2. Wikidata Claim P18 (Image of the venue)
  if (tags.wikidata) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(
        `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${tags.wikidata}&property=P18&format=json&origin=*`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const fileName = data.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
        if (fileName) {
          return {
            url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=600`,
            source: 'Wikidata'
          };
        }
      }
    } catch {}
  }

  // 3. Openverse Creative Commons & Flickr real photo search
  try {
    const cleanName = venue.name.replace(/[^\w\s]/gi, ' ').trim();
    const query = `${cleanName} ${venue.city || ''}`.trim();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=1`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0 && data.results[0].url) {
        return { 
          url: data.results[0].url, 
          source: data.results[0].source || 'Openverse' 
        };
      }
    }
  } catch {}

  // 4. Wikipedia PageImages API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(venue.name + ' ' + (venue.city || ''))}&gsrlimit=1&prop=pageimages&pithumbsize=600&format=json&origin=*`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const pages = searchData.query?.pages ? Object.values(searchData.query.pages) : [];
      if (pages.length > 0 && (pages[0] as any).thumbnail?.source) {
        return { 
          url: (pages[0] as any).thumbnail.source, 
          source: 'Wikipedia' 
        };
      }
    }
  } catch {}

  return null;
}

export async function fetchVenuesAroundMidpoint(
  midpoint: [number, number],
  radiusMeters: number = 850,
  userACoords: [number, number],
  userBCoords: [number, number],
  userAMode: 'transit' | 'driving' | 'walking',
  userBMode: 'transit' | 'driving' | 'walking'
): Promise<Venue[]> {
  // Use nodes and ways (skipping heavy multi-polygon relations) with a strict limit to ensure sub-second response
  const effectiveRadius = Math.min(radiusMeters, 1000);
  const overpassQuery = `
    [out:json][timeout:8];
    (
      node["amenity"~"cafe|restaurant|bar"](around:${effectiveRadius},${midpoint[1]},${midpoint[0]});
      way["amenity"~"cafe|restaurant|bar"](around:${effectiveRadius},${midpoint[1]},${midpoint[0]});
    );
    out center 60;
  `.trim();

  // Fast mirror endpoints
  const ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
  ];

  let data: any = null;
  let lastError: any = null;

  for (const endpoint of ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const url = `${endpoint}?data=${encodeURIComponent(overpassQuery)}`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Endpoint ${endpoint} returned ${response.status}`);
      }
      data = await response.json();
      if (data && data.elements && data.elements.length > 0) {
        break; // Successfully received data!
      }
    } catch (e: any) {
      console.warn(`Overpass API ${endpoint} failed:`, e?.message || e);
      lastError = e;
    }
  }

  if (!data || !data.elements) {
    throw new Error(`Could not fetch venues from live servers. ${lastError?.message ? `(${lastError.message})` : ''} Please try dragging the midpoint slightly.`);
  }

  const estimateTravelTime = (
    from: [number, number],
    to: [number, number],
    mode: 'transit' | 'driving' | 'walking'
  ) => {
    const distanceKm = turf.distance(turf.point(from), turf.point(to), { units: 'kilometers' });
    let speedKmh = 5; // walking
    if (mode === 'driving') speedKmh = 30; // urban driving
    if (mode === 'transit') speedKmh = 18; // urban transit

    return (distanceKm / speedKmh) * 60; // time in minutes
  };

  const venues: Venue[] = [];

  for (const element of data.elements) {
    if (element.tags && element.tags.name) {
      const lat = element.lat || element.center?.lat;
      const lon = element.lon || element.center?.lon;
      
      if (!lat || !lon) continue;
      
      const coords: [number, number] = [lon, lat];
      const tags = element.tags;

      const timeA = estimateTravelTime(userACoords, coords, userAMode);
      const timeB = estimateTravelTime(userBCoords, coords, userBMode);

      // Fairness penalty: discrepancy between travel times relative to max time
      const maxTime = Math.max(timeA, timeB);
      const timeDiff = Math.abs(timeA - timeB);
      const penalty = maxTime > 0 ? timeDiff / maxTime : 0;
      
      // Calculate match score (0 - 100)
      const matchScore = Math.max(10, Math.min(99, Math.round((1 - penalty) * 100)));

      // Calculate distance to FairPoint midpoint in meters
      const distanceMeters = Math.round(
        turf.distance(turf.point(midpoint), turf.point(coords), { units: 'kilometers' }) * 1000
      );

      const city = tags['addr:city'] || tags['addr:town'] || '';
      const address = [
        tags['addr:street'],
        tags['addr:housenumber'],
        city
      ].filter(Boolean).join(' ') || tags['addr:full'] || 'Address near FairPoint';

      const type: 'cafe' | 'restaurant' | 'bar' = 
        tags.amenity === 'cafe' ? 'cafe' :
        tags.amenity === 'bar' ? 'bar' : 'restaurant';

      // Check if OSM has an immediate real photo
      let imageUrl = '';
      let isRealPhoto = false;
      let photoSource = '';

      if (tags.image && tags.image.startsWith('http')) {
        imageUrl = tags.image;
        isRealPhoto = true;
        photoSource = 'OSM';
      } else if (tags.wikimedia_commons) {
        const file = tags.wikimedia_commons.replace(/^File:/i, '');
        imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=600`;
        isRealPhoto = true;
        photoSource = 'Wikimedia';
      } else {
        imageUrl = getFallbackVenueImage(element.id.toString(), tags.name, type);
      }

      // Generate direct Google Maps link for the venue (with reviews, 360 photos, directions)
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tags.name + ' ' + address)}`;

      venues.push({
        id: element.id.toString(),
        name: tags.name,
        type,
        coords,
        address,
        city,
        openingHours: tags.opening_hours,
        cuisine: tags.cuisine,
        matchScore,
        timeA: Math.max(1, Math.round(timeA)),
        timeB: Math.max(1, Math.round(timeB)),
        distanceMeters,
        imageUrl,
        isRealPhoto,
        photoSource,
        googleMapsUrl,
        phone: tags.phone || tags['contact:phone'],
        website: tags.website || tags['contact:website'],
        rawTags: tags,
      });
    }
  }

  // Sort by match score descending, then by distance to midpoint ascending
  const sorted = venues.sort((a, b) => {
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    return a.distanceMeters - b.distanceMeters;
  });

  // Cap to the top 25 recommended venues to prevent any browser lag
  return sorted.slice(0, 25);
}


