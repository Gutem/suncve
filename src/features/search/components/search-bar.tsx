'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { IconSearch, IconX, IconLoader2 } from '@tabler/icons-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SearchFilters } from '@/features/search/types';

interface SearchBarProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  isSearching?: boolean;
  placeholder?: string;
}

export function SearchBar({
  filters,
  onFiltersChange,
  isSearching = false,
  placeholder
}: SearchBarProps) {
  const t = useTranslations('search');
  const placeholderText = placeholder ?? t('searchPlaceholder');
  const [inputValue, setInputValue] = useState(filters.query);

  // Update filters immediately when input changes
  // Parent component handles debouncing
  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value);
      onFiltersChange({ ...filters, query: value });
    },
    [filters, onFiltersChange]
  );

  // Sync with external filter changes (e.g., URL params)
  useEffect(() => {
    if (filters.query !== inputValue) {
      setInputValue(filters.query);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.query]);

  const handleClear = useCallback(() => {
    setInputValue('');
    onFiltersChange({ ...filters, query: '' });
  }, [filters, onFiltersChange]);

  // Show loading when searching
  const showLoading = isSearching;

  return (
    <div className='relative' data-tour='cve-search'>
      <div className='absolute top-1/2 left-4 -translate-y-1/2'>
        {showLoading ? (
          <IconLoader2 className='text-primary h-5 w-5 animate-spin' />
        ) : (
          <IconSearch className='text-muted-foreground h-5 w-5' />
        )}
      </div>
      <Input
        type='text'
        placeholder={placeholderText}
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        className={cn(
          'bg-card placeholder:text-muted-foreground/60 h-14 rounded-xl border-2 pr-12 pl-12 text-base shadow-sm transition-all',
          showLoading && 'border-primary/50 ring-primary/10 ring-4',
          !showLoading &&
            'hover:border-muted-foreground/30 focus:border-primary'
        )}
      />
      {inputValue && !showLoading && (
        <Button
          variant='ghost'
          size='icon'
          className='hover:bg-muted absolute top-1/2 right-3 h-8 w-8 -translate-y-1/2 rounded-lg'
          onClick={handleClear}
        >
          <IconX className='h-4 w-4' />
        </Button>
      )}
    </div>
  );
}
