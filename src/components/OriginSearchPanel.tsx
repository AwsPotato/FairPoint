import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  X, 
  Loader2, 
  MapPin, 
  Sparkles,
  Search
} from 'lucide-react';
import { tokens } from '../tokens';

export type TravelMode = 'transit' | 'driving' | 'walking';

export interface Participant {
  id: 1 | 2 | 3 | 4;
  label: string;
  address: string;
  coords: [number, number]; // [lng, lat]
  mode: TravelMode;
  color: string;
  colorName: string;
}

export interface GeocodingResult {
  name: string;
  description: string;
  coords: [number, number]; // [lng, lat]
}

export interface OriginSearchPanelProps {
  participants: Participant[];
  activeUserId: 1 | 2 | 3 | 4;
  onActiveUserChange: (id: 1 | 2 | 3 | 4) => void;
  onParticipantsChange: (participants: Participant[]) => void;
  onLocationSelect: (id: 1 | 2 | 3 | 4, address: string, coords: [number, number]) => void;
  onFindFairPoint: () => Promise<void> | void;
  className?: string;
}

const PARTICIPANT_DEFAULTS: Record<1 | 2 | 3 | 4, { label: string; color: string; colorName: string; defaultCoords: [number, number] }> = {
  1: { label: 'Person 1', color: tokens.colors.user1, colorName: 'Cobalt Blue', defaultCoords: [8.532, 47.377] },
  2: { label: 'Person 2', color: tokens.colors.user2, colorName: 'Rose Red', defaultCoords: [8.552, 47.388] },
  3: { label: 'Person 3', color: tokens.colors.user3, colorName: 'Emerald Green', defaultCoords: [8.528, 47.362] },
  4: { label: 'Person 4', color: tokens.colors.user4, colorName: 'Violet Purple', defaultCoords: [8.558, 47.365] },
};

const TRAVEL_MODES: { id: TravelMode; label: string; icon: string }[] = [
  { id: 'transit', label: 'Transit', icon: '🚆' },
  { id: 'driving', label: 'Driving', icon: '🚗' },
  { id: 'walking', label: 'Walking', icon: '🚶' },
];

export const OriginSearchPanel: React.FC<OriginSearchPanelProps> = ({
  participants,
  activeUserId,
  onActiveUserChange,
  onParticipantsChange,
  onLocationSelect,
  onFindFairPoint,
  className = '',
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [activeDropdownUser, setActiveDropdownUser] = useState<(1 | 2 | 3 | 4) | null>(null);
  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchAbortController = useRef<AbortController | null>(null);
  const debounceTimer = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveDropdownUser(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddPerson = () => {
    if (participants.length >= 4) return;

    const existingIds = new Set(participants.map((p) => p.id));
    const nextId = ([3, 4] as const).find((id) => !existingIds.has(id));
    if (!nextId) return;

    const defaults = PARTICIPANT_DEFAULTS[nextId];
    const newParticipant: Participant = {
      id: nextId,
      label: defaults.label,
      address: '',
      coords: defaults.defaultCoords,
      mode: 'transit',
      color: defaults.color,
      colorName: defaults.colorName,
    };

    const updated = [...participants, newParticipant].sort((a, b) => a.id - b.id);
    onParticipantsChange(updated);
    onActiveUserChange(nextId);
  };

  const handleRemovePerson = (id: 1 | 2 | 3 | 4) => {
    if (id === 1 || id === 2) return;
    const updated = participants.filter((p) => p.id !== id);
    onParticipantsChange(updated);
    if (activeUserId === id) {
      onActiveUserChange(1);
    }
  };

  // Perform geocoding search via Photon API with debounce
  const fetchSuggestions = (query: string, userId: 1 | 2 | 3 | 4) => {
    if (debounceTimer.current) {
      window.clearTimeout(debounceTimer.current);
    }

    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setActiveDropdownUser(userId);

    debounceTimer.current = window.setTimeout(async () => {
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }
      searchAbortController.current = new AbortController();

      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&limit=5&addressdetails=1`;
        const res = await fetch(url, { 
          signal: searchAbortController.current.signal,
          headers: {
            'User-Agent': 'FairPoint App (contact@fairpoint.example.com)'
          }
        });
        if (!res.ok) throw new Error('Geocoding search failed');
        const data = await res.json();

        // Map Nominatim features to GeocodingResult objects
        const results: GeocodingResult[] = (data || []).map((item: any) => {
          const props = item.address || {};
          const name = item.name || props.road || props.pedestrian || 'Selected Location';
          const details = [
            props.house_number ? `${props.house_number} ${props.road || ''}`.trim() : props.road,
            props.suburb || props.neighbourhood,
            props.city || props.town || props.village,
            props.state,
            props.country,
          ].filter(Boolean).join(', ');

          return {
            name,
            description: details || props.country || '',
            coords: [parseFloat(item.lon), parseFloat(item.lat)] as [number, number],
          };
        });

        setSuggestions(results);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Geocoding error:', err);
        }
      } finally {
        setIsSearching(false);
      }
    }, 280);
  };

  const handleAddressInputChange = (id: 1 | 2 | 3 | 4, value: string) => {
    onActiveUserChange(id);
    const updated = participants.map((p) => (p.id === id ? { ...p, address: value } : p));
    onParticipantsChange(updated);
    fetchSuggestions(value, id);
  };

  const handleSelectSuggestion = (userId: 1 | 2 | 3 | 4, item: GeocodingResult) => {
    const fullText = item.description ? `${item.name}, ${item.description}` : item.name;
    setActiveDropdownUser(null);
    setSuggestions([]);
    onLocationSelect(userId, fullText, item.coords);
  };

  const handleModeChange = (id: 1 | 2 | 3 | 4, mode: TravelMode) => {
    const updated = participants.map((p) => (p.id === id ? { ...p, mode } : p));
    onParticipantsChange(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onFindFairPoint();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 p-4 w-96 pointer-events-auto transition-all ${className}`}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 border border-amber-500/20">
            <Sparkles className="w-4 h-4 text-intersection" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">
            Meeting Origins
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
          <span>{participants.length} / 4 People</span>
        </div>
      </div>

      {/* Participants Form */}
      <form onSubmit={handleSubmit} className="mt-3.5 space-y-3.5">
        <div className="space-y-3">
          {participants.map((person) => {
            const canRemove = person.id === 3 || person.id === 4;
            const isCurrentActive = activeUserId === person.id;
            const showDropdown = activeDropdownUser === person.id && suggestions.length > 0;

            return (
              <div
                key={person.id}
                onClick={() => onActiveUserChange(person.id)}
                className={`relative rounded-xl p-3 border transition-all cursor-pointer ${
                  isCurrentActive
                    ? 'bg-blue-50/20 border-slate-400 ring-2 ring-slate-400/20'
                    : 'bg-slate-50/80 border-slate-200/80 hover:border-slate-300'
                }`}
              >
                {/* Person Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-xs flex-shrink-0"
                      style={{ backgroundColor: person.color }}
                    />
                    <span className="text-xs font-semibold text-slate-800">
                      {person.label}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({person.colorName})
                    </span>
                    {isCurrentActive && (
                      <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                        Active Pin
                      </span>
                    )}
                  </div>

                  {canRemove && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePerson(person.id);
                      }}
                      className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-1 rounded-md transition-colors"
                      title={`Remove ${person.label}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Address Input with Geocoding */}
                <div className="relative mt-2">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    {isSearching && activeDropdownUser === person.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                    ) : (
                      <MapPin className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <input
                    type="text"
                    value={person.address}
                    onFocus={() => {
                      onActiveUserChange(person.id);
                      if (person.address.length >= 2) {
                        fetchSuggestions(person.address, person.id);
                      }
                    }}
                    onChange={(e) => handleAddressInputChange(person.id, e.target.value)}
                    placeholder={`Enter address or click map for ${person.label}...`}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all"
                    style={{ outlineColor: person.color }}
                  />

                  {/* Geocoding Suggestions Dropdown */}
                  {showDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white/98 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
                      <div className="px-3 py-1 bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Suggested Locations</span>
                        <Search className="w-3 h-3 text-slate-400" />
                      </div>
                      {suggestions.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectSuggestion(person.id, item);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-amber-50/70 transition-colors flex items-start space-x-2 group"
                        >
                          <MapPin className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500 flex-shrink-0 mt-0.5" />
                          <div className="overflow-hidden">
                            <div className="text-xs font-semibold text-slate-800 truncate">
                              {item.name}
                            </div>
                            {item.description && (
                              <div className="text-[10px] text-slate-500 truncate">
                                {item.description}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Inline Segmented Travel Mode Toggle */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-medium text-slate-500">
                    Mode:
                  </span>
                  <div className="inline-flex bg-slate-200/70 p-0.5 rounded-lg border border-slate-200">
                    {TRAVEL_MODES.map((mode) => {
                      const isActive = person.mode === mode.id;

                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleModeChange(person.id, mode.id);
                          }}
                          className={`flex items-center space-x-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                            isActive
                              ? 'bg-white text-slate-800 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                          }`}
                        >
                          <span>{mode.icon}</span>
                          <span className="hidden sm:inline">{mode.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Person Button (Capped at 4) */}
        {participants.length < 4 && (
          <button
            type="button"
            onClick={handleAddPerson}
            className="w-full py-2 px-3 border border-dashed border-slate-300 hover:border-slate-400 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50/80 transition-all flex items-center justify-center space-x-1.5 active:scale-[0.99]"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>
              + Add Person {participants.length === 2 ? '(Person 3 - Green)' : '(Person 4 - Purple)'}
            </span>
          </button>
        )}

        {/* Primary Action Button: Find FairPoint */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 bg-intersection hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-md shadow-amber-500/25 transition-all flex items-center justify-center space-x-2 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Calculating FairPoint...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-white" />
              <span>Find FairPoint</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default OriginSearchPanel;
