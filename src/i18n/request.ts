import { getRequestConfig } from 'next-intl/server';
import { defaultLocale } from './config';

export default getRequestConfig(async () => {
  // For static export, always use default locale on server
  // Client-side LocaleSwitcher will handle locale switching
  return {
    locale: defaultLocale,
    messages: (await import(`./messages/${defaultLocale}.json`)).default
  };
});
