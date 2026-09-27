import React, { useState } from 'react';
import { 
  Plus, 
  X, 
  Loader2, 
  MapPin, 
  Sparkles 
} from 'lucide-react';
import { tokens } from '../tokens';

export type TravelMode = 'transit' | 'driving' | 'walking';

export interface Participant {
  id: 1 | 2 | 3 | 4;
  label: string;
  address: string;
  mode: TravelMode;
  color: string;
  colorName: string;
}

export interface OriginSearchPanelProps {
  onFindFairPoint?: (participants: Participant[]) => Promise<void> | void;
  className?: string;
}

const PARTICIPANT_DEFAULTS: Record<1 | 2 | 3 | 4, { label: string; color: string; colorName: string }> = {
  1: { label: 'Person 1', color: tokens.colors.user1, colorName: 'Cobalt Blue' },
  2: { label: 'Person 2', color: tokens.colors.user2, colorName: 'Rose Red' },
  3: { label: 'Person 3', color: tokens.colors.user3, colorName: 'Emerald Green' },
  4: { label: 'Person 4', color: tokens.colors.user4, colorName: 'Violet Purple' },
};

const TRAVEL_MODES: { id: TravelMode; label: string; icon: string }[] = [
  { id: 'transit', label: 'Transit', icon: '🚆' },
  { id: 'driving', label: 'Driving', icon: '🚗' },
  { id: 'walking', label: 'Walking', icon: '🚶' },
];

export const OriginSearchPanel: React.FC<OriginSearchPanelProps> = ({
  onFindFairPoint,
  className = '',
}) => {
  const [participants, setParticipants] = useState<Participant[]>([
    {
      id: 1,
      label: PARTICIPANT_DEFAULTS[1].label,
      address: '',
      mode: 'transit',
      color: PARTICIPANT_DEFAULTS[1].color,
      colorName: PARTICIPANT_DEFAULTS[1].colorName,
    },
    {
      id: 2,
      label: PARTICIPANT_DEFAULTS[2].label,
      address: '',
      mode: 'transit',
      color: PARTICIPANT_DEFAULTS[2].color,
      colorName: PARTICIPANT_DEFAULTS[2].colorName,
    },
  ]);

  const [isLoading, setIsLoading] = useState(false);

  const handleAddPerson = () => {
    if (participants.length >= 4) return;

    // Check which IDs are already used
    const existingIds = new Set(participants.map((p) => p.id));
    const nextId = ([3, 4] as const).find((id) => !existingIds.has(id));

    if (!nextId) return;

    const newParticipant: Participant = {
      id: nextId,
      label: PARTICIPANT_DEFAULTS[nextId].label,
      address: '',
      mode: 'transit',
      color: PARTICIPANT_DEFAULTS[nextId].color,
      colorName: PARTICIPANT_DEFAULTS[nextId].colorName,
    };

    // Keep sorted by ID
    const updated = [...participants, newParticipant].sort((a, b) => a.id - b.id);
    setParticipants(updated);
  };

  const handleRemovePerson = (id: 1 | 2 | 3 | 4) => {
    // Cannot remove Person 1 or 2
    if (id === 1 || id === 2) return;
    setParticipants((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAddressChange = (id: 1 | 2 | 3 | 4, value: string) => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, address: value } : p))
    );
  };

  const handleModeChange = (id: 1 | 2 | 3 | 4, mode: TravelMode) => {
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, mode } : p))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (onFindFairPoint) {
        await onFindFairPoint(participants);
      } else {
        // Default simulated action
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 p-4 w-96 pointer-events-auto transition-all ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 border border-amber-500/20">
            <Sparkles className="w-4 h-4 text-intersection" />
          </div>
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">
            Meeting Origins
          </h2>
        </div>
        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
          {participants.length} / 4 People
        </span>
      </div>

      {/* Participants Form */}
      <form onSubmit={handleSubmit} className="mt-3.5 space-y-3.5">
        <div className="space-y-3">
          {participants.map((person) => {
            const canRemove = person.id === 3 || person.id === 4;

            return (
              <div
                key={person.id}
                className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/70 space-y-2 transition-all hover:border-slate-300"
              >
                {/* Person Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {/* User Accent Dot */}
                    <span
                      className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm flex-shrink-0"
                      style={{ backgroundColor: person.color }}
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      {person.label}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({person.colorName})
                    </span>
                  </div>

                  {/* Remove Button for User 3 and 4 only */}
                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => handleRemovePerson(person.id)}
                      className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-1 rounded-md transition-colors"
                      title={`Remove ${person.label}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Address Input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <MapPin className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={person.address}
                    onChange={(e) => handleAddressChange(person.id, e.target.value)}
                    placeholder={`Enter ${person.label}'s starting location...`}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all"
                    style={{
                      // Focused ring matches participant theme color dynamically
                      outlineColor: person.color,
                    }}
                  />
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
                          onClick={() => handleModeChange(person.id, mode.id)}
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

        {/* Add Person Button (Capped strictly at 4) */}
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
