'use client';

import dynamic from 'next/dynamic';

// Dynamically import the search content with SSR disabled
// This is necessary because sql.js uses Node.js 'fs' module which doesn't exist in the browser
// By disabling SSR, we ensure the component only loads on the client side
const SearchPageContent = dynamic(
  () => import('@/features/search/components/search-page-content'),
  {
    ssr: false,
    loading: () => (
      <div className='flex min-h-[400px] items-center justify-center'>
        <div className='border-primary h-8 w-8 animate-spin rounded-full border-b-2'></div>
      </div>
    )
  }
);

export default function SearchPage() {
  return <SearchPageContent />;
}
