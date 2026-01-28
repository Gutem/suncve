'use client';

import * as React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import {
  useDashboardStats,
  type CVEsByPeriod,
  type ChartPeriod
} from '@/lib/sqlite/use-dashboard-stats';
import type { DatePeriod } from '@/features/search/types';

const MONTH_NAMES: Record<string, Record<string, string>> = {
  'pt-BR': {
    '01': 'Jan',
    '02': 'Fev',
    '03': 'Mar',
    '04': 'Abr',
    '05': 'Mai',
    '06': 'Jun',
    '07': 'Jul',
    '08': 'Ago',
    '09': 'Set',
    '10': 'Out',
    '11': 'Nov',
    '12': 'Dez'
  },
  en: {
    '01': 'Jan',
    '02': 'Feb',
    '03': 'Mar',
    '04': 'Apr',
    '05': 'May',
    '06': 'Jun',
    '07': 'Jul',
    '08': 'Aug',
    '09': 'Sep',
    '10': 'Oct',
    '11': 'Nov',
    '12': 'Dec'
  }
};

const PERIODS: { value: ChartPeriod; label: string }[] = [
  { value: '30d', label: '30d' },
  { value: '1y', label: '1y' },
  { value: '5y', label: '5y' }
];

// Map chart period to search period
const periodToSearchPeriod: Record<ChartPeriod, DatePeriod> = {
  '30d': '30d',
  '1y': '1y',
  '5y': '5y'
};

export function BarGraph() {
  const t = useTranslations('charts');
  const locale = useLocale();
  const router = useRouter();
  const { getCVEsByPeriod, isReady } = useDashboardStats();
  const [period, setPeriod] = useState<ChartPeriod>('30d');
  const [data, setData] = useState<CVEsByPeriod[]>([]);
  const [activeChart, setActiveChart] = useState<'total' | 'withExploit'>(
    'total'
  );

  const loadData = useCallback(() => {
    if (isReady) {
      const periodData = getCVEsByPeriod(period);
      setData(periodData);
    }
  }, [isReady, getCVEsByPeriod, period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBarClick = useCallback(
    (barData: { period: string }) => {
      // Build URL with filters based on clicked period
      const params = new URLSearchParams();

      // Use custom date for the specific period
      params.set('period', 'custom');
      params.set('date', barData.period);

      // If viewing exploit data, filter by has exploit
      if (activeChart === 'withExploit') {
        params.set('exploit', 'true');
      }

      router.push(`/dashboard/search?${params.toString()}`);
    },
    [activeChart, router]
  );

  const chartConfig = {
    cves: {
      label: 'CVEs'
    },
    total: {
      label: t('totalCVEs'),
      color: 'var(--primary)'
    },
    withExploit: {
      label: t('withExploit'),
      color: 'hsl(25, 95%, 53%)'
    }
  } satisfies ChartConfig;

  const chartData = data.map((item) => {
    let displayLabel = item.label;

    // Format label based on period
    if (period === '1y') {
      displayLabel =
        MONTH_NAMES[locale]?.[item.label] ??
        MONTH_NAMES['en'][item.label] ??
        item.label;
    }

    return {
      period: item.period,
      label: displayLabel,
      total: item.total,
      withExploit: item.withExploit
    };
  });

  const total = React.useMemo(
    () => ({
      total: chartData.reduce((acc, curr) => acc + curr.total, 0),
      withExploit: chartData.reduce((acc, curr) => acc + curr.withExploit, 0)
    }),
    [chartData]
  );

  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  return (
    <Card className='@container/card flex h-full flex-col !pt-3'>
      <CardHeader className='flex flex-col items-stretch space-y-0 border-b !p-0 sm:flex-row'>
        <div className='flex flex-1 flex-col justify-center gap-1 px-6 !py-0'>
          <div className='flex items-center justify-between'>
            <CardTitle>{t('cvesByPeriod')}</CardTitle>
            <div className='flex gap-1'>
              {PERIODS.map((p) => (
                <Button
                  key={p.value}
                  variant={period === p.value ? 'default' : 'ghost'}
                  size='sm'
                  className='h-7 px-2 text-xs'
                  onClick={() => setPeriod(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
          <CardDescription>
            {t(`cvesByPeriodDescription${period}`)}
          </CardDescription>
        </div>
        <div className='flex'>
          {(['total', 'withExploit'] as const).map((key) => {
            return (
              <button
                key={key}
                data-active={activeChart === key}
                className='data-[active=true]:bg-primary/5 hover:bg-primary/5 relative flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left transition-colors duration-200 even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6'
                onClick={() => setActiveChart(key)}
              >
                <span className='text-muted-foreground text-xs'>
                  {chartConfig[key].label}
                </span>
                <span className='text-lg leading-none font-bold sm:text-3xl'>
                  {total[key].toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className='flex flex-1 flex-col px-2 pt-4 sm:px-6 sm:pt-6'>
        <ChartContainer
          config={chartConfig}
          className='aspect-auto min-h-[250px] w-full flex-1'
        >
          <BarChart
            data={chartData}
            margin={{
              left: 12,
              right: 12
            }}
          >
            <defs>
              <linearGradient id='fillBarTotal' x1='0' y1='0' x2='0' y2='1'>
                <stop
                  offset='0%'
                  stopColor='var(--primary)'
                  stopOpacity={0.8}
                />
                <stop
                  offset='100%'
                  stopColor='var(--primary)'
                  stopOpacity={0.2}
                />
              </linearGradient>
              <linearGradient id='fillBarExploit' x1='0' y1='0' x2='0' y2='1'>
                <stop
                  offset='0%'
                  stopColor='hsl(25, 95%, 53%)'
                  stopOpacity={0.8}
                />
                <stop
                  offset='100%'
                  stopColor='hsl(25, 95%, 53%)'
                  stopOpacity={0.2}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey='label'
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={50}
              tickFormatter={(value) => {
                if (value >= 1000) {
                  const k = value / 1000;
                  return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
                }
                return value;
              }}
            />
            <ChartTooltip
              cursor={{ fill: 'var(--primary)', opacity: 0.1 }}
              content={
                <ChartTooltipContent className='w-[150px]' nameKey='cves' />
              }
            />
            <Bar
              dataKey={activeChart}
              fill={
                activeChart === 'total'
                  ? 'url(#fillBarTotal)'
                  : 'url(#fillBarExploit)'
              }
              radius={[4, 4, 0, 0]}
              style={{ cursor: 'pointer' }}
              onClick={(data) => handleBarClick(data)}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
