'use client';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription
} from '@/components/ui/card';

export function CriticalCVEsSkeleton() {
  return (
    <Card className='h-full'>
      <CardHeader>
        <CardTitle>
          <Skeleton className='h-5 w-40' />
        </CardTitle>
        <CardDescription>
          <Skeleton className='h-4 w-60' />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-6'>
          {[...Array(5)].map((_, index) => (
            <div key={index} className='flex items-start gap-3'>
              <Skeleton className='h-9 w-9 rounded-full' />
              <div className='flex-1 space-y-2'>
                <div className='flex items-center gap-2'>
                  <Skeleton className='h-4 w-32' />
                  <Skeleton className='h-5 w-10' />
                </div>
                <Skeleton className='h-3 w-full' />
              </div>
              <Skeleton className='h-3 w-12' />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
