import React, { useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import { 
  Sparkles, 
  CheckCircle2, 
  Navigation2,
  Maximize2,
  Crosshair,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { MapCanvas, MapCanvasHandle } from './components/MapCanvas';
import { OriginSearchPanel, Participant } from './components/OriginSearchPanel';
import { tokens, UserThemeId } from './tokens';

interface UserLocation {
  id: UserThemeId;
  name: string;
  label: string;
  color: string;
  coords: [number, number]; // [lng, lat]
}

const INITIAL_USER_LOCATIONS: Record<UserThemeId, UserLocation> = {
  1: { id: 1, name: 'Person 1', label: 'Cobalt Blue', color: tokens.colors.user1, coords: [8.532, 47.377] },
  2: { id: 2, name: 'Person 2', label: 'Rose Red', color: tokens.colors.user2, coords: [8.552, 47.388] },
  3: { id: 3, name: 'Person 3', label: 'Emerald Green', color: tokens.colors.user3, coords: [8.528, 47.362] },
  4: { id: 4, name: 'Person 4', label: 'Violet Purple', color: tokens.colors.user4, coords: [8.558, 47.365] },
};

export const App: React.FC = () => {
  const mapRef = useRef<MapCanvasHandle>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const intersectionMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [activeUser, setActiveUser] = useState<UserThemeId>(1);
  const [midpointCoords, setMidpointCoords] = useState<[number, number] | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showTokensPanel, setShowTokensPanel] = useState(false);

  // Updates markers on the map based on active participants
  const updateMapForParticipants = useCallback((participants: Participant[], map: maplibregl.Map) => {
    // Clear old user markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Filter locations for existing participants
    const activeLocations = participants.map((p) => INITIAL_USER_LOCATIONS[p.id]);
    const points = activeLocations.map((u) => turf.point(u.coords));
    const featureCollection = turf.featureCollection(points);
    const centerPoint = turf.center(featureCollection);
    const centerLngLat = centerPoint.geometry.coordinates as [number, number];
    setMidpointCoords(centerLngLat);

    // Update or create intersection marker
    if (intersectionMarkerRef.current) {
      intersectionMarkerRef.current.setLngLat(centerLngLat);
    } else {
      const intersectionEl = document.createElement('div');
      intersectionEl.className =
        'w-8 h-8 rounded-full bg-intersection border-2 border-white shadow-xl flex items-center justify-center animate-pulse cursor-pointer';
      intersectionEl.innerHTML = `<span style="font-size: 10px; font-weight: 800; color: white;">FP</span>`;

      const marker = new maplibregl.Marker({ element: intersectionEl })
        .setLngLat(centerLngLat)
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(
            `<div style="font-family: sans-serif; padding: 4px;">
              <strong style="color: #F59E0B; font-size: 13px;">FairPoint (Optimal Hub)</strong>
              <p style="margin: 4px 0 0; color: #475569; font-size: 11px;">Calculated intersection via Turf.js</p>
            </div>`
          )
        )
        .addTo(map);
      intersectionMarkerRef.current = marker;
    }

    // Add Markers for active participants
    activeLocations.forEach((user) => {
      const userEl = document.createElement('div');
      userEl.className =
        'w-6 h-6 rounded-full border-2 border-white shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-125';
      userEl.style.backgroundColor = user.color;
      userEl.innerHTML = `<span style="font-size: 9px; font-weight: 700; color: white;">${user.id}</span>`;

      const marker = new maplibregl.Marker({ element: userEl })
        .setLngLat(user.coords)
        .setPopup(
          new maplibregl.Popup({ offset: 20 }).setHTML(
            `<div style="font-family: sans-serif; padding: 4px;">
              <strong style="color: ${user.color}; font-size: 13px;">${user.name}</strong>
              <div style="font-size: 11px; color: #64748b;">${user.label}</div>
            </div>`
          )
        )
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Fit map bounds
    const bbox = turf.bbox(featureCollection);
    map.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      { padding: { top: 120, bottom: 120, left: 420, right: 100 }, maxZoom: 14 }
    );
  }, []);

  // Map ready callback
  const handleMapReady = useCallback(
    (map: maplibregl.Map) => {
      setMapReady(true);
      // Initialize with default 2 users
      const initialParticipants: Participant[] = [
        { id: 1, label: 'Person 1', address: '', mode: 'transit', color: tokens.colors.user1, colorName: 'Cobalt Blue' },
        { id: 2, label: 'Person 2', address: '', mode: 'transit', color: tokens.colors.user2, colorName: 'Rose Red' },
      ];
      updateMapForParticipants(initialParticipants, map);
    },
    [updateMapForParticipants]
  );

  // Handle 'Find FairPoint' from OriginSearchPanel
  const handleFindFairPoint = async (participants: Participant[]) => {
    const map = mapRef.current;
    if (!map) return;

    // Simulate route/centroid calculation
    await new Promise((resolve) => setTimeout(resolve, 600));
    updateMapForParticipants(participants, map);

    if (midpointCoords) {
      map.flyTo({
        center: midpointCoords,
        zoom: 13.5,
        essential: true,
      });
    }
  };

  const focusUser = (user: UserLocation) => {
    setActiveUser(user.id);
    const map = mapRef.current;
    if (map) {
      map.flyTo({
        center: user.coords,
        zoom: 14.5,
        essential: true,
      });
    }
  };

  const focusFairpoint = () => {
    const map = mapRef.current;
    if (map && midpointCoords) {
      map.flyTo({
        center: midpointCoords,
        zoom: 14,
        essential: true,
      });
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none">
      {/* Basemap Canvas in background */}
      <MapCanvas ref={mapRef} onMapReady={handleMapReady} />

      {/* Relative overlay container with pointer-events-none */}
      <div className="relative z-10 pointer-events-none w-full h-full min-h-screen flex flex-col justify-between p-4 md:p-6">
        {/* Top Bar with Brand & Floating Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Top Brand Pill */}
          <div className="bg-surface-card/90 backdrop-blur-md rounded-2xl border border-border-default/80 px-4 py-2.5 shadow-lg flex items-center space-x-3 pointer-events-auto">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center border border-amber-500/30 text-intersection">
              <Sparkles className="w-4 h-4 text-intersection" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-content-primary">
                  FairPoint
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                  Carto Positron
                </span>
              </div>
            </div>
          </div>

          {/* Right Status Badge */}
          <div className="hidden sm:flex items-center gap-2 pointer-events-auto">
            <div className="bg-surface-card/90 backdrop-blur-md rounded-xl border border-border-default/80 px-3 py-1.5 shadow-sm flex items-center gap-2 text-xs font-medium text-content-primary">
              <CheckCircle2 className="w-3.5 h-3.5 text-user-3" />
              <span>{mapReady ? 'Basemap Vector Active' : 'Connecting...'}</span>
            </div>
            <button
              onClick={() => setShowTokensPanel((v) => !v)}
              className="bg-surface-card/90 backdrop-blur-md rounded-xl border border-border-default/80 px-3 py-1.5 shadow-sm flex items-center gap-1.5 text-xs font-medium text-content-secondary hover:text-content-primary transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-user-1" />
              <span>Tokens</span>
              {showTokensPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Floating Top-Left Area: Origin Search Panel */}
        <div className="flex flex-col md:flex-row gap-4 items-start my-auto">
          {/* Main Origin Search Panel (Floating in top-left) */}
          <OriginSearchPanel onFindFairPoint={handleFindFairPoint} />

          {/* Optional Collapsible Token Palette Drawer */}
          {showTokensPanel && (
            <aside className="pointer-events-auto w-80 bg-surface-card/95 backdrop-blur-md rounded-2xl border border-border-default/80 p-4 shadow-xl space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b border-border-default pb-2">
                <h3 className="text-xs font-semibold text-content-primary flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-user-1" /> Core Tokens Quick Focus
                </h3>
                <span className="text-[10px] font-mono text-content-secondary">
                  5 Colors
                </span>
              </div>

              <div className="space-y-1.5">
                {Object.values(INITIAL_USER_LOCATIONS).map((user) => {
                  const isSelected = activeUser === user.id;
                  return (
                    <button
                      key={user.id}
                      onClick={() => focusUser(user)}
                      className={`w-full p-2 rounded-xl border text-left transition-all flex items-center justify-between text-xs ${
                        isSelected
                          ? 'border-transparent ring-2 ring-offset-1'
                          : 'border-border-default hover:bg-slate-50'
                      }`}
                      style={{
                        borderColor: isSelected ? user.color : undefined,
                        backgroundColor: isSelected ? `${user.color}0D` : undefined,
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-xs"
                          style={{ backgroundColor: user.color }}
                        />
                        <span className="font-medium text-slate-800">{user.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{user.color}</span>
                      </div>
                    </button>
                  );
                })}

                <button
                  onClick={focusFairpoint}
                  className="w-full p-2 rounded-xl border border-amber-300 bg-amber-50/60 hover:bg-amber-100/70 text-left transition-all flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-intersection ring-2 ring-white shadow-xs" />
                    <span className="font-bold text-amber-900">FairPoint Hub</span>
                    <span className="text-[10px] text-amber-700 font-mono">#F59E0B</span>
                  </div>
                  <Crosshair className="w-3.5 h-3.5 text-amber-600" />
                </button>
              </div>
            </aside>
          )}
        </div>

        {/* Bottom Floating Footer / Controls Bar */}
        <footer className="pointer-events-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="bg-surface-card/90 backdrop-blur-md rounded-2xl border border-border-default/80 px-4 py-2.5 shadow-lg flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-intersection animate-ping" />
              <span className="font-semibold text-content-primary">FairPoint Midpoint:</span>
            </div>
            <span className="font-mono text-content-secondary bg-slate-100 px-2 py-0.5 rounded">
              {midpointCoords
                ? `${midpointCoords[0].toFixed(4)}°E, ${midpointCoords[1].toFixed(4)}°N`
                : 'Computing with Turf.js...'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={focusFairpoint}
              className="bg-intersection hover:bg-amber-600 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 active:scale-95"
            >
              <Navigation2 className="w-3.5 h-3.5" /> Center on FairPoint
            </button>
            <button
              onClick={() => {
                const map = mapRef.current;
                if (map) {
                  const points = Object.values(INITIAL_USER_LOCATIONS).map((u) => turf.point(u.coords));
                  const bbox = turf.bbox(turf.featureCollection(points));
                  map.fitBounds(
                    [
                      [bbox[0], bbox[1]],
                      [bbox[2], bbox[3]],
                    ],
                    { padding: { top: 120, bottom: 120, left: 420, right: 100 }, maxZoom: 14 }
                  );
                }
              }}
              className="bg-surface-card/90 hover:bg-white text-content-primary border border-border-default/80 font-medium text-xs px-3.5 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Maximize2 className="w-3.5 h-3.5 text-content-secondary" /> Fit All
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
