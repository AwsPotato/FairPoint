import React, { useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import { 
  Sparkles, 
  CheckCircle2, 
  Navigation2,
  Maximize2,
  Crosshair,
  Layers,
  ChevronDown,
  ChevronUp,
  MapPin
} from 'lucide-react';
import { MapCanvas, MapCanvasHandle } from './components/MapCanvas';
import { OriginSearchPanel, Participant } from './components/OriginSearchPanel';
import { 
  generateMockIsochrones, 
  IsochroneComputationResult, 
  UserOriginInput 
} from './utils/mockIsochrones';
import { tokens, UserThemeId } from './tokens';

interface UserLocationDef {
  id: UserThemeId;
  name: string;
  label: string;
  color: string;
  coords: [number, number]; // [lng, lat]
}

const DEFAULT_USER_COORDS: Record<UserThemeId, UserLocationDef> = {
  1: { id: 1, name: 'Person 1', label: 'Cobalt Blue', color: tokens.colors.user1, coords: [8.532, 47.377] },
  2: { id: 2, name: 'Person 2', label: 'Rose Red', color: tokens.colors.user2, coords: [8.552, 47.388] },
  3: { id: 3, name: 'Person 3', label: 'Emerald Green', color: tokens.colors.user3, coords: [8.528, 47.362] },
  4: { id: 4, name: 'Person 4', label: 'Violet Purple', color: tokens.colors.user4, coords: [8.558, 47.365] },
};

export const App: React.FC = () => {
  const mapRef = useRef<MapCanvasHandle>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isochroneData, setIsochroneData] = useState<IsochroneComputationResult | null>(null);
  const [activeUser, setActiveUser] = useState<UserThemeId>(1);
  const [showTokensPanel, setShowTokensPanel] = useState(false);

  // Helper to run mock isochrone calculation from participants
  const runCalculation = useCallback((participants: Participant[]) => {
    const inputs: UserOriginInput[] = participants.map((p) => {
      const def = DEFAULT_USER_COORDS[p.id];
      return {
        id: p.id,
        coords: def.coords,
        color: p.color,
        name: p.label,
        mode: p.mode,
      };
    });

    const result = generateMockIsochrones(inputs);
    setIsochroneData(result);
    return result;
  }, []);

  // Map ready callback
  const handleMapReady = useCallback((map: maplibregl.Map) => {
    setMapReady(true);

    // Initial calculation for 2 participants
    const initialParticipants: Participant[] = [
      { id: 1, label: 'Person 1', address: 'Bahnhofstrasse 1, Zurich', mode: 'transit', color: tokens.colors.user1, colorName: 'Cobalt Blue' },
      { id: 2, label: 'Person 2', address: 'Universitatstrasse, Zurich', mode: 'transit', color: tokens.colors.user2, colorName: 'Rose Red' },
    ];

    const result = runCalculation(initialParticipants);

    // Fit initial bounding box with padding for floating panels
    map.fitBounds(
      [
        [result.bbox[0], result.bbox[1]],
        [result.bbox[2], result.bbox[3]],
      ],
      {
        padding: { top: 100, bottom: 100, left: 430, right: 100 },
        duration: 1200,
        maxZoom: 14,
      }
    );
  }, [runCalculation]);

  // Wire 'Find FairPoint' button in OriginSearchPanel to trigger calculation
  const handleFindFairPoint = async (participants: Participant[]) => {
    const map = mapRef.current;
    
    // Simulate brief algorithmic computation
    await new Promise((resolve) => setTimeout(resolve, 600));

    const result = runCalculation(participants);

    if (map) {
      if (result.fairpointCentroid) {
        map.flyTo({
          center: result.fairpointCentroid,
          zoom: 13.5,
          essential: true,
          duration: 1400,
        });
      } else {
        map.fitBounds(
          [
            [result.bbox[0], result.bbox[1]],
            [result.bbox[2], result.bbox[3]],
          ],
          {
            padding: { top: 100, bottom: 100, left: 430, right: 100 },
            duration: 1200,
          }
        );
      }
    }
  };

  const focusUser = (userId: UserThemeId) => {
    setActiveUser(userId);
    const map = mapRef.current;
    const target = isochroneData?.userCentroids.find((u) => u.id === userId);
    if (map && target) {
      map.flyTo({
        center: target.coords,
        zoom: 14.5,
        essential: true,
      });
    }
  };

  const focusFairpoint = () => {
    const map = mapRef.current;
    if (map && isochroneData?.fairpointCentroid) {
      map.flyTo({
        center: isochroneData.fairpointCentroid,
        zoom: 14,
        essential: true,
      });
    }
  };

  const fitAll = () => {
    const map = mapRef.current;
    if (map && isochroneData) {
      map.fitBounds(
        [
          [isochroneData.bbox[0], isochroneData.bbox[1]],
          [isochroneData.bbox[2], isochroneData.bbox[3]],
        ],
        {
          padding: { top: 100, bottom: 100, left: 430, right: 100 },
          duration: 1000,
        }
      );
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none">
      {/* Basemap Canvas in background with GeoJSON layers & markers */}
      <MapCanvas
        ref={mapRef}
        isochroneData={isochroneData}
        onMapReady={handleMapReady}
      />

      {/* Relative overlay container with pointer-events-none */}
      <div className="relative z-10 pointer-events-none w-full h-full min-h-screen flex flex-col justify-between p-4 md:p-6">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Brand Pill */}
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
                  Isochrone Intersect
                </span>
              </div>
            </div>
          </div>

          {/* Right Status Badges & Quick Action */}
          <div className="hidden sm:flex items-center gap-2 pointer-events-auto">
            <div className="bg-surface-card/90 backdrop-blur-md rounded-xl border border-border-default/80 px-3 py-1.5 shadow-sm flex items-center gap-2 text-xs font-medium text-content-primary">
              <CheckCircle2 className="w-3.5 h-3.5 text-user-3" />
              <span>{mapReady ? 'Isochrone Engine Active' : 'Loading Map...'}</span>
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

        {/* Floating Top-Left Area: OriginSearchPanel */}
        <div className="flex flex-col md:flex-row gap-4 items-start my-auto">
          {/* Main Origin Search Panel (Floating in top-left) */}
          <OriginSearchPanel onFindFairPoint={handleFindFairPoint} />

          {/* Optional Tokens Drawer */}
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
                {Object.values(DEFAULT_USER_COORDS).map((user) => {
                  const isSelected = activeUser === user.id;
                  const isPresent = isochroneData?.userCentroids.some((u) => u.id === user.id);

                  return (
                    <button
                      key={user.id}
                      onClick={() => focusUser(user.id)}
                      disabled={!isPresent}
                      className={`w-full p-2 rounded-xl border text-left transition-all flex items-center justify-between text-xs ${
                        isSelected
                          ? 'border-transparent ring-2 ring-offset-1'
                          : 'border-border-default hover:bg-slate-50'
                      } ${!isPresent ? 'opacity-40 cursor-not-allowed' : ''}`}
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
                      {isPresent && (
                        <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                          Active
                        </span>
                      )}
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
              <span className="w-2.5 h-2.5 rounded-full bg-intersection animate-ping" />
              <span className="font-semibold text-content-primary">FairPoint Midpoint:</span>
            </div>
            <span className="font-mono text-content-secondary bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
              <MapPin className="w-3 h-3 text-intersection" />
              {isochroneData?.fairpointCentroid
                ? `${isochroneData.fairpointCentroid[0].toFixed(4)}°E, ${isochroneData.fairpointCentroid[1].toFixed(4)}°N`
                : 'Computing intersection...'}
            </span>
            {isochroneData?.intersectionPolygon && (
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                Overlap Area Identified
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={focusFairpoint}
              className="bg-intersection hover:bg-amber-600 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 active:scale-95"
            >
              <Navigation2 className="w-3.5 h-3.5" /> Center on FairPoint
            </button>
            <button
              onClick={fitAll}
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
