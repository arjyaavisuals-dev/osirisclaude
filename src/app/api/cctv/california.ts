import type { CctvCamera } from './types';
import { stealthFetch } from '@/lib/stealthFetch';
import { cachedSource } from '@/lib/sourceCache';

/**
 * OSIRIS — California CCTV Cameras (Caltrans CWWP2)
 * Source: https://cwwp2.dot.ca.gov/data/d{N}/cctv/cctvStatusD{NN}.json
 * 12 districts, ~3,500 cameras statewide — NO API KEY NEEDED.
 *
 * This is the same public feed the old single-query Caltrans ArcGIS
 * FeatureServer call (still used by ./route.ts's us-west region) draws from,
 * but read district-by-district straight from Caltrans rather than through
 * ArcGIS's row cap, so districts that would be truncated behind that cap
 * still come through in full. Districts are independent files: one district
 * failing does not cost the other eleven.
 */

const DISTRICTS = Array.from({ length: 12 }, (_, i) => i + 1);

function districtUrl(district: number): string {
  const padded = String(district).padStart(2, '0');
  return `https://cwwp2.dot.ca.gov/data/d${district}/cctv/cctvStatusD${padded}.json`;
}

interface CwwpRecord {
  cctv?: {
    index?: string;
    location?: {
      district?: string;
      locationName?: string;
      nearbyPlace?: string;
      county?: string;
      longitude?: string;
      latitude?: string;
    };
    inService?: string;
    imageData?: {
      streamingVideoURL?: string;
      static?: {
        currentImageURL?: string;
      };
    };
  };
}

/** https-ify a Caltrans image URL — the feed still hands out plain http links. */
function toHttps(url: string): string {
  return url.replace(/^http:\/\//i, 'https://');
}

async function fetchDistrict(district: number): Promise<CctvCamera[]> {
  try {
    const res = await stealthFetch(districtUrl(district), { signal: AbortSignal.timeout(12000) });
    if (!res.ok) {
      console.warn(`[OSIRIS] Caltrans D${district} returned ${res.status} — absent from this refresh`);
      return [];
    }
    const data = JSON.parse(await res.text());
    const cams: CctvCamera[] = [];

    for (const record of (data?.data || []) as CwwpRecord[]) {
      const c = record?.cctv;
      const loc = c?.location;
      const img = c?.imageData?.static?.currentImageURL;
      if (!loc || c?.inService !== 'true' || !img) continue;

      const lat = parseFloat(loc.latitude || '');
      const lng = parseFloat(loc.longitude || '');
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      cams.push({
        id: `caltrans-d${district}-${c?.index ?? cams.length}`,
        lat,
        lng,
        name: (loc.locationName || `Caltrans D${district} Camera`).trim(),
        city: (loc.nearbyPlace || loc.county || 'California').trim(),
        country: 'US',
        feed_url: toHttps(img),
        source: 'Caltrans CWWP2',
      });
    }
    return cams;
  } catch (e) {
    console.warn(`[OSIRIS] Caltrans D${district} failed — absent from this refresh:`, e instanceof Error ? e.message : e);
    return [];
  }
}

async function loadCaliforniaCameras(): Promise<CctvCamera[]> {
  const results = await Promise.all(DISTRICTS.map(fetchDistrict));
  const cams = results.flat();
  console.log(`[OSIRIS] California cameras — Caltrans CWWP2: ${cams.length}`);
  return cams;
}

export const fetchCaliforniaCameras = cachedSource('california', loadCaliforniaCameras);
