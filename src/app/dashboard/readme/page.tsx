'use client';

import dynamic from 'next/dynamic';

// Load on the client only to keep the page lightweight and consistent
// with the other dashboard pages.
const ReadmePageContent = dynamic(
  () => import('@/features/readme/components/readme-page-content'),
  {
    ssr: false,
    loading: () => (
      <div className='flex min-h-[400px] items-center justify-center'>
        <div className='border-primary h-8 w-8 animate-spin rounded-full border-b-2'></div>
      </div>
    )
  }
);

export default function ReadmePage() {
  return <ReadmePageContent />;
}
