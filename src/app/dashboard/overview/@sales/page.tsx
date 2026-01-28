'use client';

import dynamic from 'next/dynamic';

const CriticalCVEs = dynamic(
  () =>
    import('@/features/overview/components/critical-cves').then(
      (mod) => mod.CriticalCVEs
    ),
  { ssr: false }
);

export default function Sales() {
  return <CriticalCVEs />;
}
