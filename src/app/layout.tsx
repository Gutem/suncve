import Providers from '@/components/layout/providers';
import { Toaster } from '@/components/ui/sonner';
import { fontVariables } from '@/lib/font';
import ThemeProvider from '@/components/layout/ThemeToggle/theme-provider';
import { cn } from '@/lib/utils';
import type { Metadata, Viewport } from 'next';
import NextTopLoader from 'nextjs-toploader';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { defaultLocale } from '@/i18n/config';
import ptBRMessages from '@/i18n/messages/pt-BR.json';
import './globals.css';
import './theme.css';
import './tour.css';

const META_THEME_COLORS = {
  light: '#ffffff',
  dark: '#09090b'
};

export const metadata: Metadata = {
  title: 'SunCVE',
  description: 'SunCVE Dashboard'
};

export const viewport: Viewport = {
  themeColor: META_THEME_COLORS.light
};

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  // For static export, always use default locale on server
  // Client-side LocaleSwitcher will handle locale switching
  const locale = defaultLocale;
  const messages = ptBRMessages;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                // Theme color
                if (localStorage.theme === 'dark' || ((!('theme' in localStorage) || localStorage.theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.querySelector('meta[name="theme-color"]').setAttribute('content', '${META_THEME_COLORS.dark}')
                }
              } catch (_) {}
            `
          }}
        />
      </head>
      <body
        className={cn(
          'bg-background overflow-hidden overscroll-none font-sans antialiased',
          fontVariables
        )}
      >
        <NextTopLoader color='var(--primary)' showSpinner={false} />
        <NuqsAdapter>
          <LocaleSwitcher
            serverMessages={messages as Record<string, unknown>}
            serverLocale={locale as 'pt-BR' | 'en'}
          >
            <ThemeProvider
              attribute='class'
              defaultTheme='system'
              enableSystem
              disableTransitionOnChange
              enableColorScheme
            >
              <Providers>
                <Toaster />
                {children}
              </Providers>
            </ThemeProvider>
          </LocaleSwitcher>
        </NuqsAdapter>
      </body>
    </html>
  );
}
