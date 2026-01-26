'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  IconExternalLink,
  IconBrandGithub,
  IconStar,
  IconCode,
  IconCalendar,
  IconTag,
  IconCopy,
  IconCheck,
  IconBug,
  IconGitCommit,
  IconSkull,
  IconFolder
} from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  getSeverityFromScore,
  getSeverityColor,
  type CVESearchResult
} from '@/features/search/types';
import { cn } from '@/lib/utils';

interface RepoDetailDrawerProps {
  repository: Record<string, unknown> | null;
  isOpen: boolean;
  onClose: () => void;
}

export function RepoDetailDrawer({
  repository,
  isOpen,
  onClose
}: RepoDetailDrawerProps) {
  const t = useTranslations('repositories.detail');
  const [copied, setCopied] = useState(false);

  if (!repository) return null;

  // Extract and type repository fields
  const fullpath = repository.fullpath as string;
  const name = repository.name as string | null;
  const stars = (repository.stars as number) ?? 0;
  const size = repository.size as number | null;
  const languageMain = repository.languageMain as string | null;
  const commitsFixCount = (repository.commits_fix_count as number) ?? 0;
  const createdRepository = repository.created_repository as string | null;
  const updatedRepository = repository.updated_repository as string | null;

  const languages = parseJSON<Record<string, number>>(
    repository.languages as string
  );
  const tags = parseJSON<string[]>(repository.tags as string) ?? [];
  const cves = (repository.cves as CVESearchResult[]) ?? [];
  const cveCount = (repository.cve_count as number) ?? 0;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullpath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatSize = (sizeKB: number | null): string => {
    if (!sizeKB) return '—';
    if (sizeKB >= 1024 * 1024) {
      return `${(sizeKB / (1024 * 1024)).toFixed(1)} GB`;
    }
    if (sizeKB >= 1024) {
      return `${(sizeKB / 1024).toFixed(1)} MB`;
    }
    return `${sizeKB} KB`;
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className='w-full overflow-hidden p-0 sm:max-w-[90vw] md:max-w-3xl lg:max-w-4xl'>
        <ScrollArea className='h-full'>
          <div className='space-y-6 p-6'>
            {/* Header */}
            <SheetHeader className='space-y-4'>
              <div className='flex items-start justify-between gap-4'>
                <div className='min-w-0 flex-1'>
                  <SheetTitle className='flex items-center gap-2 text-xl'>
                    <IconBrandGithub className='h-6 w-6 shrink-0' />
                    <span className='truncate'>
                      {name || fullpath.split('/').pop()}
                    </span>
                  </SheetTitle>
                  <div className='mt-2 flex items-center gap-2'>
                    <code className='bg-muted text-muted-foreground truncate rounded px-2 py-1 text-sm'>
                      {fullpath}
                    </code>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-8 w-8 shrink-0'
                      onClick={handleCopy}
                    >
                      {copied ? (
                        <IconCheck className='h-4 w-4 text-green-500' />
                      ) : (
                        <IconCopy className='h-4 w-4' />
                      )}
                    </Button>
                  </div>
                </div>
                <Button variant='outline' size='sm' asChild>
                  <a
                    href={`https://github.com/${fullpath}`}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    <IconExternalLink className='mr-1 h-4 w-4' />
                    GitHub
                  </a>
                </Button>
              </div>
            </SheetHeader>

            {/* Quick Stats */}
            <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
              <Card>
                <CardContent className='flex items-center gap-2 p-3'>
                  <IconStar className='h-4 w-4 shrink-0 text-yellow-500' />
                  <div className='min-w-0'>
                    <p className='truncate text-lg font-bold sm:text-2xl'>
                      {stars.toLocaleString()}
                    </p>
                    <p className='text-muted-foreground text-xs'>
                      {t('stars')}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className='flex items-center gap-2 p-3'>
                  <IconBug className='h-4 w-4 shrink-0 text-red-500' />
                  <div className='min-w-0'>
                    <p className='truncate text-lg font-bold sm:text-2xl'>
                      {cveCount}
                    </p>
                    <p className='text-muted-foreground text-xs'>{t('cves')}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className='flex items-center gap-2 p-3'>
                  <IconGitCommit className='h-4 w-4 shrink-0 text-green-500' />
                  <div className='min-w-0'>
                    <p className='truncate text-lg font-bold sm:text-2xl'>
                      {commitsFixCount}
                    </p>
                    <p className='text-muted-foreground text-xs'>
                      {t('fixes')}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className='flex items-center gap-2 p-3'>
                  <IconFolder className='h-4 w-4 shrink-0 text-blue-500' />
                  <div className='min-w-0'>
                    <p className='truncate text-lg font-bold sm:text-2xl'>
                      {formatSize(size)}
                    </p>
                    <p className='text-muted-foreground text-xs'>{t('size')}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Accordion Sections */}
            <Accordion
              type='multiple'
              defaultValue={['info', 'cves']}
              className='w-full'
            >
              {/* Repository Info */}
              <AccordionItem value='info'>
                <AccordionTrigger className='text-base font-semibold'>
                  <div className='flex items-center gap-2'>
                    <IconCode className='h-5 w-5' />
                    {t('repoInfo')}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className='space-y-4'>
                    {/* Main Language */}
                    {languageMain && (
                      <div>
                        <p className='text-muted-foreground mb-2 text-sm'>
                          {t('mainLanguage')}
                        </p>
                        <Badge variant='secondary' className='gap-1'>
                          <IconCode className='h-3 w-3' />
                          {languageMain}
                        </Badge>
                      </div>
                    )}

                    {/* Languages */}
                    {languages && Object.keys(languages).length > 0 && (
                      <div>
                        <p className='text-muted-foreground mb-2 text-sm'>
                          {t('languages')}
                        </p>
                        <div className='flex flex-wrap gap-2'>
                          {Object.entries(languages)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 10)
                            .map(([lang, percent]) => (
                              <Badge key={lang} variant='outline'>
                                {lang}:{' '}
                                {typeof percent === 'number'
                                  ? `${percent.toFixed(1)}%`
                                  : percent}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    {tags.length > 0 && (
                      <div>
                        <p className='text-muted-foreground mb-2 text-sm'>
                          {t('tags')}
                        </p>
                        <div className='flex flex-wrap gap-2'>
                          {tags.slice(0, 20).map((tag) => (
                            <Badge key={tag} variant='secondary'>
                              <IconTag className='mr-1 h-3 w-3' />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dates */}
                    <div className='grid gap-4 sm:grid-cols-2'>
                      {createdRepository && (
                        <div>
                          <p className='text-muted-foreground mb-1 text-sm'>
                            {t('created')}
                          </p>
                          <div className='flex items-center gap-2'>
                            <IconCalendar className='text-muted-foreground h-4 w-4' />
                            <span>
                              {new Date(createdRepository).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      )}
                      {updatedRepository && (
                        <div>
                          <p className='text-muted-foreground mb-1 text-sm'>
                            {t('updated')}
                          </p>
                          <div className='flex items-center gap-2'>
                            <IconCalendar className='text-muted-foreground h-4 w-4' />
                            <span>
                              {new Date(updatedRepository).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* CVEs */}
              {cveCount > 0 && (
                <AccordionItem value='cves'>
                  <AccordionTrigger className='text-base font-semibold'>
                    <div className='flex items-center gap-2'>
                      <IconBug className='h-5 w-5 text-red-500' />
                      {t('relatedCVEs')}
                      <Badge variant='destructive' className='ml-2'>
                        {cveCount}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className='overflow-x-auto rounded-lg border'>
                      <Table className='min-w-[500px]'>
                        <TableHeader>
                          <TableRow>
                            <TableHead className='min-w-[200px]'>
                              {t('cveId')}
                            </TableHead>
                            <TableHead className='w-[80px]'>
                              {t('score')}
                            </TableHead>
                            <TableHead className='w-[80px]'>
                              {t('flags')}
                            </TableHead>
                            <TableHead className='w-[100px]'>
                              {t('published')}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cves.map((cve) => {
                            const severity = getSeverityFromScore(
                              cve.max_score ?? 0
                            );
                            return (
                              <TableRow key={cve.cve_id}>
                                <TableCell>
                                  <a
                                    href={`https://nvd.nist.gov/vuln/detail/${cve.cve_id}`}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='font-mono text-sm font-medium hover:underline'
                                  >
                                    {cve.cve_id}
                                  </a>
                                  {cve.title && (
                                    <p className='text-muted-foreground mt-1 line-clamp-1 text-xs'>
                                      {cve.title}
                                    </p>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {cve.max_score !== null ? (
                                    <Badge
                                      className={cn(
                                        'font-mono',
                                        getSeverityColor(severity)
                                      )}
                                    >
                                      {cve.max_score.toFixed(1)}
                                    </Badge>
                                  ) : (
                                    <span className='text-muted-foreground'>
                                      —
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className='flex gap-1'>
                                    {cve.exists_exploit && (
                                      <Badge
                                        variant='destructive'
                                        className='gap-1'
                                      >
                                        <IconSkull className='h-3 w-3' />
                                      </Badge>
                                    )}
                                    {cve.exists_commit && (
                                      <Badge
                                        variant='secondary'
                                        className='gap-1 bg-green-500/20 text-green-700 dark:text-green-400'
                                      >
                                        <IconGitCommit className='h-3 w-3' />
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className='text-muted-foreground text-sm'>
                                  {cve.date_published
                                    ? new Date(
                                        cve.date_published
                                      ).toLocaleDateString()
                                    : '—'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// Helper function
function parseJSON<T>(json: string | null | undefined): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
