import { useState, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

interface MemberAccessSearchProps {
  onSearch: (address: string) => void;
  onClear: () => void;
  isGeocoding: boolean;
  error: string | null;
  hasPin: boolean;
}

const MemberAccessSearch = ({ onSearch, onClear, isGeocoding, error, hasPin }: MemberAccessSearchProps) => {
  const [value, setValue] = useState('');

  const handleSearch = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSearch(trimmed);
  }, [value, onSearch]);

  const handleClear = useCallback(() => {
    setValue('');
    onClear();
  }, [onClear]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  }, [handleSearch]);

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-1 pointer-events-auto max-w-[calc(100%-1rem)]">
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card/95 shadow-md backdrop-blur-sm px-2 py-1.5">
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter member address"
          className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-52 md:w-64"
          disabled={isGeocoding}
        />
        <button
          onClick={handleSearch}
          disabled={isGeocoding || !value.trim()}
          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-40"
          aria-label="Search address"
        >
          {isGeocoding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
        </button>
        {(hasPin || value) && (
          <button
            onClick={handleClear}
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Clear member location"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {hasPin && !error && (
        <p className="text-[9px] text-muted-foreground/60 select-none">Clear search to exit member mode</p>
      )}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-1.5 text-[11px] text-destructive max-w-72 text-center">
          {error}
        </div>
      )}
    </div>
  );
};

export default MemberAccessSearch;
