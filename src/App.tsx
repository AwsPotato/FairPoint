import React, { useRef, useState, useCallback, useEffect } from 'react';
import * as maplibregl from 'maplibre-gl';
import { 
  Sparkles, 
  Maximize2, 
  MapPin, 
  Store,
  Compass,
  ExternalLink,
  Navigation
} from 'lucide-react';
import { MapCanvas, MapCanvasHandle } from './components/MapCanvas';
import { OriginSearchPanel, Participant } from './components/OriginSearchPanel';
import { 
  generateMockIsochrones, 
  IsochroneComputationResult, 
  UserOriginInput 
} from './utils/mockIsochrones';
import { fetchVenuesAroundMidpoint, fetchRealPhotoForVenue, Venue } from './utils/venues';
import { tokens } from './tokens';

export const App: React.FC = () => {
  const mapRef = useRef<MapCanvasHandle>(null);
  const [isochroneData, setIsochroneData] = useState<IsochroneComputationResult | null>(null);
  const [activeUserId, setActiveUserId] = useState<1 | 2 | 3 | 4>(1);

  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'cafe' | 'restaurant' | 'bar'>('all');
  const [activeVenueId, setActiveVenueId] = useState<string | null>(null);
  const [isSearchingVenues, setIsSearchingVenues] = useState(false);
  const [venueError, setVenueError] = useState<string | null>(null);

  // Initialize with 2 participants
  const [participants, setParticipants] = useState<Participant[]>([
    {
      id: 1,
      label: 'Person 1',
      address: 'Searching your location...',
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

  // Request geolocation on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: [number, number] = [position.coords.longitude, position.coords.latitude];
          setParticipants((prev) => {
            const updated = [...prev];
            updated[0] = {
              ...updated[0],
              coords,
              address: 'Your Location'
            };
            return updated;
          });
          const map = mapRef.current;
          if (map) {
            map.flyTo({ center: coords, zoom: 14 });
          }
        },
        (error) => {
          console.warn("Geolocation denied or failed. Using fallback.", error);
          setParticipants((prev) => {
            const updated = [...prev];
            updated[0] = { ...updated[0], address: 'Bahnhofstrasse 1, Zurich' };
            return updated;
          });
        }
      );
    }
  }, []);

  // Progressive real-photo enrichment (fetches authentic photos from Openverse & Wikimedia without blocking the UI)
  useEffect(() => {
    if (venues.length === 0) return;

    let isCancelled = false;

    const enrichVenues = async () => {
      // Find top venues that need real photos
      const pending = venues.filter((v) => !v.isRealPhoto).slice(0, 15);
      for (const venue of pending) {
        if (isCancelled) break;
        try {
          const realPhoto = await fetchRealPhotoForVenue(venue);
          if (realPhoto && !isCancelled) {
            setVenues((prev) =>
              prev.map((item) =>
                item.id === venue.id
                  ? {
                      ...item,
                      imageUrl: realPhoto.url,
                      isRealPhoto: true,
                      photoSource: realPhoto.source,
                    }
                  : item
              )
            );
          }
        } catch {
          // Continue gracefully
        }
      }
    };

    enrichVenues();

    return () => {
      isCancelled = true;
    };
  }, [venues.length > 0 ? venues[0].id : null]);

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
    setIsSearchingVenues(true);
    setVenueError(null);
    setVenues([]);

    try {
      const result = runCalculation(participants);
      
      if (result.fairpointCentroid) {
        // Fetch venues with optimal 850m radius and fast mirrors
        if (participants.length >= 2) {
          try {
            const fetchedVenues = await fetchVenuesAroundMidpoint(
              result.fairpointCentroid,
              850,
              participants[0].coords,
              participants[1].coords,
              participants[0].mode,
              participants[1].mode
            );
            if (fetchedVenues.length === 0) {
              setVenueError("No cafes or restaurants found within 850m of the midpoint. Try dragging a pin!");
            }
            setVenues(fetchedVenues);
          } catch (e: any) {
            console.error("Venue fetch error:", e);
            setVenueError(e.message || "Failed to connect to venue servers. Please try again.");
          }
        }

        if (map) {
          map.flyTo({
            center: result.fairpointCentroid,
            zoom: 14.5,
            essential: true,
            duration: 1200,
          });
        }
      } else if (map) {
        map.fitBounds(
          [
            [result.bbox[0], result.bbox[1]],
            [result.bbox[2], result.bbox[3]],
          ],
          {
            padding: { top: 80, bottom: 80, left: 440, right: 400 },
            duration: 1000,
          }
        );
      }
    } finally {
      setIsSearchingVenues(false);
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
          padding: { top: 80, bottom: 80, left: 440, right: 400 },
          duration: 1000,
        }
      );
    }
  };

  const handleVenueClick = useCallback((id: string) => {
    setActiveVenueId(id);
    const venue = venues.find(v => v.id === id);
    if (venue && mapRef.current) {
      mapRef.current.flyTo({
        center: venue.coords,
        zoom: 15.5,
        essential: true,
        duration: 900
      });
      // Scroll corresponding card into view smoothly
      const el = document.getElementById(`venue-card-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [venues]);

  // Filtered venues based on category
  const filteredVenues = selectedCategory === 'all'
    ? venues
    : venues.filter(v => v.type === selectedCategory);

  const cafeCount = venues.filter(v => v.type === 'cafe').length;
  const restaurantCount = venues.filter(v => v.type === 'restaurant').length;
  const barCount = venues.filter(v => v.type === 'bar').length;

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-slate-100">
      {/* 1. MapCanvas wrapped inside a background container (fixed inset-0 z-0) */}
      <div className="fixed inset-0 z-0">
        <MapCanvas
          ref={mapRef}
          isochroneData={isochroneData}
          venues={filteredVenues}
          activeVenueId={activeVenueId}
          activeUserId={activeUserId}
          onUserMarkerDragEnd={handleMarkerDragEnd}
          onMapClick={handleMapClick}
          onVenueClick={handleVenueClick}
          onMapReady={handleMapReady}
        />
      </div>

      {/* 2. Dedicated UI overlay layer */}
      <div className="relative z-50 pointer-events-none w-full h-full p-4 flex gap-4">
        {/* Left Section: Branding & Search */}
        <div className="flex flex-col gap-3 items-start max-w-sm pointer-events-auto shrink-0 h-full overflow-y-auto pb-20 no-scrollbar">
          {/* Sleek branding header */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 px-4 py-3 shadow-lg flex items-center justify-between w-96 shrink-0">
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

          {/* OriginSearchPanel */}
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
            className="shrink-0"
          />

          {venueError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl shadow-lg w-96 shrink-0 mt-2 text-sm font-medium animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-2">
                <span className="shrink-0">⚠️</span>
                <span>{venueError}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Section: Results Sidebar with Photo Cards & Fast Filters */}
        {(venues.length > 0 || isSearchingVenues) && (
          <div className="ml-auto pointer-events-auto w-[360px] bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200 shadow-2xl flex flex-col h-full shrink-0 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 shrink-0 bg-white/80">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-indigo-600" /> Recommended Spots
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isSearchingVenues 
                      ? "Searching venues near midpoint..." 
                      : `Top ${venues.length} fair meeting places`}
                  </p>
                </div>
                {!isSearchingVenues && (
                  <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-2 py-0.5 rounded-full">
                    {filteredVenues.length} available
                  </span>
                )}
              </div>

              {/* Category Filter Chips */}
              {!isSearchingVenues && venues.length > 0 && (
                <div className="flex items-center gap-1.5 mt-3 overflow-x-auto no-scrollbar py-0.5">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all shrink-0 ${
                      selectedCategory === 'all'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All ({venues.length})
                  </button>
                  {cafeCount > 0 && (
                    <button
                      onClick={() => setSelectedCategory('cafe')}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 shrink-0 ${
                        selectedCategory === 'cafe'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
                      }`}
                    >
                      <span>☕</span> Cafes ({cafeCount})
                    </button>
                  )}
                  {restaurantCount > 0 && (
                    <button
                      onClick={() => setSelectedCategory('restaurant')}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 shrink-0 ${
                        selectedCategory === 'restaurant'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200/60'
                      }`}
                    >
                      <span>🍽️</span> Dining ({restaurantCount})
                    </button>
                  )}
                  {barCount > 0 && (
                    <button
                      onClick={() => setSelectedCategory('bar')}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 shrink-0 ${
                        selectedCategory === 'bar'
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200/60'
                      }`}
                    >
                      <span>🍸</span> Bars ({barCount})
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {/* Cards Scroll Container */}
            <div className="p-3 overflow-y-auto flex-1 space-y-3.5 relative no-scrollbar">
              {/* Skeleton loading during search */}
              {isSearchingVenues && (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm animate-pulse">
                      <div className="h-28 bg-slate-200 w-full" />
                      <div className="p-3 space-y-2">
                        <div className="h-4 bg-slate-200 rounded w-2/3" />
                        <div className="h-3 bg-slate-200 rounded w-1/2" />
                        <div className="h-8 bg-slate-100 rounded-lg w-full mt-2" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!isSearchingVenues && filteredVenues.map((v) => {
                const isSelected = activeVenueId === v.id;
                const icon = v.type === 'cafe' ? '☕' : v.type === 'bar' ? '🍸' : '🍽️';

                return (
                  <div 
                    id={`venue-card-${v.id}`}
                    key={v.id}
                    onMouseEnter={() => setActiveVenueId(v.id)}
                    onMouseLeave={() => setActiveVenueId(null)}
                    onClick={() => handleVenueClick(v.id)}
                    className={`group rounded-xl border overflow-hidden transition-all duration-200 cursor-pointer ${
                      isSelected 
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-xl ring-2 ring-indigo-500/25 -translate-y-0.5' 
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                    }`}
                  >
                    {/* Photo Header */}
                    <div className="relative h-32 w-full overflow-hidden bg-slate-100">
                      <img 
                        src={v.imageUrl} 
                        alt={v.name}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent pointer-events-none" />

                      {/* Category Badge */}
                      <div className="absolute top-2 left-2 flex items-center gap-1 bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-800 shadow-sm capitalize">
                        <span>{icon}</span> {v.type}
                      </div>

                      {/* Real Photo indicator / Match Score */}
                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        {v.isRealPhoto && (
                          <span className="bg-emerald-600/95 backdrop-blur-md text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm flex items-center gap-0.5">
                            📸 Real
                          </span>
                        )}
                        <span className="bg-slate-900/90 backdrop-blur-md text-white px-2 py-0.5 rounded-full text-[10px] font-black shadow-md">
                          {v.matchScore}% Match
                        </span>
                      </div>

                      {/* Distance pill on bottom right */}
                      <div className="absolute bottom-2 right-2 bg-black/65 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
                        <Navigation className="w-2.5 h-2.5" />
                        {v.distanceMeters}m from midpoint
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors">
                          {v.name}
                        </h3>
                      </div>

                      {v.cuisine && (
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {v.cuisine.split(';').join(', ')}
                        </p>
                      )}

                      {/* Travel Times Comparison */}
                      <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-700 bg-slate-50 group-hover:bg-indigo-50/40 rounded-lg p-2 border border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: participants[0]?.color }}></span>
                          <span className="truncate">{participants[0]?.label || 'P1'}: <b>{v.timeA}m</b></span>
                        </div>
                        {participants[1] && (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: participants[1]?.color }}></span>
                            <span className="truncate">{participants[1]?.label || 'P2'}: <b>{v.timeB}m</b></span>
                          </div>
                        )}
                      </div>
                      
                      {/* Address */}
                      <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1 truncate">
                        <Compass className="w-3 h-3 shrink-0 text-slate-400" />
                        <span className="truncate">{v.address}</span>
                      </div>

                      {/* Actions Footer: Direct Google Maps & Website */}
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <a
                          href={v.googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-indigo-600 bg-slate-100/80 hover:bg-indigo-50 px-2 py-1 rounded-md border border-slate-200/80 hover:border-indigo-200 transition-colors"
                          title="View reviews, photos and details on Google Maps"
                        >
                          <span>🗺️ Google Maps</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </a>
                        {v.website && (
                          <a 
                            href={v.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline"
                            title="Visit website"
                          >
                            <span>Website</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom Left Floating Bar / Controls */}
        <footer className="pointer-events-auto absolute bottom-4 left-4 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-sm w-full">
          <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 px-4 py-2.5 shadow-lg flex items-center gap-4 text-xs w-full justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-intersection animate-ping" />
              <span className="font-semibold text-slate-800">Midpoint:</span>
            </div>
            <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
              <MapPin className="w-3 h-3 text-intersection" />
              {isochroneData?.fairpointCentroid
                ? `${isochroneData.fairpointCentroid[0].toFixed(4)}°E, ${isochroneData.fairpointCentroid[1].toFixed(4)}°N`
                : '...'}
            </span>
            <button
              onClick={fitAll}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium text-xs p-1.5 rounded-lg shadow-sm transition-all active:scale-95"
              title="Fit bounds"
            >
              <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;

