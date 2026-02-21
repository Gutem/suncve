const RAW_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const BASE_PATH = RAW_BASE_PATH.endsWith('/')
  ? RAW_BASE_PATH.slice(0, -1)
  : RAW_BASE_PATH;

export function withBasePath(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!BASE_PATH) return normalizedPath;
  if (normalizedPath === BASE_PATH || normalizedPath.startsWith(`${BASE_PATH}/`))
    return normalizedPath;
  return `${BASE_PATH}${normalizedPath}`;
}
