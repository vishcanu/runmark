export type PlaceType = 'park' | 'lake' | 'garden';

export interface Park {
  id: string;
  name: string;
  lat: number;
  lng: number;
  placeType: PlaceType;
  /** Distance from user in meters */
  distance: number;
  /** Estimated walk time in minutes (5 km/h) */
  walkMinutes: number;
  /** Whether the user already has a territory inside this park */
  isClaimed: boolean;
}
