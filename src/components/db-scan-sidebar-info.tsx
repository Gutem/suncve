'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { SidebarMenuButton, useSidebar } from '@/components/ui/sidebar';
import { DB_MANIFEST_URL } from '@/lib/db-config';

type ScanMetadata = {
  scanned_at?: string | null;
  source?: {
    last_verified?: string | null;
  } | null;
  cve_range?: {
    from?: string | null;
    to?: string | null;
  } | null;
};

type DBManifest = {
  generated_at?: string;
  scan_metadata?: ScanMetadata;
};

function formatUtcDate(value: string | null | undefined, locale: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'UTC'
  }).format(date)} UTC`;
}

export function DBScanSidebarInfo() {
  const tCommon = useTranslations('common');
  const tSidebar = useTranslations('sidebar');
  const locale = useLocale();
  const { state } = useSidebar();
  const [manifest, setManifest] = useState<DBManifest | null>(null);

  useEffect(() => {
    let active = true;
    fetch(DB_MANIFEST_URL, { cache: 'no-cache' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: DBManifest | null) => {
        if (active) setManifest(data);
      })
      .catch(() => {
        if (active) setManifest(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const scanDate = useMemo(() => {
    return (
      manifest?.scan_metadata?.source?.last_verified ??
      manifest?.scan_metadata?.scanned_at ??
      manifest?.generated_at
    );
  }, [manifest]);

  const rangeFrom = manifest?.scan_metadata?.cve_range?.from;
  const rangeTo = manifest?.scan_metadata?.cve_range?.to;
  const rangeFromLabel = rangeFrom ?? tSidebar('scanUnavailable');
  const rangeToLabel = rangeTo ?? tSidebar('scanUnavailable');

  return (
    <SidebarMenuButton
      size='lg'
      tooltip={tSidebar('scanStatus')}
      className='h-auto min-h-20 cursor-default items-start py-3 data-[state=open]:bg-sidebar-accent/30'
      data-tour='scan-info'
      aria-label={tSidebar('scanStatus')}
    >
      <div
        className={`grid flex-1 gap-0.5 text-left text-xs leading-tight transition-all duration-200 ease-in-out ${
          state === 'collapsed'
            ? 'invisible max-w-0 overflow-hidden opacity-0'
            : 'visible max-w-full opacity-100'
        }`}
      >
        <span className='truncate text-sm font-semibold'>
          {tSidebar('scanStatus')}
        </span>
        <span className='text-muted-foreground'>
          {tCommon('lastScan')}: {formatUtcDate(scanDate, locale)}
        </span>
        <span className='text-muted-foreground'>
          {tCommon('cveStart')}: {rangeFromLabel}
        </span>
        <span className='text-muted-foreground'>
          {tCommon('cveEnd')}: {rangeToLabel}
        </span>
      </div>
    </SidebarMenuButton>
  );
}
