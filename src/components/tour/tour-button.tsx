'use client';

import { IconHelpCircle } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { useTour } from './tour-provider';
import { useTranslations } from 'next-intl';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

export function TourButton() {
  const { startTour, isTouring } = useTour();
  const t = useTranslations('tour');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='ghost'
            size='icon'
            onClick={startTour}
            disabled={isTouring}
            className='h-9 w-9'
          >
            <IconHelpCircle className='h-5 w-5' />
            <span className='sr-only'>{t('startTour')}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('startTour')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
