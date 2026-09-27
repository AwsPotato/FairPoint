import * as turf from '@turf/turf';

export type TravelMode = 'transit' | 'driving' | 'walking';

export interface UserOriginInput {
  id: 1 | 2 | 3 | 4;
  coords: [number, number]; // [lng, lat]
  color: string;
  name?: string;
  mode?: TravelMode;
}

export interface IsochroneFeatureProperties {
  id: number;
  color: string;
  name?: string;
  mode?: string;
  type: 'user-isochrone' | 'intersection';
}

export interface IsochroneComputationResult {
  // Collection of individual isochrone polygons for each user
  userIsochrones: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
  // Overlapping intersection polygon where all participants can reach
  intersectionPolygon: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null;
  // Turf centroid coordinates for the FairPoint intersection
  fairpointCentroid: [number, number] | null;
  // Centroid/origin coordinates for each participant
  userCentroids: {
    id: number;
    name: string;
    coords: [number, number];
    color: string;
  }[];
  // Bounding box [minX, minY, maxX, maxY] encompassing all polygons
  bbox: [number, number, number, number];
}

const DEFAULT_MODE_RADII_KM: Record<TravelMode, number> = {
  walking: 1.8,
  transit: 3.5,
  driving: 4.8,
};

/**
 * Generates simulated travel polygons for 2 to 4 participants and computes their
 * common intersection area using @turf/circle and @turf/intersect.
 */
export function generateMockIsochrones(
  participants: UserOriginInput[]
): IsochroneComputationResult {
  if (!participants || participants.length < 2) {
    throw new Error('At least 2 participants are required to compute isochrones.');
  }

  // Calculate maximum pairwise distance between any two participants to calibrate radius
  let maxDistanceKm = 0;
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const dist = turf.distance(
        turf.point(participants[i].coords),
        turf.point(participants[j].coords),
        { units: 'kilometers' }
      );
      if (dist > maxDistanceKm) {
        maxDistanceKm = dist;
      }
    }
  }

  // Generate each user's polygon using @turf/circle
  const userPolygons: GeoJSON.Feature<GeoJSON.Polygon>[] = participants.map((p) => {
    const baseRadius = DEFAULT_MODE_RADII_KM[p.mode || 'transit'] || 3.5;
    // Ensure the radius is sufficient to overlap based on participant separation
    const minOverlapRadius = maxDistanceKm > 0 ? (maxDistanceKm * 0.65) : 3.0;
    const finalRadius = Math.max(baseRadius, minOverlapRadius);

    const circle = turf.circle(p.coords, finalRadius, {
      steps: 64,
      units: 'kilometers',
      properties: {
        id: p.id,
        name: p.name || `Person ${p.id}`,
        color: p.color,
        mode: p.mode || 'transit',
        type: 'user-isochrone',
      } as IsochroneFeatureProperties,
    });

    return circle;
  });

  const userIsochrones = turf.featureCollection(userPolygons);

  // Compute common intersection where ALL participants can reach
  let intersectionPolygon: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | null = null;
  try {
    const inter = turf.intersect(userIsochrones);
    if (inter && (inter.geometry.type === 'Polygon' || inter.geometry.type === 'MultiPolygon')) {
      intersectionPolygon = {
        type: 'Feature',
        properties: {
          id: 0,
          name: 'FairPoint Hub',
          color: '#F59E0B',
          type: 'intersection',
        },
        geometry: inter.geometry,
      };
    }
  } catch (err) {
    console.warn('Could not compute strict intersection, falling back to pairwise approximation:', err);
  }

  // If intersectionPolygon is null (e.g. geometries barely disjoint), fallback to centroid of points
  let fairpointCentroid: [number, number] | null = null;
  if (intersectionPolygon) {
    const centroidFeature = turf.centroid(intersectionPolygon);
    fairpointCentroid = centroidFeature.geometry.coordinates as [number, number];
  } else {
    // Fallback midpoint of all participants
    const points = turf.featureCollection(participants.map((p) => turf.point(p.coords)));
    const centerPoint = turf.center(points);
    fairpointCentroid = centerPoint.geometry.coordinates as [number, number];
  }

  // Calculate centroids for each user origin
  const userCentroids = participants.map((p) => {
    const pt = turf.centroid(turf.point(p.coords));
    return {
      id: p.id,
      name: p.name || `Person ${p.id}`,
      coords: pt.geometry.coordinates as [number, number],
      color: p.color,
    };
  });

  // Calculate overall bounding box for camera fit
  const overallBbox = turf.bbox(userIsochrones) as [number, number, number, number];

  return {
    userIsochrones,
    intersectionPolygon,
    fairpointCentroid,
    userCentroids,
    bbox: overallBbox,
  };
}
