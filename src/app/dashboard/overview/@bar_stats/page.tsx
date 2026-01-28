'use client';

import dynamic from 'next/dynamic';

const BarGraph = dynamic(
  () =>
    import('@/features/overview/components/bar-graph').then(
      (mod) => mod.BarGraph
    ),
  { ssr: false }
);

export default function BarStats() {
  return <BarGraph />;
}
