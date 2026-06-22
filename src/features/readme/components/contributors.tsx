'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { IconBrandGithub, IconLoader2, IconHeart } from '@tabler/icons-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const REPO = 'sunsecrn/suncve';
const CONTRIBUTORS_URL = `https://api.github.com/repos/${REPO}/contributors?per_page=100`;
const REPO_URL = `https://github.com/${REPO}`;

interface Contributor {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
  type: string;
}

type Status = 'loading' | 'success' | 'error';

export function Contributors() {
  const t = useTranslations('readme.contributors');
  const [status, setStatus] = useState<Status>('loading');
  const [contributors, setContributors] = useState<Contributor[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(CONTRIBUTORS_URL, {
          headers: { Accept: 'application/vnd.github+json' }
        });
        if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
        const data: Contributor[] = await res.json();
        if (cancelled) return;
        // Keep only real users (filter out bots) and sort by contributions
        const people = data
          .filter((c) => c.type !== 'Bot')
          .sort((a, b) => b.contributions - a.contributions);
        setContributors(people);
        setStatus('success');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'loading') {
    return (
      <div className='text-muted-foreground flex items-center justify-center gap-2 py-10'>
        <IconLoader2 className='size-5 animate-spin' />
        <span>{t('loading')}</span>
      </div>
    );
  }

  if (status === 'error' || contributors.length === 0) {
    return (
      <Card className='flex flex-col items-center gap-3 p-8 text-center'>
        <div className='rounded-full bg-red-500/10 p-3'>
          <IconBrandGithub className='size-6 text-red-500' />
        </div>
        <div className='font-medium'>{t('errorTitle')}</div>
        <p className='text-muted-foreground max-w-md text-sm'>{t('errorText')}</p>
        <Button variant='outline' asChild size='sm'>
          <a href={REPO_URL} target='_blank' rel='noopener noreferrer'>
            <IconBrandGithub className='mr-2 size-4' />
            {t('viewOnGithub')}
          </a>
        </Button>
      </Card>
    );
  }

  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4'>
        {contributors.map((c) => (
          <a
            key={c.id}
            href={c.html_url}
            target='_blank'
            rel='noopener noreferrer'
            className='group block'
          >
            <Card className='hover:border-primary/40 flex flex-col items-center gap-3 p-4 transition-colors'>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.avatar_url}
                alt={c.login}
                width={64}
                height={64}
                loading='lazy'
                className='border-border size-16 rounded-full border transition-transform duration-300 group-hover:scale-105'
              />
              <div className='flex flex-col items-center gap-1 text-center'>
                <span className='group-hover:text-primary max-w-full truncate text-sm font-medium'>
                  {c.login}
                </span>
                <Badge variant='outline' className='text-xs'>
                  {c.contributions} {t('contributions')}
                </Badge>
              </div>
            </Card>
          </a>
        ))}
      </div>
      <p className='text-muted-foreground flex items-center justify-center gap-2 text-sm'>
        <IconHeart className='size-4 text-red-500' />
        {t('thanks')}
      </p>
    </div>
  );
}
