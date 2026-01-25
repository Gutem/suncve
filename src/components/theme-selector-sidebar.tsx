'use client';

import { useThemeConfig } from '@/components/active-theme';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { SidebarMenuButton, useSidebar } from '@/components/ui/sidebar';
import { IconPalette, IconCheck } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

const DEFAULT_THEMES = [
  { nameKey: 'default', value: 'default' },
  { nameKey: 'blue', value: 'blue' },
  { nameKey: 'green', value: 'green' },
  { nameKey: 'amber', value: 'amber' }
];

const SCALED_THEMES = [
  { nameKey: 'defaultScaled', value: 'default-scaled' },
  { nameKey: 'blueScaled', value: 'blue-scaled' }
];

const MONO_THEMES = [{ nameKey: 'mono', value: 'mono-scaled' }];

const ALL_THEMES = [...DEFAULT_THEMES, ...SCALED_THEMES, ...MONO_THEMES];

export function ThemeSelectorSidebar() {
  const { activeTheme, setActiveTheme } = useThemeConfig();
  const { isMobile, state } = useSidebar();
  const t = useTranslations('common');
  const tThemes = useTranslations('themes');

  const currentTheme = ALL_THEMES.find((theme) => theme.value === activeTheme);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size='lg'
          className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
          tooltip={t('theme')}
          data-tour='theme-selector'
        >
          <div className='bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg'>
            <IconPalette className='size-4' />
          </div>
          <div
            className={`grid flex-1 text-left text-sm leading-tight transition-all duration-200 ease-in-out ${
              state === 'collapsed'
                ? 'invisible max-w-0 overflow-hidden opacity-0'
                : 'visible max-w-full opacity-100'
            }`}
          >
            <span className='truncate font-semibold'>{t('theme')}</span>
            <span className='text-muted-foreground truncate text-xs'>
              {currentTheme
                ? tThemes(currentTheme.nameKey)
                : tThemes('default')}
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
        <DropdownMenuLabel>{t('selectTheme')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className='text-muted-foreground text-xs'>
            {t('default')}
          </DropdownMenuLabel>
          {DEFAULT_THEMES.map((theme) => (
            <DropdownMenuItem
              key={theme.value}
              onClick={() => setActiveTheme(theme.value)}
              className='gap-2'
            >
              {tThemes(theme.nameKey)}
              {activeTheme === theme.value && (
                <IconCheck className='ml-auto size-4' />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className='text-muted-foreground text-xs'>
            {t('scaled')}
          </DropdownMenuLabel>
          {SCALED_THEMES.map((theme) => (
            <DropdownMenuItem
              key={theme.value}
              onClick={() => setActiveTheme(theme.value)}
              className='gap-2'
            >
              {tThemes(theme.nameKey)}
              {activeTheme === theme.value && (
                <IconCheck className='ml-auto size-4' />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel className='text-muted-foreground text-xs'>
            {t('monospace')}
          </DropdownMenuLabel>
          {MONO_THEMES.map((theme) => (
            <DropdownMenuItem
              key={theme.value}
              onClick={() => setActiveTheme(theme.value)}
              className='gap-2'
            >
              {tThemes(theme.nameKey)}
              {activeTheme === theme.value && (
                <IconCheck className='ml-auto size-4' />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
