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
import { Switch } from '@/components/ui/switch';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
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
  type SearchFilters,
  type Severity,
  type DatePeriod,
  defaultFilters
} from '@/features/search/types';
import { Input } from '@/components/ui/input';
import { CheckIcon } from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';

interface FiltersPanelProps {
  filters: SearchFilters;
  filterOptions: {
    cwes: { cwe_id: string; count: number }[];
    languages: { languageMain: string; count: number }[];
  };
  onFiltersChange: (filters: SearchFilters) => void;
  isSearching?: boolean;
}

export function FiltersPanel({
  filters,
  filterOptions,
  onFiltersChange,
  isSearching = false
}: FiltersPanelProps) {
  const t = useTranslations('search.filters');
  const [isOpen, setIsOpen] = useState(false);
  const [cweOpen, setCweOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const activeFiltersCount = countActiveFilters(filters);

  const handleReset = useCallback(() => {
    onFiltersChange(defaultFilters);
  }, [onFiltersChange]);

  const handleCVSSChange = useCallback(
    (value: number[]) => {
      onFiltersChange({
        ...filters,
        cvssMin: value[0],
        cvssMax: value[1]
      });
    },
    [filters, onFiltersChange]
  );

  const handleSeverityToggle = useCallback(
    (severity: Severity) => {
      const newSeverities = filters.severity.includes(severity)
        ? filters.severity.filter((s) => s !== severity)
        : [...filters.severity, severity];
      onFiltersChange({ ...filters, severity: newSeverities });
    },
    [filters, onFiltersChange]
  );

  const handleCWEToggle = useCallback(
    (cwe: string) => {
      const newCWEs = filters.cwes.includes(cwe)
        ? filters.cwes.filter((c) => c !== cwe)
        : [...filters.cwes, cwe];
      onFiltersChange({ ...filters, cwes: newCWEs });
    },
    [filters, onFiltersChange]
  );

  const handleLanguageToggle = useCallback(
    (lang: string) => {
      const newLangs = filters.languages.includes(lang)
        ? filters.languages.filter((l) => l !== lang)
        : [...filters.languages, lang];
      onFiltersChange({ ...filters, languages: newLangs });
    },
    [filters, onFiltersChange]
  );

  const handleBooleanFilter = useCallback(
    (
      key: 'hasExploit' | 'hasRepository' | 'hasCommitFix',
      value: boolean | null
    ) => {
      onFiltersChange({ ...filters, [key]: value });
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

  const handleDatePeriodChange = useCallback(
    (period: DatePeriod) => {
      onFiltersChange({
        ...filters,
        datePeriod: period,
        customDate: period === 'custom' ? filters.customDate : null
      });
    },
    [filters, onFiltersChange]
  );

  const handleCustomDateChange = useCallback(
    (date: string) => {
      onFiltersChange({
        ...filters,
        datePeriod: 'custom',
        customDate: date
      });
    },
    [filters, onFiltersChange]
  );

  const handleRepositoryChange = useCallback(
    (repo: string) => {
      onFiltersChange({
        ...filters,
        repository: repo || null
      });
    },
    [filters, onFiltersChange]
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} data-tour='cve-filters'>
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
          {/* CVSS Score Range */}
          <div className='space-y-3'>
            <Label>{t('cvssScore')}</Label>
            <Slider
              min={0}
              max={10}
              step={0.1}
              value={[filters.cvssMin, filters.cvssMax]}
              onValueChange={handleCVSSChange}
            />
            <div className='text-muted-foreground flex justify-between text-sm'>
              <span>{filters.cvssMin.toFixed(1)}</span>
              <span>{filters.cvssMax.toFixed(1)}</span>
            </div>
          </div>

          {/* Severity */}
          <div className='space-y-3'>
            <Label>{t('severity')}</Label>
            <div className='flex flex-wrap gap-2'>
              {(['critical', 'high', 'medium', 'low'] as Severity[]).map(
                (sev) => (
                  <Badge
                    key={sev}
                    variant={
                      filters.severity.includes(sev) ? 'default' : 'outline'
                    }
                    className={cn(
                      'cursor-pointer transition-colors',
                      filters.severity.includes(sev) &&
                        getSeverityBadgeColor(sev)
                    )}
                    onClick={() => handleSeverityToggle(sev)}
                  >
                    {t(`severity_${sev}`)}
                  </Badge>
                )
              )}
            </div>
          </div>

          {/* CWE Filter */}
          <div className='space-y-3'>
            <Label>{t('cwe')}</Label>
            <Popover open={cweOpen} onOpenChange={setCweOpen}>
              <PopoverTrigger asChild>
                <Button variant='outline' className='w-full justify-start'>
                  {filters.cwes.length > 0
                    ? `${filters.cwes.length} ${t('selected')}`
                    : t('selectCWE')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-[300px] p-0' align='start'>
                <Command>
                  <CommandInput placeholder={t('searchCWE')} />
                  <CommandList className='max-h-[200px]'>
                    <CommandEmpty>{t('noCWEFound')}</CommandEmpty>
                    <CommandGroup>
                      {filterOptions.cwes.map((cwe) => (
                        <CommandItem
                          key={cwe.cwe_id}
                          onSelect={() => handleCWEToggle(cwe.cwe_id)}
                        >
                          <div
                            className={cn(
                              'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border',
                              filters.cwes.includes(cwe.cwe_id)
                                ? 'bg-primary text-primary-foreground'
                                : 'opacity-50'
                            )}
                          >
                            {filters.cwes.includes(cwe.cwe_id) && (
                              <CheckIcon className='h-3 w-3' />
                            )}
                          </div>
                          <span className='flex-1'>{cwe.cwe_id}</span>
                          <span className='text-muted-foreground text-xs'>
                            ({cwe.count.toLocaleString()})
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Boolean Filters */}
          <div className='space-y-3'>
            <Label>{t('flags')}</Label>
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <span className='text-sm'>{t('hasExploit')}</span>
                <TriStateSwitch
                  value={filters.hasExploit}
                  onChange={(v) => handleBooleanFilter('hasExploit', v)}
                />
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-sm'>{t('hasRepository')}</span>
                <TriStateSwitch
                  value={filters.hasRepository}
                  onChange={(v) => handleBooleanFilter('hasRepository', v)}
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
            <Label>{t('repoStars')}</Label>
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

          {/* Repository Filter */}
          <div className='space-y-3'>
            <Label>{t('repository')}</Label>
            <Input
              type='text'
              placeholder={t('repositoryPlaceholder')}
              value={filters.repository || ''}
              onChange={(e) => handleRepositoryChange(e.target.value)}
            />
          </div>

          {/* Date Period Filter */}
          <div className='space-y-3 md:col-span-2 lg:col-span-3'>
            <Label>{t('datePeriod')}</Label>
            <div className='flex flex-wrap items-center gap-2'>
              {(
                [
                  'today',
                  '7d',
                  '30d',
                  '120d',
                  '1y',
                  '5y',
                  'all'
                ] as DatePeriod[]
              ).map((period) => (
                <Badge
                  key={period}
                  variant={
                    filters.datePeriod === period ? 'default' : 'outline'
                  }
                  className='cursor-pointer transition-colors'
                  onClick={() => handleDatePeriodChange(period)}
                >
                  {t(`period_${period}`)}
                </Badge>
              ))}
              <div className='flex items-center gap-2'>
                <Badge
                  variant={
                    filters.datePeriod === 'custom' ? 'default' : 'outline'
                  }
                  className='cursor-pointer transition-colors'
                  onClick={() => handleDatePeriodChange('custom')}
                >
                  {t('period_custom')}
                </Badge>
                {filters.datePeriod === 'custom' && (
                  <Input
                    type='text'
                    placeholder='2024, 2024-07, 2024-07-15'
                    value={filters.customDate || ''}
                    onChange={(e) => handleCustomDateChange(e.target.value)}
                    className='w-44'
                  />
                )}
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

function getSeverityBadgeColor(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return 'bg-red-500 hover:bg-red-600';
    case 'high':
      return 'bg-orange-500 hover:bg-orange-600';
    case 'medium':
      return 'bg-yellow-500 hover:bg-yellow-600 text-black';
    case 'low':
      return 'bg-blue-500 hover:bg-blue-600';
    default:
      return '';
  }
}

function countActiveFilters(filters: SearchFilters): number {
  let count = 0;
  if (filters.query) count++;
  if (filters.cvssMin > 0 || filters.cvssMax < 10) count++;
  if (filters.severity.length > 0) count++;
  if (filters.cwes.length > 0) count++;
  if (filters.hasExploit !== null) count++;
  if (filters.hasRepository !== null) count++;
  if (filters.hasCommitFix !== null) count++;
  if (filters.languages.length > 0) count++;
  if (filters.starsMin !== null || filters.starsMax !== null) count++;
  if (filters.repoSizeMin !== null || filters.repoSizeMax !== null) count++;
  if (filters.datePeriod !== 'all') count++;
  if (filters.repository) count++;
  return count;
}
