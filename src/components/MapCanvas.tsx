import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { IsochroneComputationResult } from '../utils/mockIsochrones';

export interface MapCanvasProps {
  initialCenter?: [number, number];
  initialZoom?: number;
  styleUrl?: string;
  isochroneData?: IsochroneComputationResult | null;
  onMapReady?: (map: maplibregl.Map) => void;
  className?: string;
}

export type MapCanvasHandle = maplibregl.Map;

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(({
  initialCenter = [8.5417, 47.3769], // Zurich central hub default
  initialZoom = 13,
  styleUrl = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  isochroneData,
  onMapReady,
  className = '',
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Expose the underlying map instance to parent via ref
  useImperativeHandle(ref, () => mapInstanceRef.current as maplibregl.Map, []);

  const updateIsochroneLayers = (map: maplibregl.Map, data: IsochroneComputationResult | null | undefined) => {
    if (!map.isStyleLoaded()) {
      map.once('style.load', () => updateIsochroneLayers(map, data));
      return;
    }

    const emptyFc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
    const userGeoJson = data ? data.userIsochrones : emptyFc;
    const interGeoJson = data?.intersectionPolygon ? data.intersectionPolygon : emptyFc;

    // 1. User Isochrones Source & Layers
    const userSource = map.getSource('user-isochrones') as maplibregl.GeoJSONSource | undefined;
    if (userSource) {
      userSource.setData(userGeoJson);
    } else {
      map.addSource('user-isochrones', {
        type: 'geojson',
        data: userGeoJson,
      });

      // User simulated isochrone with distinct brand color at 0.15 opacity
      map.addLayer({
        id: 'user-isochrones-fill',
        type: 'fill',
        source: 'user-isochrones',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.15,
        },
      });

      map.addLayer({
        id: 'user-isochrones-line',
        type: 'line',
        source: 'user-isochrones',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
          'line-opacity': 0.7,
        },
      });
    }

    // 2. Intersection Area Source & Layers
    const intersectionSource = map.getSource('intersection-polygon') as maplibregl.GeoJSONSource | undefined;
    if (intersectionSource) {
      intersectionSource.setData(interGeoJson);
    } else {
      map.addSource('intersection-polygon', {
        type: 'geojson',
        data: interGeoJson,
      });

      // Intersection area in Amber (#F59E0B) with 0.4 fill opacity and solid border
      map.addLayer({
        id: 'intersection-fill',
        type: 'fill',
        source: 'intersection-polygon',
        paint: {
          'fill-color': '#F59E0B',
          'fill-opacity': 0.4,
        },
      });

      map.addLayer({
        id: 'intersection-line',
        type: 'line',
        source: 'intersection-polygon',
        paint: {
          'line-color': '#F59E0B',
          'line-width': 2.5,
          'line-opacity': 1.0,
        },
      });
    }

    // 3. Turf centroid markers for each user origin and the resulting FairPoint midpoint
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (data) {
      // User origin centroid markers
      data.userCentroids.forEach((uc) => {
        const el = document.createElement('div');
        el.className =
          'w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center cursor-pointer transition-transform hover:scale-125';
        el.style.backgroundColor = uc.color;
        el.innerHTML = `<span style="font-size: 9px; font-weight: 800; color: white;">U${uc.id}</span>`;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(uc.coords)
          .setPopup(
            new maplibregl.Popup({ offset: 20 }).setHTML(
              `<div style="font-family: sans-serif; padding: 4px;">
                <strong style="color: ${uc.color}; font-size: 13px;">${uc.name}</strong>
                <div style="font-size: 11px; color: #64748b;">Origin Centroid</div>
              </div>`
            )
          )
          .addTo(map);

        markersRef.current.push(marker);
      });

      // FairPoint midpoint marker
      if (data.fairpointCentroid) {
        const el = document.createElement('div');
        el.className =
          'w-8 h-8 rounded-full bg-intersection border-2 border-white shadow-2xl flex items-center justify-center animate-pulse cursor-pointer';
        el.innerHTML = `<span style="font-size: 10px; font-weight: 800; color: white;">FP</span>`;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(data.fairpointCentroid)
          .setPopup(
            new maplibregl.Popup({ offset: 25 }).setHTML(
              `<div style="font-family: sans-serif; padding: 6px;">
                <div style="font-size: 10px; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px;">Optimal Meeting Point</div>
                <strong style="color: #F59E0B; font-size: 14px;">FairPoint Midpoint</strong>
                <p style="margin: 4px 0 0; color: #475569; font-size: 11px;">Calculated intersection via @turf/intersect</p>
              </div>`
            )
          )
          .addTo(map);

        markersRef.current.push(marker);
      }
    }
  };

  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: false, // Clean vector basemap without default attribution clutter
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    map.on('load', () => {
      mapInstanceRef.current = map;
      setIsLoaded(true);
      if (isochroneData) {
        updateIsochroneLayers(map, isochroneData);
      }
      if (onMapReady) {
        onMapReady(map);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Sync isochrone data updates to MapLibre layers & markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map && isLoaded) {
      updateIsochroneLayers(map, isochroneData);
    }
  }, [isochroneData, isLoaded]);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <div
        ref={containerRef}
        className={`w-screen h-screen absolute inset-0 z-0 ${className}`}
      />
      {!isLoaded && (
        <div className="absolute inset-0 z-[1] bg-slate-100 flex items-center justify-center animate-fade pointer-events-none">
          <div className="flex items-center space-x-2 text-slate-500 text-sm font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            <span>Loading Basemap...</span>
          </div>
        </div>
      )}
    </div>
  );
});

MapCanvas.displayName = 'MapCanvas';

export default MapCanvas;
