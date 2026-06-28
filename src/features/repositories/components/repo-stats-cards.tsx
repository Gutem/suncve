'use client';

import { useTranslations } from 'next-intl';
import {
  IconBrandGithub,
  IconBug,
  IconGitCommit,
  IconTrendingUp
} from '@tabler/icons-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardFooter
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface RepoStatsCardsProps {
  stats: {
    totalRepos: number;
    withCVEs: number;
    withCommitFix: number;
  };
}

export function RepoStatsCards({ stats }: RepoStatsCardsProps) {
  const t = useTranslations('repositories.stats');

  // Calculate percentages
  const cvePercent =
    stats.totalRepos > 0
      ? ((stats.withCVEs / stats.totalRepos) * 100).toFixed(1)
      : '0';
  const fixPercent =
    stats.totalRepos > 0
      ? ((stats.withCommitFix / stats.totalRepos) * 100).toFixed(1)
      : '0';

  return (
    <div className='*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-2 gap-3 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs sm:gap-4 lg:grid-cols-3'>
      <Card className='@container/card'>
        <CardHeader className='p-4 pb-2 sm:p-6 sm:pb-2'>
          <CardDescription className='text-xs sm:text-sm'>
            {t('totalRepos')}
          </CardDescription>
          <CardTitle className='text-xl font-semibold tabular-nums sm:text-2xl @[250px]/card:text-3xl'>
            {stats.totalRepos.toLocaleString()}
          </CardTitle>
          <CardAction>
            <div className='rounded-full bg-purple-500/10 p-1.5 sm:p-2'>
              <IconBrandGithub className='h-4 w-4 text-purple-500 sm:h-5 sm:w-5' />
            </div>
          </CardAction>
        </CardHeader>
        <CardFooter className='flex-col items-start gap-1 p-4 pt-0 text-xs sm:gap-1.5 sm:p-6 sm:pt-0 sm:text-sm'>
          <div className='line-clamp-1 flex gap-2 font-medium'>
            {t('repositories')}
          </div>
          <div className='text-muted-foreground hidden sm:block'>
            {t('inDatabase')}
          </div>
        </CardFooter>
      </Card>

      <Card className='@container/card'>
        <CardHeader className='p-4 pb-2 sm:p-6 sm:pb-2'>
          <CardDescription className='text-xs sm:text-sm'>
            {t('withCVEs')}
          </CardDescription>
          <CardTitle className='text-xl font-semibold tabular-nums sm:text-2xl @[250px]/card:text-3xl'>
            {stats.withCVEs.toLocaleString()}
          </CardTitle>
          <CardAction>
            <Badge
              variant='outline'
              className='border-red-500/50 text-xs text-red-500'
            >
              {cvePercent}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className='flex-col items-start gap-1 p-4 pt-0 text-xs sm:gap-1.5 sm:p-6 sm:pt-0 sm:text-sm'>
          <div className='line-clamp-1 flex gap-2 font-medium text-red-500'>
            <IconBug className='size-3 sm:size-4' />
            {t('linkedCVEs')}
          </div>
          <div className='text-muted-foreground hidden sm:block'>
            {t('vulnerableRepos')}
          </div>
        </CardFooter>
      </Card>

      <Card className='@container/card'>
        <CardHeader className='p-4 pb-2 sm:p-6 sm:pb-2'>
          <CardDescription className='text-xs sm:text-sm'>
            {t('withCommitFix')}
          </CardDescription>
          <CardTitle className='text-xl font-semibold tabular-nums sm:text-2xl @[250px]/card:text-3xl'>
            {stats.withCommitFix.toLocaleString()}
          </CardTitle>
          <CardAction>
            <Badge
              variant='outline'
              className='border-green-500/50 text-xs text-green-500'
            >
              <IconTrendingUp className='mr-1 size-3' />
              {fixPercent}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className='flex-col items-start gap-1 p-4 pt-0 text-xs sm:gap-1.5 sm:p-6 sm:pt-0 sm:text-sm'>
          <div className='line-clamp-1 flex gap-2 font-medium text-green-500'>
            <IconGitCommit className='size-3 sm:size-4' />
            {t('patchCommits')}
          </div>
          <div className='text-muted-foreground hidden sm:block'>
            {t('withFixes')}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
