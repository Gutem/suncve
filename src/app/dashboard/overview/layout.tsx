import PageContainer from '@/components/layout/page-container';
import React from 'react';
import { WelcomeHeader } from '@/features/overview/components/welcome-header';
import { OverviewStatsCards } from '@/features/overview/components/overview-stats-cards';

export default function OverViewLayout({
  sales,
  pie_stats,
  bar_stats,
  area_stats
}: {
  sales: React.ReactNode;
  pie_stats: React.ReactNode;
  bar_stats: React.ReactNode;
  area_stats: React.ReactNode;
}) {
  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-2'>
        <WelcomeHeader />
        <OverviewStatsCards />
        <div
          data-tour='charts'
          className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7'
        >
          <div className='col-span-4'>{bar_stats}</div>
          <div className='col-span-4 md:col-span-3'>{sales}</div>
          <div className='col-span-4'>{area_stats}</div>
          <div className='col-span-4 md:col-span-3'>{pie_stats}</div>
        </div>
      </div>
    </PageContainer>
  );
}
