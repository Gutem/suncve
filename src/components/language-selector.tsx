'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { SidebarMenuButton, useSidebar } from '@/components/ui/sidebar';
import { IconLanguage, IconCheck } from '@tabler/icons-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { locales, localeNames, type Locale } from '@/i18n/config';

export function LanguageSelector() {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const { isMobile, state } = useSidebar();
  const [isPending, startTransition] = useTransition();

  const handleLocaleChange = (newLocale: Locale) => {
    startTransition(() => {
      document.cookie = `locale=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}`;
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size='lg'
          className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
          tooltip={t('language')}
          disabled={isPending}
          data-tour='language'
        >
          <div className='bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg'>
            <IconLanguage className='size-4' />
          </div>
          <div
            className={`grid flex-1 text-left text-sm leading-tight transition-all duration-200 ease-in-out ${
              state === 'collapsed'
                ? 'invisible max-w-0 overflow-hidden opacity-0'
                : 'visible max-w-full opacity-100'
            }`}
          >
            <span className='truncate font-semibold'>{t('language')}</span>
            <span className='text-muted-foreground truncate text-xs'>
              {localeNames[locale as Locale]}
            </span>
          </div>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className='w-56 rounded-lg'
        side={isMobile ? 'bottom' : 'right'}
        align='end'
        sideOffset={4}
      >
        <DropdownMenuLabel>{t('selectLanguage')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => handleLocaleChange(loc)}
            className='gap-2'
            disabled={isPending}
          >
            {localeNames[loc]}
            {locale === loc && <IconCheck className='ml-auto size-4' />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
