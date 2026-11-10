/**
 * MediGrid Enterprise Geolocation Resolver
 * 
 * Supports:
 * 1. Google Maps Plus Codes (Open Location Codes): e.g. "XQP9+36H, Kollam, Keralam 691531" or "6JWRXQP9+36H"
 * 2. Google Maps URLs: e.g. "https://www.google.com/maps/@8.9852,76.7681,17z"
 * 3. Raw GPS Coordinates: e.g. "8.9852, 76.7681"
 * 4. Human Street Addresses & PIN codes via OpenStreetMap Nominatim with local centroid fallback
 */

import { OpenLocationCode } from 'open-location-code';

const olc = new OpenLocationCode();

export interface ResolvedLocation {
  lat: number;
  lng: number;
  city?: string;
  formattedAddress?: string;
  method: 'plus_code' | 'direct_coords' | 'google_maps_url' | 'nominatim_address' | 'preset_fallback';
}

export const POPULAR_LOCALITIES: Record<string, { city: string; lat: number; lng: number }> = {
  'Kollam - City Center': { city: 'Kollam', lat: 8.8932, lng: 76.6141 },
  'Kochi - Edappally': { city: 'Kochi', lat: 10.0261, lng: 76.3125 },
  'Thiruvananthapuram - Central': { city: 'Thiruvananthapuram', lat: 8.5241, lng: 76.9366 },
  'Kozhikode - Mavoor Rd': { city: 'Kozhikode', lat: 11.2588, lng: 75.7804 },
  'Bangalore - Indiranagar': { city: 'Bangalore', lat: 12.9784, lng: 77.6408 },
  'Bangalore - Koramangala': { city: 'Bangalore', lat: 12.9352, lng: 77.6245 },
  'Bangalore - Whitefield': { city: 'Bangalore', lat: 12.9698, lng: 77.7500 },
  'Bangalore - HSR Layout': { city: 'Bangalore', lat: 12.9121, lng: 77.6446 },
  'Bangalore - Electronic City': { city: 'Bangalore', lat: 12.8399, lng: 77.6770 },
  'Mumbai - Bandra': { city: 'Mumbai', lat: 19.0596, lng: 72.8295 },
  'Mumbai - Andheri': { city: 'Mumbai', lat: 19.1136, lng: 72.8697 },
  'Delhi - Connaught Place': { city: 'Delhi', lat: 28.6315, lng: 77.2167 },
  'Hyderabad - Hitec City': { city: 'Hyderabad', lat: 17.4474, lng: 78.3762 },
  'Chennai - T Nagar': { city: 'Chennai', lat: 13.0418, lng: 80.2341 },
  'Pune - Kothrud': { city: 'Pune', lat: 18.5074, lng: 73.8077 },
};

/**
 * Resolves any location input (Google Plus Code, Google Maps URL, raw coordinates, or address)
 * to high-precision latitude and longitude.
 */
export async function resolveLocation(input: string): Promise<ResolvedLocation | null> {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Check for raw coordinates (e.g. "8.9852, 76.7681" or "8.9852 76.7681")
  const coordMatch = trimmed.match(/^([-+]?[0-9]*\.?[0-9]+)[\s,]+([-+]?[0-9]*\.?[0-9]+)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return {
        lat: parseFloat(lat.toFixed(4)),
        lng: parseFloat(lng.toFixed(4)),
        method: 'direct_coords',
      };
    }
  }

  // 2. Check for Google Maps URL with @lat,lng
  const urlCoordMatch = trimmed.match(/@([-+]?[0-9]*\.?[0-9]+),([-+]?[0-9]*\.?[0-9]+)/);
  if (urlCoordMatch) {
    const lat = parseFloat(urlCoordMatch[1]);
    const lng = parseFloat(urlCoordMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return {
        lat: parseFloat(lat.toFixed(4)),
        lng: parseFloat(lng.toFixed(4)),
        method: 'google_maps_url',
      };
    }
  }

  // 3. Check for Google Plus Code (Open Location Code)
  // e.g. "XQP9+36H, Kollam, Keralam 691531" or "6JWRXQP9+36H" or "XQP9+36H"
  const plusMatch = trimmed.match(/([23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,3})/i);
  if (plusMatch) {
    const code = plusMatch[1].toUpperCase();
    const locality = trimmed
      .replace(plusMatch[0], '')
      .replace(/^[,\s]+|[,\s]+$/g, '')
      .trim();

    // A. Full 10-11 character global Plus Code (e.g. "6JWRXQP9+36H")
    if (olc.isFull(code)) {
      const decoded = olc.decode(code);
      return {
        lat: parseFloat(decoded.latitudeCenter.toFixed(4)),
        lng: parseFloat(decoded.longitudeCenter.toFixed(4)),
        formattedAddress: trimmed,
        method: 'plus_code',
      };
    }

    // B. Short Plus Code with locality name (e.g. "XQP9+36H, Kollam, Keralam 691531")
    if (olc.isShort(code)) {
      let refLat: number | null = null;
      let refLng: number | null = null;
      let detectedCity = '';

      // Check presets first
      const lowerLocality = locality.toLowerCase();
      for (const [key, preset] of Object.entries(POPULAR_LOCALITIES)) {
        if (lowerLocality.includes(preset.city.toLowerCase()) || lowerLocality.includes(key.toLowerCase())) {
          refLat = preset.lat;
          refLng = preset.lng;
          detectedCity = preset.city;
          break;
        }
      }

      // If not in presets, query Nominatim for the locality center
      if (refLat === null && locality) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locality)}&limit=1`,
            { signal: controller.signal, headers: { Accept: 'application/json' } }
          );
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
              refLat = parseFloat(data[0].lat);
              refLng = parseFloat(data[0].lon);
            }
          }
        } catch {
          // ignore
        }
      }

      // If reference found, recover full code and decode with pinpoint precision
      if (refLat !== null && refLng !== null) {
        const fullCode = olc.recoverNearest(code, refLat, refLng);
        const decoded = olc.decode(fullCode);
        return {
          lat: parseFloat(decoded.latitudeCenter.toFixed(4)),
          lng: parseFloat(decoded.longitudeCenter.toFixed(4)),
          city: detectedCity || locality.split(',')[0].trim(),
          formattedAddress: trimmed,
          method: 'plus_code',
        };
      }
    }
  }

  // 4. Standard Address / PIN code query via Nominatim
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const query = /^[1-9][0-9]{5}$/.test(trimmed) ? `${trimmed}, India` : trimmed;
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      { signal: controller.signal, headers: { Accept: 'application/json', 'User-Agent': 'MediGrid/1.0' } }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(parseFloat(data[0].lat).toFixed(4));
        const lng = parseFloat(parseFloat(data[0].lon).toFixed(4));
        return {
          lat,
          lng,
          formattedAddress: data[0].display_name,
          method: 'nominatim_address',
        };
      }
    }
  } catch {
    // ignore
  }

  // 5. Fallback: match locality presets
  const lower = trimmed.toLowerCase();
  for (const [key, preset] of Object.entries(POPULAR_LOCALITIES)) {
    if (lower.includes(preset.city.toLowerCase()) || lower.includes(key.toLowerCase())) {
      return {
        lat: preset.lat,
        lng: preset.lng,
        city: preset.city,
        formattedAddress: key,
        method: 'preset_fallback',
      };
    }
  }

  return null;
}
