'use client';

import * as React from 'react';
import { useEffect, useState, useCallback } from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { Label, Pie, PieChart, Cell } from 'recharts';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  type SeverityDistribution,
  type SeverityPeriod
} from '@/lib/sqlite/use-dashboard-stats';
import type { DatePeriod, Severity } from '@/features/search/types';

const PERIODS: { value: SeverityPeriod; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '120d', label: '120d' }
];

// Map chart period to search period
const periodToSearchPeriod: Record<SeverityPeriod, DatePeriod> = {
  '7d': '7d',
  '30d': '30d',
  '120d': '120d'
};

export function PieGraph() {
  const t = useTranslations('charts');
  const router = useRouter();
  const { getSeverityDistribution, isReady } = useDashboardStats();
  const [period, setPeriod] = useState<SeverityPeriod>('30d');
  const [severity, setSeverity] = useState<SeverityDistribution>({
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    unknown: 0
  });

  const loadData = useCallback(() => {
    if (isReady) {
      const data = getSeverityDistribution(period);
      setSeverity(data);
    }
  }, [isReady, getSeverityDistribution, period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSeverityClick = useCallback(
    (severityType: string) => {
      // Map severity to search filter
      const severityMap: Record<string, Severity> = {
        critical: 'critical',
        high: 'high',
        medium: 'medium',
        low: 'low'
      };

      const mappedSeverity = severityMap[severityType];
      if (!mappedSeverity && severityType !== 'unknown') return;

      // Build URL with filters
      const params = new URLSearchParams();
      params.set('period', periodToSearchPeriod[period]);

      if (mappedSeverity) {
        params.set('severity', mappedSeverity);
      }

      router.push(`/dashboard/search?${params.toString()}`);
    },
    [period, router]
  );

  const chartData = [
    {
      severity: 'critical',
      count: severity.critical,
      fill: 'var(--color-critical)'
    },
    { severity: 'high', count: severity.high, fill: 'var(--color-high)' },
    { severity: 'medium', count: severity.medium, fill: 'var(--color-medium)' },
    { severity: 'low', count: severity.low, fill: 'var(--color-low)' },
    {
      severity: 'unknown',
      count: severity.unknown,
      fill: 'var(--color-unknown)'
    }
  ].filter((item) => item.count > 0); // Only show non-zero values

  const chartConfig = {
    count: {
      label: t('cves')
    },
    critical: {
      label: t('severityCritical'),
      color: 'hsl(0, 84%, 60%)'
    },
    high: {
      label: t('severityHigh'),
      color: 'hsl(25, 95%, 53%)'
    },
    medium: {
      label: t('severityMedium'),
      color: 'hsl(45, 93%, 47%)'
    },
    low: {
      label: t('severityLow'),
      color: 'hsl(142, 71%, 45%)'
    },
    unknown: {
      label: t('severityUnknown'),
      color: 'hsl(220, 10%, 50%)'
    }
  } satisfies ChartConfig;

  const totalCVEs = React.useMemo(() => {
    return (
      severity.critical +
      severity.high +
      severity.medium +
      severity.low +
      severity.unknown
    );
  }, [severity]);

  const criticalPercentage =
    totalCVEs > 0 ? ((severity.critical / totalCVEs) * 100).toFixed(1) : '0';

  return (
    <Card className='@container/card flex h-full flex-col'>
      <CardHeader className='flex flex-row items-center justify-between pb-2'>
        <div>
          <CardTitle>{t('severityChart')}</CardTitle>
          <CardDescription className='mt-1'>
            {t('severityChartDescription')}
          </CardDescription>
        </div>
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
      </CardHeader>
      <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
        <ChartContainer
          config={chartConfig}
          className='mx-auto aspect-square h-[250px]'
        >
          <PieChart>
            <defs>
              {['critical', 'high', 'medium', 'low', 'unknown'].map((sev) => (
                <linearGradient
                  key={sev}
                  id={`fill${sev}`}
                  x1='0'
                  y1='0'
                  x2='0'
                  y2='1'
                >
                  <stop
                    offset='0%'
                    stopColor={`var(--color-${sev})`}
                    stopOpacity={1}
                  />
                  <stop
                    offset='100%'
                    stopColor={`var(--color-${sev})`}
                    stopOpacity={0.7}
                  />
                </linearGradient>
              ))}
            </defs>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartData.map((item) => ({
                ...item,
                fill: `url(#fill${item.severity})`
              }))}
              dataKey='count'
              nameKey='severity'
              innerRadius={60}
              strokeWidth={2}
              stroke='var(--background)'
              style={{ cursor: 'pointer' }}
              onClick={(data) => handleSeverityClick(data.severity)}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor='middle'
                        dominantBaseline='middle'
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className='fill-foreground text-3xl font-bold'
                        >
                          {totalCVEs.toLocaleString()}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className='fill-muted-foreground text-sm'
                        >
                          CVEs
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className='flex-col gap-2 text-sm'>
        <div className='flex items-center gap-2 leading-none font-medium'>
          {t('criticalPercentage', { percentage: criticalPercentage })}{' '}
          <IconAlertTriangle className='h-4 w-4 text-red-500' />
        </div>
        <div className='text-muted-foreground leading-none'>
          {t('severityChartFooter')}
        </div>
      </CardFooter>
    </Card>
  );
}
