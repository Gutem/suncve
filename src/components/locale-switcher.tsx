'use client';

import { useEffect, useState, ReactNode, useRef } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { locales, defaultLocale, type Locale } from '@/i18n/config';

// Import all messages statically for client-side switching
import ptBRMessages from '@/i18n/messages/pt-BR.json';
import enMessages from '@/i18n/messages/en.json';

type Messages = Record<string, unknown>;

const messagesMap: Record<Locale, Messages> = {
  'pt-BR': ptBRMessages,
  en: enMessages
};

interface LocaleSwitcherProps {
  children: ReactNode;
  serverMessages: Messages;
  serverLocale: Locale;
}

export function LocaleSwitcher({
  children,
  serverMessages,
  serverLocale
}: LocaleSwitcherProps) {
  // Start with server values to avoid hydration mismatch
  const [locale, setLocale] = useState<Locale>(serverLocale);
  const [messages, setMessages] = useState<Messages>(serverMessages);
  const hasCheckedStorage = useRef(false);

  useEffect(() => {
    // Only check localStorage once after hydration
    if (hasCheckedStorage.current) return;
    hasCheckedStorage.current = true;

    const savedLocale = localStorage.getItem('locale') as Locale | null;

    // Only update if localStorage has a different valid locale
    if (
      savedLocale &&
      locales.includes(savedLocale) &&
      savedLocale !== serverLocale
    ) {
      setLocale(savedLocale);
      setMessages(messagesMap[savedLocale]);
    }
  }, [serverLocale]);

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone='America/Sao_Paulo'
    >
      {children}
    </NextIntlClientProvider>
  );
}
