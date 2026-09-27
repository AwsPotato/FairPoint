import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';

export interface MapCanvasProps {
  initialCenter?: [number, number];
  initialZoom?: number;
  styleUrl?: string;
  onMapReady?: (map: maplibregl.Map) => void;
  className?: string;
}

export type MapCanvasHandle = maplibregl.Map;

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(({
  initialCenter = [8.5417, 47.3769], // Zurich central hub default
  initialZoom = 13,
  styleUrl = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  onMapReady,
  className = '',
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Expose the underlying map instance to parent via ref
  useImperativeHandle(ref, () => mapInstanceRef.current as maplibregl.Map, []);

  useEffect(() => {
    if (!containerRef.current || mapInstanceRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: false, // Clean vector basemap without default attribution clutter
    });

    // Optional navigation control (top-right, sleek)
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');

    map.on('load', () => {
      mapInstanceRef.current = map;
      setIsLoaded(true);
      if (onMapReady) {
        onMapReady(map);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

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
