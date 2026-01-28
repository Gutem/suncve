'use client';

import dynamic from 'next/dynamic';

const PieGraph = dynamic(
  () =>
    import('@/features/overview/components/pie-graph').then(
      (mod) => mod.PieGraph
    ),
  { ssr: false }
);

export default function Stats() {
  return <PieGraph />;
}
