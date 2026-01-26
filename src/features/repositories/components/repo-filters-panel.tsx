'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  IconFilter,
  IconChevronDown,
  IconChevronUp,
  IconX,
  IconLoader2
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import {
  type RepositorySearchFilters,
  defaultRepositoryFilters
} from '@/features/search/types';
import { CheckIcon } from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';

interface RepoFiltersPanelProps {
  filters: RepositorySearchFilters;
  filterOptions: {
    languages: { languageMain: string; count: number }[];
  };
  onFiltersChange: (filters: RepositorySearchFilters) => void;
  isSearching?: boolean;
}

export function RepoFiltersPanel({
  filters,
  filterOptions,
  onFiltersChange,
  isSearching = false
}: RepoFiltersPanelProps) {
  const t = useTranslations('repositories.filters');
  const [isOpen, setIsOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const activeFiltersCount = countActiveFilters(filters);

  const handleReset = useCallback(() => {
    onFiltersChange(defaultRepositoryFilters);
  }, [onFiltersChange]);

  const handleLanguageToggle = useCallback(
    (lang: string) => {
      const newLangs = filters.languages.includes(lang)
        ? filters.languages.filter((l) => l !== lang)
        : [...filters.languages, lang];
      onFiltersChange({ ...filters, languages: newLangs });
    },
    [filters, onFiltersChange]
  );

  const handleStarsChange = useCallback(
    (value: number[]) => {
      onFiltersChange({
        ...filters,
        starsMin: value[0] > 0 ? value[0] : null,
        starsMax: value[1] < 100000 ? value[1] : null
      });
    },
    [filters, onFiltersChange]
  );

  const handleSizeChange = useCallback(
    (value: number[]) => {
      // Size is in KB, slider shows MB
      const minKB = value[0] > 0 ? value[0] * 1024 : null;
      const maxKB = value[1] < 1000 ? value[1] * 1024 : null;
      onFiltersChange({
        ...filters,
        sizeMin: minKB,
        sizeMax: maxKB
      });
    },
    [filters, onFiltersChange]
  );

  const handleBooleanFilter = useCallback(
    (key: 'hasCVEs' | 'hasCommitFix', value: boolean | null) => {
      onFiltersChange({ ...filters, [key]: value });
    },
    [filters, onFiltersChange]
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          'bg-card flex items-center justify-between rounded-xl border-2 p-4 shadow-sm transition-all',
          isSearching && 'border-primary/50 ring-primary/10 ring-4',
          !isSearching && 'hover:border-muted-foreground/30'
        )}
      >
        <CollapsibleTrigger asChild>
          <Button
            variant='ghost'
            className='flex items-center gap-2 text-base font-medium'
          >
            {isSearching ? (
              <IconLoader2 className='text-primary h-5 w-5 animate-spin' />
            ) : (
              <IconFilter className='h-5 w-5' />
            )}
            {t('title')}
            {activeFiltersCount > 0 && (
              <Badge variant='default' className='ml-2 rounded-full'>
                {activeFiltersCount}
              </Badge>
            )}
            {isOpen ? (
              <IconChevronUp className='text-muted-foreground h-5 w-5' />
            ) : (
              <IconChevronDown className='text-muted-foreground h-5 w-5' />
            )}
          </Button>
        </CollapsibleTrigger>

        {activeFiltersCount > 0 && (
          <Button
            variant='outline'
            size='sm'
            onClick={handleReset}
            className='rounded-lg'
          >
            <IconX className='mr-1 h-4 w-4' />
            {t('clearAll')}
          </Button>
        )}
      </div>

      <CollapsibleContent className='mt-4'>
        <div className='bg-card grid gap-6 rounded-xl border-2 p-6 shadow-sm md:grid-cols-2 lg:grid-cols-3'>
          {/* Language Filter */}
          <div className='space-y-3'>
            <Label>{t('language')}</Label>
            <Popover open={langOpen} onOpenChange={setLangOpen}>
              <PopoverTrigger asChild>
                <Button variant='outline' className='w-full justify-start'>
                  {filters.languages.length > 0
                    ? `${filters.languages.length} ${t('selected')}`
                    : t('selectLanguage')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-[300px] p-0' align='start'>
                <Command>
                  <CommandInput placeholder={t('searchLanguage')} />
                  <CommandList className='max-h-[200px]'>
                    <CommandEmpty>{t('noLanguageFound')}</CommandEmpty>
                    <CommandGroup>
                      {filterOptions.languages.map((lang) => (
                        <CommandItem
                          key={lang.languageMain}
                          onSelect={() =>
                            handleLanguageToggle(lang.languageMain)
                          }
                        >
                          <div
                            className={cn(
                              'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border',
                              filters.languages.includes(lang.languageMain)
                                ? 'bg-primary text-primary-foreground'
                                : 'opacity-50'
                            )}
                          >
                            {filters.languages.includes(lang.languageMain) && (
                              <CheckIcon className='h-3 w-3' />
                            )}
                          </div>
                          <span className='flex-1'>{lang.languageMain}</span>
                          <span className='text-muted-foreground text-xs'>
                            ({lang.count.toLocaleString()})
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Stars Range */}
          <div className='space-y-3'>
            <Label>{t('stars')}</Label>
            <Slider
              min={0}
              max={100000}
              step={100}
              value={[filters.starsMin ?? 0, filters.starsMax ?? 100000]}
              onValueChange={handleStarsChange}
            />
            <div className='text-muted-foreground flex justify-between text-sm'>
              <span>{(filters.starsMin ?? 0).toLocaleString()}</span>
              <span>{(filters.starsMax ?? 100000).toLocaleString()}+</span>
            </div>
          </div>

          {/* Size Range */}
          <div className='space-y-3'>
            <Label>{t('size')}</Label>
            <Slider
              min={0}
              max={1000}
              step={10}
              value={[
                filters.sizeMin ? Math.round(filters.sizeMin / 1024) : 0,
                filters.sizeMax ? Math.round(filters.sizeMax / 1024) : 1000
              ]}
              onValueChange={handleSizeChange}
            />
            <div className='text-muted-foreground flex justify-between text-sm'>
              <span>
                {filters.sizeMin
                  ? Math.round(filters.sizeMin / 1024).toLocaleString()
                  : 0}{' '}
                MB
              </span>
              <span>
                {filters.sizeMax
                  ? Math.round(filters.sizeMax / 1024).toLocaleString()
                  : '1000+'}{' '}
                MB
              </span>
            </div>
          </div>

          {/* Boolean Filters */}
          <div className='space-y-3'>
            <Label>{t('flags')}</Label>
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <span className='text-sm'>{t('hasCVEs')}</span>
                <TriStateSwitch
                  value={filters.hasCVEs}
                  onChange={(v) => handleBooleanFilter('hasCVEs', v)}
                />
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-sm'>{t('hasCommitFix')}</span>
                <TriStateSwitch
                  value={filters.hasCommitFix}
                  onChange={(v) => handleBooleanFilter('hasCommitFix', v)}
                />
              </div>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Helper Components

function TriStateSwitch({
  value,
  onChange
}: {
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  const handleClick = () => {
    if (value === null) {
      onChange(true);
    } else if (value === true) {
      onChange(false);
    } else {
      onChange(null);
    }
  };

  return (
    <Button
      variant='outline'
      size='sm'
      className={cn(
        'w-16',
        value === true && 'border-green-500 bg-green-500/20',
        value === false && 'border-red-500 bg-red-500/20'
      )}
      onClick={handleClick}
    >
      {value === null ? '—' : value ? 'Yes' : 'No'}
    </Button>
  );
}

function countActiveFilters(filters: RepositorySearchFilters): number {
  let count = 0;
  if (filters.query) count++;
  if (filters.languages.length > 0) count++;
  if (filters.starsMin !== null || filters.starsMax !== null) count++;
  if (filters.sizeMin !== null || filters.sizeMax !== null) count++;
  if (filters.hasCVEs !== null) count++;
  if (filters.hasCommitFix !== null) count++;
  return count;
}
