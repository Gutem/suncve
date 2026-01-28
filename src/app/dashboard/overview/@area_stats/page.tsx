'use client';

import dynamic from 'next/dynamic';

const AreaGraph = dynamic(
  () =>
    import('@/features/overview/components/area-graph').then(
      (mod) => mod.AreaGraph
    ),
  { ssr: false }
);

export default function AreaStats() {
  return <AreaGraph />;
}
