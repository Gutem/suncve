'use client';

/**
 * Hook for filtering navigation items
 * Simplified version without RBAC (Clerk removed)
 */

import { useMemo } from 'react';
import type { NavItem } from '@/types';

/**
 * Hook to filter navigation items
 *
 * @param items - Array of navigation items to filter
 * @returns Filtered items (items with requireOrg are hidden since there's no auth)
 */
export function useFilteredNavItems(items: NavItem[]) {
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // Hide items that require organization (no auth system)
        if (item.access?.requireOrg) {
          return false;
        }
        return true;
      })
      .map((item) => {
        // Recursively filter child items
        if (item.items && item.items.length > 0) {
          const filteredChildren = item.items.filter((childItem) => {
            if (childItem.access?.requireOrg) {
              return false;
            }
            return true;
          });

          return {
            ...item,
            items: filteredChildren
          };
        }

        return item;
      });
  }, [items]);

  return filteredItems;
}
