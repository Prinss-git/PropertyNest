// Shared by the form (browser) and server, so no Node-only imports here.
export const PH_BOUNDS = { minLat: 4.2, maxLat: 21.3, minLng: 116.0, maxLng: 127.2 };

export function inPhilippinesBox(lat: number, lng: number) {
  return lat >= PH_BOUNDS.minLat && lat <= PH_BOUNDS.maxLat && lng >= PH_BOUNDS.minLng && lng <= PH_BOUNDS.maxLng;
}
