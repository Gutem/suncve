'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
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

// Loading overlay component
function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className='bg-background/80 fixed inset-0 z-[100000] flex items-center justify-center backdrop-blur-sm'>
      <div className='bg-card flex flex-col items-center gap-4 rounded-xl border-2 p-8 shadow-lg'>
        <div className='relative'>
          <div className='border-primary/30 border-t-primary h-12 w-12 animate-spin rounded-full border-4' />
        </div>
        <p className='text-foreground text-lg font-medium'>{message}</p>
      </div>
    </div>
  );
}

// Wait for element to appear in DOM
function waitForElement(
  selector: string,
  timeout = 10000
): Promise<Element | null> {
  return new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Timeout fallback
    setTimeout(() => {
      observer.disconnect();
      resolve(document.querySelector(selector));
    }, timeout);
  });
}

// Close CVE Details drawer - works on all devices
function closeCveDrawer() {
  // Method 1: Try clicking the Sheet's close button (X icon in top-right)
  const closeButton = document.querySelector(
    '[data-tour="cve-details"] button[data-slot="sheet-close"], [data-tour="cve-details"] + button, [data-state="open"] > button'
  ) as HTMLElement;
  if (closeButton) {
    closeButton.click();
    return;
  }

  // Method 2: Try clicking the Sheet overlay to close
  const overlay = document.querySelector(
    '[data-slot="sheet-overlay"]'
  ) as HTMLElement;
  if (overlay) {
    overlay.click();
    return;
  }

  // Method 3: Dispatch ESC key to close any open dialogs/sheets
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true
    })
  );
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isTouring, setIsTouring] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const t = useTranslations('tour');
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const driverRef = useRef<Driver | null>(null);

  const initializeTour = useCallback(() => {
    /*
     * TOUR FLOW (storytelling):
     * 0. Menu (sidebar)
     * 1. Botão Dashboard no menu (sidebar)
     * 2. Status do scan (sidebar)
     * 3. Stats cards (dashboard content)
     * 4. Charts (dashboard content)
     * 5. Botão Busca de CVE no menu (sidebar)
     * 6. Busca de CVE (search page content)
     * 7. Filtros (search page content)
     * 8. Stats (search page content)
     * 9. Resultados (search page content)
     * 10. CVE Details (drawer - clica na primeira linha)
     * 11. Idioma (sidebar)
     * 12. Tema (sidebar)
     * 13. Busca rápida (content)
     * 14. Botão claro/escuro (content)
     */

    // Steps que precisam do sidebar visível (mobile)
    const sidebarStepIndices = [0, 1, 2, 5, 11, 12];

    // Navegação entre páginas
    const navDashboardStep = 1;
    const firstDashboardContentStep = 3;
    const navCveSearchStep = 5;
    const firstCveSearchStep = 6;
    const cveResultsStep = 9;
    const cveDetailsStep = 10;

    const progressOf = t('buttons.progressOf');

    const driverObj = driver({
      showProgress: true,
      steps: [
        // === INTRO: SIDEBAR (0, 1) ===
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
          element: '[data-tour="nav-dashboard"]',
          popover: {
            title: t('navDashboard.title'),
            description: t('navDashboard.description'),
            side: 'right',
            align: 'center'
          }
        },
        {
          element: '[data-tour="scan-info"]',
          popover: {
            title: t('scanInfo.title'),
            description: t('scanInfo.description'),
            side: 'right',
            align: 'center'
          }
        },
        // === DASHBOARD CONTENT (2, 3) ===
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
        },
        // === NAV TO CVE SEARCH (4) ===
        {
          element: '[data-tour="nav-cve-search"]',
          popover: {
            title: t('navCveSearch.title'),
            description: t('navCveSearch.description'),
            side: 'right',
            align: 'center'
          }
        },
        // === CVE SEARCH CONTENT (5, 6, 7, 8) ===
        {
          element: '[data-tour="cve-search"]',
          popover: {
            title: t('cveSearch.title'),
            description: t('cveSearch.description'),
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '[data-tour="cve-filters"]',
          popover: {
            title: t('cveFilters.title'),
            description: t('cveFilters.description'),
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '[data-tour="cve-stats"]',
          popover: {
            title: t('cveStats.title'),
            description: t('cveStats.description'),
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '[data-tour="cve-results"]',
          popover: {
            title: t('cveResults.title'),
            description: t('cveResults.description'),
            side: 'top',
            align: 'center'
          }
        },
        // === CVE DETAILS (9) ===
        {
          element: '[data-tour="cve-details"]',
          popover: {
            title: t('cveDetails.title'),
            description: t('cveDetails.description'),
            side: 'left',
            align: 'start'
          }
        },
        // === FINAL SIDEBAR (10, 11) ===
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
        // === FINAL CONTENT (11, 12) ===
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
        }
      ],
      nextBtnText: t('buttons.next'),
      prevBtnText: t('buttons.prev'),
      doneBtnText: t('buttons.done'),
      progressText: `{{current}} ${progressOf} {{total}}`,
      onNextClick: () => {
        const currentIndex = driverObj.getActiveIndex() ?? 0;
        const nextIndex = currentIndex + 1;

        // Close CVE Details drawer first if we're leaving that step
        if (currentIndex === cveDetailsStep) {
          closeCveDrawer();
          // On mobile, also need to open sidebar for next step
          if (isMobile) {
            setTimeout(() => {
              setOpenMobile(true);
              setTimeout(() => driverObj.moveNext(), 350);
            }, 300);
          } else {
            setTimeout(() => driverObj.moveNext(), 400);
          }
          return;
        }

        // Mobile sidebar transitions
        if (isMobile) {
          const currentNeedsSidebar = sidebarStepIndices.includes(currentIndex);
          const nextNeedsSidebar = sidebarStepIndices.includes(nextIndex);

          // Close sidebar before content steps
          if (currentNeedsSidebar && !nextNeedsSidebar) {
            setOpenMobile(false);
            setTimeout(() => {
              // Check if we also need to navigate
              if (currentIndex === navDashboardStep) {
                router.push('/dashboard/overview');
                setTimeout(() => driverObj.moveNext(), 500);
              } else if (currentIndex === navCveSearchStep) {
                setIsNavigating(true);
                router.push('/dashboard/search');
                waitForElement('[data-tour="cve-search"]', 15000).then(() => {
                  setIsNavigating(false);
                  setTimeout(() => driverObj.moveNext(), 300);
                });
              } else {
                driverObj.moveNext();
              }
            }, 350);
            return;
          }

          // Open sidebar before sidebar steps
          if (!currentNeedsSidebar && nextNeedsSidebar) {
            setOpenMobile(true);
            setTimeout(() => driverObj.moveNext(), 350);
            return;
          }
        }

        // Desktop: Navigate to dashboard after nav-dashboard step
        if (
          currentIndex === navDashboardStep &&
          nextIndex === firstDashboardContentStep
        ) {
          router.push('/dashboard/overview');
          setTimeout(() => driverObj.moveNext(), 500);
          return;
        }

        // Desktop: Navigate to CVE search after nav-cve-search step
        if (
          currentIndex === navCveSearchStep &&
          nextIndex === firstCveSearchStep
        ) {
          setIsNavigating(true);
          router.push('/dashboard/search');
          waitForElement('[data-tour="cve-search"]', 15000).then(() => {
            setIsNavigating(false);
            setTimeout(() => driverObj.moveNext(), 300);
          });
          return;
        }

        // Click first row to open CVE Details drawer
        if (currentIndex === cveResultsStep && nextIndex === cveDetailsStep) {
          const firstRow = document.querySelector(
            '[data-tour="cve-first-row"]'
          ) as HTMLElement;
          if (firstRow) {
            firstRow.click();
            // Wait for drawer to open
            waitForElement('[data-tour="cve-details"]', 5000).then(() => {
              setTimeout(() => driverObj.moveNext(), 300);
            });
            return;
          }
        }

        driverObj.moveNext();
      },
      onPrevClick: () => {
        const currentIndex = driverObj.getActiveIndex() ?? 0;
        const prevIndex = currentIndex - 1;

        // Mobile sidebar transitions
        if (isMobile) {
          const currentNeedsSidebar = sidebarStepIndices.includes(currentIndex);
          const prevNeedsSidebar = sidebarStepIndices.includes(prevIndex);

          // Open sidebar before going back to sidebar steps
          if (!currentNeedsSidebar && prevNeedsSidebar) {
            setOpenMobile(true);
            setTimeout(() => {
              // Check if we also need to navigate
              if (prevIndex === navCveSearchStep) {
                router.push('/dashboard/overview');
                setTimeout(() => driverObj.movePrevious(), 500);
              } else if (prevIndex === navDashboardStep) {
                driverObj.movePrevious();
              } else {
                driverObj.movePrevious();
              }
            }, 350);
            return;
          }

          // Close sidebar before content steps
          if (currentNeedsSidebar && !prevNeedsSidebar) {
            setOpenMobile(false);
            setTimeout(() => driverObj.movePrevious(), 350);
            return;
          }
        }

        // Close CVE Details drawer when going back from it
        if (currentIndex === cveDetailsStep && prevIndex === cveResultsStep) {
          closeCveDrawer();
          setTimeout(() => driverObj.movePrevious(), 400);
          return;
        }

        // Desktop: Navigate back to dashboard when going from CVE search to nav button
        if (
          currentIndex === firstCveSearchStep &&
          prevIndex === navCveSearchStep
        ) {
          router.push('/dashboard/overview');
          setTimeout(() => driverObj.movePrevious(), 500);
          return;
        }

        driverObj.movePrevious();
      },
      onDestroyStarted: () => {
        if (isMobile) {
          setOpenMobile(false);
        }
        // Close CVE Details drawer if open
        closeCveDrawer();
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
  }, [t, isMobile, setOpenMobile, router]);

  const startTour = useCallback(() => {
    setIsTouring(true);

    // Se não estiver no dashboard, navega primeiro
    const isOnDashboard = pathname === '/dashboard/overview';

    if (!isOnDashboard) {
      router.push('/dashboard/overview');
      // Aguarda a navegação antes de iniciar o tour
      setTimeout(() => {
        initializeTour();
      }, 500);
    } else {
      initializeTour();
    }
  }, [pathname, router, initializeTour]);

  return (
    <TourContext.Provider value={{ startTour, isTouring }}>
      {children}
      {isNavigating && <LoadingOverlay message={t('loading')} />}
    </TourContext.Provider>
  );
}
