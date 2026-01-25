'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef
} from 'react';
import { driver, Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useTranslations } from 'next-intl';
import { useSidebar } from '@/components/ui/sidebar';

interface TourContextType {
  startTour: () => void;
  isTouring: boolean;
}

const TourContext = createContext<TourContextType | null>(null);

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isTouring, setIsTouring] = useState(false);
  const t = useTranslations('tour');
  const { isMobile, setOpenMobile } = useSidebar();
  const driverRef = useRef<Driver | null>(null);

  const startTour = useCallback(() => {
    setIsTouring(true);

    // Steps reorganizados: primeiro todos do sidebar, depois os do conteúdo
    // Índices que precisam sidebar: 0, 1, 2
    const sidebarStepIndices = [0, 1, 2];

    const progressOf = t('buttons.progressOf');

    const driverObj = driver({
      showProgress: true,
      steps: [
        // === SIDEBAR STEPS (0, 1, 2) ===
        {
          element: '[data-tour="sidebar"]',
          popover: {
            title: t('sidebar.title'),
            description: t('sidebar.description'),
            side: 'right',
            align: 'start'
          }
        },
        {
          element: '[data-tour="language"]',
          popover: {
            title: t('language.title'),
            description: t('language.description'),
            side: 'right',
            align: 'center'
          }
        },
        {
          element: '[data-tour="theme-selector"]',
          popover: {
            title: t('themeSelector.title'),
            description: t('themeSelector.description'),
            side: 'right',
            align: 'center'
          }
        },
        // === CONTENT STEPS (3, 4, 5, 6) ===
        {
          element: '[data-tour="search"]',
          popover: {
            title: t('search.title'),
            description: t('search.description'),
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '[data-tour="theme-toggle"]',
          popover: {
            title: t('themeToggle.title'),
            description: t('themeToggle.description'),
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '[data-tour="stats-cards"]',
          popover: {
            title: t('statsCards.title'),
            description: t('statsCards.description'),
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '[data-tour="charts"]',
          popover: {
            title: t('charts.title'),
            description: t('charts.description'),
            side: 'top',
            align: 'center'
          }
        }
      ],
      nextBtnText: t('buttons.next'),
      prevBtnText: t('buttons.prev'),
      doneBtnText: t('buttons.done'),
      progressText: `{{current}} ${progressOf} {{total}}`,
      onNextClick: () => {
        const currentIndex = driverObj.getActiveIndex() ?? 0;
        const nextIndex = currentIndex + 1;

        if (isMobile) {
          const currentNeedsSidebar = sidebarStepIndices.includes(currentIndex);
          const nextNeedsSidebar = sidebarStepIndices.includes(nextIndex);

          if (currentNeedsSidebar && !nextNeedsSidebar) {
            // Fechando sidebar antes de ir para content
            setOpenMobile(false);
            setTimeout(() => {
              driverObj.moveNext();
            }, 350);
            return;
          }
        }

        driverObj.moveNext();
      },
      onPrevClick: () => {
        const currentIndex = driverObj.getActiveIndex() ?? 0;
        const prevIndex = currentIndex - 1;

        if (isMobile) {
          const currentNeedsSidebar = sidebarStepIndices.includes(currentIndex);
          const prevNeedsSidebar = sidebarStepIndices.includes(prevIndex);

          if (!currentNeedsSidebar && prevNeedsSidebar) {
            // Abrindo sidebar antes de voltar para sidebar steps
            setOpenMobile(true);
            setTimeout(() => {
              driverObj.movePrevious();
            }, 350);
            return;
          }
        }

        driverObj.movePrevious();
      },
      onDestroyStarted: () => {
        if (isMobile) {
          setOpenMobile(false);
        }
        setIsTouring(false);
        driverObj.destroy();
      }
    });

    driverRef.current = driverObj;

    // Abrir sidebar no mobile e aguardar antes de iniciar
    if (isMobile) {
      setOpenMobile(true);
      setTimeout(() => {
        driverObj.drive();
      }, 500);
    } else {
      driverObj.drive();
    }
  }, [t, isMobile, setOpenMobile]);

  return (
    <TourContext.Provider value={{ startTour, isTouring }}>
      {children}
    </TourContext.Provider>
  );
}
