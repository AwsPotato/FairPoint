import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { IsochroneComputationResult } from '../utils/mockIsochrones';

export interface MapCanvasProps {
  initialCenter?: [number, number];
  initialZoom?: number;
  styleUrl?: string;
  isochroneData?: IsochroneComputationResult | null;
  venues?: any[]; // using any temporarily, or we can import Venue
  activeVenueId?: string | null;
  activeUserId?: 1 | 2 | 3 | 4;
  onUserMarkerDragEnd?: (userId: 1 | 2 | 3 | 4, coords: [number, number]) => void;
  onMapClick?: (coords: [number, number]) => void;
  onVenueClick?: (venueId: string) => void;
  onMapReady?: (map: maplibregl.Map) => void;
  className?: string;
}

export type MapCanvasHandle = maplibregl.Map;

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(({
  initialCenter = [8.5417, 47.3769], // Zurich central hub default
  initialZoom = 13,
  styleUrl = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  isochroneData,
  venues = [],
  activeVenueId = null,
  activeUserId = 1,
  onUserMarkerDragEnd,
  onMapClick,
  onVenueClick,
  onMapReady,
  className = '',
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Keep callback refs fresh to avoid stale closures in event listeners
  const onUserMarkerDragEndRef = useRef(onUserMarkerDragEnd);
  onUserMarkerDragEndRef.current = onUserMarkerDragEnd;

  const onVenueClickRef = useRef(onVenueClick);
  onVenueClickRef.current = onVenueClick;

  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  // Expose the underlying map instance to parent via ref
  useImperativeHandle(ref, () => mapInstanceRef.current as maplibregl.Map, []);

  const updateIsochroneLayers = (
    map: maplibregl.Map,
    data: IsochroneComputationResult | null | undefined,
    currentActiveId: 1 | 2 | 3 | 4,
    currentVenues: any[],
    currentActiveVenueId: string | null
  ) => {
    if (!map.isStyleLoaded()) {
      map.once('style.load', () => updateIsochroneLayers(map, data, currentActiveId, currentVenues, currentActiveVenueId));
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

    // 3. Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Render venues (capped top recommendations)
    currentVenues.slice(0, 30).forEach((v) => {
      const isSelected = v.id === currentActiveVenueId;
      const el = document.createElement('div');
      
      const icon = v.type === 'cafe' ? '☕' : v.type === 'bar' ? '🍸' : '🍽️';
      const bgColor = v.type === 'cafe' ? 'bg-amber-600' : v.type === 'bar' ? 'bg-purple-600' : 'bg-rose-600';

      el.className = `w-7 h-7 rounded-full border-2 border-white shadow-xl flex items-center justify-center transition-all cursor-pointer select-none ${
        isSelected 
          ? 'ring-4 ring-offset-1 ring-indigo-500 scale-125 z-50 ' + bgColor 
          : 'hover:scale-115 opacity-90 hover:opacity-100 ' + bgColor
      }`;
      el.innerHTML = `<span style="font-size: 11px; line-height: 1;">${icon}</span>`;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(v.coords)
        .addTo(map);
      
      const realPhotoBadge = v.isRealPhoto 
        ? `<span style="font-size: 8px; font-weight: 800; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 2px 5px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;">📸 Real Photo</span>`
        : '';

      const popupHtml = `
        <div style="font-family: system-ui, -apple-system, sans-serif; width: 220px; overflow: hidden; border-radius: 12px; background: white;">
          ${v.imageUrl ? `
            <div style="position: relative; width: 100%; height: 105px; background-image: url('${v.imageUrl}'); background-size: cover; background-position: center; border-radius: 12px 12px 0 0;">
              ${v.isRealPhoto ? `<div style="position: absolute; bottom: 6px; left: 6px;">${realPhotoBadge}</div>` : ''}
            </div>` : ''}
          <div style="padding: 10px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; background: #e0e7ff; color: #4338ca; padding: 2px 6px; border-radius: 6px;">${v.type}</span>
              <span style="font-size: 11px; font-weight: 800; color: #059669;">${v.matchScore}% Match</span>
            </div>
            <strong style="color: #0f172a; font-size: 13px; display: block; line-height: 1.25; margin-bottom: 4px;">${v.name}</strong>
            <div style="font-size: 11px; color: #475569; display: flex; gap: 8px; margin-bottom: 6px;">
              <span>P1: <b>${v.timeA} min</b></span>
              <span>P2: <b>${v.timeB} min</b></span>
            </div>
            <div style="font-size: 10px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 8px;">
              ${v.address}
            </div>
            ${v.googleMapsUrl ? `
              <a href="${v.googleMapsUrl}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; gap: 4px; width: 100%; padding: 5px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 10px; font-weight: 700; color: #334155; text-decoration: none; cursor: pointer;">
                🗺️ View on Google Maps
              </a>
            ` : ''}
          </div>
        </div>
      `;

      const popup = new maplibregl.Popup({ 
        offset: 18, 
        closeButton: true,
        maxWidth: '240px',
        className: 'fairpoint-popup'
      }).setHTML(popupHtml);

      marker.setPopup(popup);

      if (isSelected) {
        marker.togglePopup();
      }

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onVenueClickRef.current) {
          onVenueClickRef.current(v.id);
        }
      });

      markersRef.current.push(marker);
    });

    if (data) {
      // User origin centroid markers (DRAGGABLE)
      data.userCentroids.forEach((uc) => {
        const isSelected = uc.id === currentActiveId;

        const el = document.createElement('div');
        el.className = `group relative cursor-grab active:cursor-grabbing transition-transform select-none`;
        el.innerHTML = `
          <div class="w-7 h-7 rounded-full border-2 border-white shadow-xl flex items-center justify-center transition-all ${
            isSelected ? 'ring-4 ring-offset-1 ring-slate-900 scale-110' : 'hover:scale-110'
          }" style="background-color: ${uc.color}">
            <span style="font-size: 10px; font-weight: 800; color: white;">U${uc.id}</span>
          </div>
          <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded shadow pointer-events-none whitespace-nowrap">
            Drag to move
          </div>
        `;

        // Instantiate with draggable: true
        const marker = new maplibregl.Marker({
          element: el,
          draggable: true,
        })
          .setLngLat(uc.coords)
          .setPopup(
            new maplibregl.Popup({ offset: 20 }).setHTML(
              `<div style="font-family: sans-serif; padding: 4px;">
                <strong style="color: ${uc.color}; font-size: 13px;">${uc.name}</strong>
                <div style="font-size: 11px; color: #64748b;">Draggable Origin Pin</div>
              </div>`
            )
          )
          .addTo(map);

        // Listen to marker dragend to update coordinates and re-run calculations
        marker.on('dragend', () => {
          const lngLat = marker.getLngLat();
          if (onUserMarkerDragEndRef.current) {
            onUserMarkerDragEndRef.current(uc.id as 1 | 2 | 3 | 4, [lngLat.lng, lngLat.lat]);
          }
        });

        markersRef.current.push(marker);
      });

      // FairPoint midpoint marker
      if (data.fairpointCentroid) {
        const el = document.createElement('div');
        el.className =
          'w-9 h-9 rounded-full bg-intersection border-2 border-white shadow-2xl flex items-center justify-center animate-pulse cursor-pointer';
        el.innerHTML = `<span style="font-size: 11px; font-weight: 800; color: white;">FP</span>`;

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

    // Add map click listener: clicking the map should move the currently active participant's pin
    map.on('click', (e) => {
      // Trigger callback with clicked coordinates
      if (onMapClickRef.current) {
        onMapClickRef.current([e.lngLat.lng, e.lngLat.lat]);
      }
    });

    map.on('load', () => {
      mapInstanceRef.current = map;
      setIsLoaded(true);
      if (isochroneData) {
        updateIsochroneLayers(map, isochroneData, activeUserId, venues, activeVenueId);
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

  // Sync isochrone data updates and active user changes to MapLibre layers & markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map && isLoaded) {
      updateIsochroneLayers(map, isochroneData, activeUserId, venues, activeVenueId);
    }
  }, [isochroneData, activeUserId, isLoaded, venues, activeVenueId]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div
        ref={containerRef}
        className={`w-full h-full absolute inset-0 z-0 ${className}`}
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
