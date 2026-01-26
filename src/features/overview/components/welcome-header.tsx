'use client';

import { useTranslations } from 'next-intl';

export function WelcomeHeader() {
  const t = useTranslations('dashboard');

  return (
    <div className='flex items-center justify-between space-y-2'>
      <h2 className='text-2xl font-bold tracking-tight'>{t('welcome')}</h2>
    </div>
  );
}
