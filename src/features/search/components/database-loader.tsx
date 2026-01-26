'use client';

import { useTranslations } from 'next-intl';
import {
  IconDatabase,
  IconRefresh,
  IconAlertCircle,
  IconLoader2
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import PageContainer from '@/components/layout/page-container';

interface DatabaseLoaderProps {
  isLoading: boolean;
  progress: number;
  error: string | null;
  onRetry: () => void;
}

export function DatabaseLoader({
  isLoading,
  progress,
  error,
  onRetry
}: DatabaseLoaderProps) {
  const t = useTranslations('search.loader');

  if (error) {
    return (
      <PageContainer>
        <div className='flex flex-1 items-center justify-center py-16'>
          <Card className='from-destructive/5 to-card w-full max-w-md bg-gradient-to-t shadow-lg'>
            <CardHeader className='pb-2 text-center'>
              <div className='bg-destructive/10 ring-destructive/20 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ring-4'>
                <IconAlertCircle className='text-destructive h-10 w-10' />
              </div>
              <CardTitle className='text-2xl font-semibold'>
                {t('errorTitle')}
              </CardTitle>
              <CardDescription className='text-destructive/80 mt-2 text-base'>
                {error}
              </CardDescription>
            </CardHeader>
            <CardFooter className='flex justify-center pt-4'>
              <Button onClick={onRetry} size='lg' className='rounded-xl px-8'>
                <IconRefresh className='mr-2 h-5 w-5' />
                {t('retry')}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className='flex flex-1 items-center justify-center py-16'>
        <Card className='from-primary/5 to-card w-full max-w-md bg-gradient-to-t shadow-lg'>
          <CardHeader className='pb-2 text-center'>
            <div className='bg-primary/10 ring-primary/20 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ring-4'>
              {isLoading ? (
                <IconLoader2 className='text-primary h-10 w-10 animate-spin' />
              ) : (
                <IconDatabase className='text-primary h-10 w-10 animate-pulse' />
              )}
            </div>
            <CardTitle className='text-2xl font-semibold'>
              {t('title')}
            </CardTitle>
            <CardDescription className='mt-2 text-base'>
              {isLoading ? t('downloading') : t('initializing')}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4 pt-4'>
            <div className='space-y-2'>
              <Progress value={progress} className='h-3 rounded-full' />
              <p className='text-center text-sm font-medium tabular-nums'>
                {progress}% {t('complete')}
              </p>
            </div>
          </CardContent>
          <CardFooter className='flex-col items-center gap-2 pt-2'>
            <p className='text-muted-foreground text-center text-sm'>
              {t('firstTimeNote')}
            </p>
          </CardFooter>
        </Card>
      </div>
    </PageContainer>
  );
}
