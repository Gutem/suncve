'use client';
import { useKBar } from 'kbar';
import { IconSearch } from '@tabler/icons-react';
import { Button } from './ui/button';
import { useTranslations } from 'next-intl';

export default function SearchInput() {
  const { query } = useKBar();
  const t = useTranslations('common');

  return (
    <Button
      variant='outline'
      className='bg-background text-muted-foreground relative h-9 w-9 justify-start rounded-[0.5rem] text-sm font-normal shadow-none sm:w-40 sm:pr-12 lg:w-64'
      onClick={query.toggle}
    >
      <IconSearch className='h-4 w-4 sm:mr-2' />
      <span className='hidden sm:inline'>{t('search')}</span>
      <kbd className='bg-muted pointer-events-none absolute top-[0.3rem] right-[0.3rem] hidden h-6 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 select-none sm:flex'>
        <span className='text-xs'>⌘</span>K
      </kbd>
    </Button>
  );
}
