import React, { useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import { 
  Sparkles, 
  CheckCircle2, 
  Navigation2, 
  Maximize2, 
  MapPin, 
  Crosshair,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { MapCanvas, MapCanvasHandle } from './components/MapCanvas';
import { OriginSearchPanel, Participant } from './components/OriginSearchPanel';
import { 
  generateMockIsochrones, 
  IsochroneComputationResult, 
  UserOriginInput 
} from './utils/mockIsochrones';
import { tokens } from './tokens';

export const App: React.FC = () => {
  const mapRef = useRef<MapCanvasHandle>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isochroneData, setIsochroneData] = useState<IsochroneComputationResult | null>(null);
  const [activeUserId, setActiveUserId] = useState<1 | 2 | 3 | 4>(1);
  const [showTokensPanel, setShowTokensPanel] = useState(false);

  // Initialize with 2 participants
  const [participants, setParticipants] = useState<Participant[]>([
    {
      id: 1,
      label: 'Person 1',
      address: 'Bahnhofstrasse 1, Zurich',
      coords: [8.5385, 47.3769],
      mode: 'transit',
      color: tokens.colors.user1,
      colorName: 'Cobalt Blue',
    },
    {
      id: 2,
      label: 'Person 2',
      address: 'Universitatstrasse, Zurich',
      coords: [8.5520, 47.3880],
      mode: 'transit',
      color: tokens.colors.user2,
      colorName: 'Rose Red',
    },
  ]);

  // Compute Turf.js isochrones from participants
  const runCalculation = useCallback((currentParticipants: Participant[]) => {
    const inputs: UserOriginInput[] = currentParticipants.map((p) => ({
      id: p.id,
      coords: p.coords,
      color: p.color,
      name: p.label,
      mode: p.mode,
    }));

    const result = generateMockIsochrones(inputs);
    setIsochroneData(result);
    return result;
  }, []);

  // Map ready callback
  const handleMapReady = useCallback((map: maplibregl.Map) => {
    setMapReady(true);
    const result = runCalculation(participants);

    // Initial camera fit
    map.fitBounds(
      [
        [result.bbox[0], result.bbox[1]],
        [result.bbox[2], result.bbox[3]],
      ],
      {
        padding: { top: 80, bottom: 80, left: 440, right: 80 },
        duration: 1200,
        maxZoom: 14,
      }
    );
  }, [participants, runCalculation]);

  // Handle marker dragend: update participant's coords and automatically re-run Turf intersection
  const handleMarkerDragEnd = useCallback((userId: 1 | 2 | 3 | 4, newCoords: [number, number]) => {
    setParticipants((prev) => {
      const updated = prev.map((p) =>
        p.id === userId
          ? {
              ...p,
              coords: newCoords,
              address: `Pinned Location (${newCoords[0].toFixed(3)}, ${newCoords[1].toFixed(3)})`,
            }
          : p
      );
      runCalculation(updated);
      return updated;
    });
  }, [runCalculation]);

  // Handle map click: move active participant's pin to the clicked spot & re-run intersection
  const handleMapClick = useCallback((newCoords: [number, number]) => {
    setParticipants((prev) => {
      const updated = prev.map((p) =>
        p.id === activeUserId
          ? {
              ...p,
              coords: newCoords,
              address: `Location (${newCoords[0].toFixed(3)}, ${newCoords[1].toFixed(3)})`,
            }
          : p
      );
      runCalculation(updated);
      return updated;
    });
  }, [activeUserId, runCalculation]);

  // Handle selecting address from Geocoding dropdown: fly to location & re-run intersection
  const handleLocationSelect = useCallback(
    (userId: 1 | 2 | 3 | 4, addressText: string, coords: [number, number]) => {
      setParticipants((prev) => {
        const updated = prev.map((p) =>
          p.id === userId ? { ...p, address: addressText, coords } : p
        );
        runCalculation(updated);
        return updated;
      });

      const map = mapRef.current;
      if (map) {
        map.flyTo({
          center: coords,
          zoom: 14.5,
          essential: true,
          duration: 1000,
        });
      }
    },
    [runCalculation]
  );

  // 'Find FairPoint' button action
  const handleFindFairPoint = async () => {
    const map = mapRef.current;
    await new Promise((resolve) => setTimeout(resolve, 500));
    const result = runCalculation(participants);

    if (map) {
      if (result.fairpointCentroid) {
        map.flyTo({
          center: result.fairpointCentroid,
          zoom: 13.8,
          essential: true,
          duration: 1200,
        });
      } else {
        map.fitBounds(
          [
            [result.bbox[0], result.bbox[1]],
            [result.bbox[2], result.bbox[3]],
          ],
          {
            padding: { top: 80, bottom: 80, left: 440, right: 80 },
            duration: 1000,
          }
        );
      }
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
          padding: { top: 80, bottom: 80, left: 440, right: 80 },
          duration: 1000,
        }
      );
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none">
      {/* 1. MapCanvas wrapped inside a background container (fixed inset-0 z-0) */}
      <div className="fixed inset-0 z-0">
        <MapCanvas
          ref={mapRef}
          isochroneData={isochroneData}
          activeUserId={activeUserId}
          onUserMarkerDragEnd={handleMarkerDragEnd}
          onMapClick={handleMapClick}
          onMapReady={handleMapReady}
        />
      </div>

      {/* 2. Dedicated UI overlay layer (relative z-50 pointer-events-none min-h-screen flex flex-col justify-between p-4) */}
      <div className="relative z-50 pointer-events-none min-h-screen flex flex-col justify-between p-4">
        {/* Top-Left Section: Sleek Branding Header + OriginSearchPanel */}
        <div className="flex flex-col gap-3 items-start max-w-sm pointer-events-auto">
          {/* Sleek branding header: FairPoint with badge 'Multimodal Isochrone Finder' */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 px-4 py-3 shadow-lg flex items-center justify-between w-96 transition-all">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center border border-amber-500/30 text-intersection flex-shrink-0">
                <Sparkles className="w-5 h-5 text-intersection" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold tracking-tight text-slate-900">
                    FairPoint
                  </h1>
                  <span className="text-[10px] font-semibold tracking-wide bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-200/80">
                    Multimodal Isochrone Finder
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Drag pins or click map to move origins
                </p>
              </div>
            </div>

            {/* Quick Status Pill */}
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">Live</span>
            </div>
          </div>

          {/* OriginSearchPanel with pointer-events-auto */}
          <OriginSearchPanel
            participants={participants}
            activeUserId={activeUserId}
            onActiveUserChange={setActiveUserId}
            onParticipantsChange={(updated) => {
              setParticipants(updated);
              runCalculation(updated);
            }}
            onLocationSelect={handleLocationSelect}
            onFindFairPoint={handleFindFairPoint}
          />
        </div>

        {/* Top-Right Secondary Controls & Tokens Toggle */}
        <div className="absolute top-4 right-4 flex items-center gap-2 pointer-events-auto">
          <div className="bg-white/95 backdrop-blur-md rounded-xl border border-slate-200/90 px-3 py-1.5 shadow-md flex items-center gap-2 text-xs font-medium text-slate-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{mapReady ? 'Interactive Map Active' : 'Connecting Basemap...'}</span>
          </div>
          <button
            onClick={() => setShowTokensPanel((v) => !v)}
            className="bg-white/95 backdrop-blur-md rounded-xl border border-slate-200/90 px-3 py-1.5 shadow-md flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>Tokens</span>
            {showTokensPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Collapsible Tokens Palette (Top Right Drawer) */}
        {showTokensPanel && (
          <aside className="absolute top-16 right-4 pointer-events-auto w-72 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 p-3.5 shadow-2xl space-y-2.5 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" /> Active Participants
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">
                {participants.length} Active
              </span>
            </div>

            <div className="space-y-1">
              {participants.map((p) => {
                const isSelected = activeUserId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActiveUserId(p.id);
                      const map = mapRef.current;
                      if (map) {
                        map.flyTo({ center: p.coords, zoom: 14.5, essential: true });
                      }
                    }}
                    className={`w-full p-2 rounded-xl border text-left transition-all flex items-center justify-between text-xs ${
                      isSelected
                        ? 'border-slate-800 bg-slate-50 ring-2 ring-slate-800/10'
                        : 'border-slate-200/70 hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-xs"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="font-semibold text-slate-800">{p.label}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{p.color}</span>
                    </div>
                    {isSelected && (
                      <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        Selected
                      </span>
                    )}
                  </button>
                );
              })}

              <button
                onClick={focusFairpoint}
                className="w-full p-2 rounded-xl border border-amber-300 bg-amber-50/70 hover:bg-amber-100/70 text-left transition-all flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-intersection ring-2 ring-white shadow-xs" />
                  <span className="font-bold text-amber-950">FairPoint Intersection</span>
                </div>
                <Crosshair className="w-3.5 h-3.5 text-amber-600" />
              </button>
            </div>
          </aside>
        )}

        {/* Bottom Floating Bar / Controls */}
        <footer className="pointer-events-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 px-4 py-2.5 shadow-lg flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-intersection animate-ping" />
              <span className="font-semibold text-slate-800">FairPoint Midpoint:</span>
            </div>
            <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
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
              className="bg-intersection hover:bg-amber-600 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-amber-500/25 transition-all flex items-center gap-2 active:scale-95"
            >
              <Navigation2 className="w-3.5 h-3.5" /> Center on FairPoint
            </button>
            <button
              onClick={fitAll}
              className="bg-white/95 hover:bg-white text-slate-700 border border-slate-200/90 font-medium text-xs px-3.5 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Maximize2 className="w-3.5 h-3.5 text-slate-500" /> Fit All
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
