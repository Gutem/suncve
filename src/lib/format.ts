export function formatDate(
  date: Date | string | number | undefined,
  opts: Intl.DateTimeFormatOptions = {}
) {
  if (!date) return '';

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: opts.month ?? 'long',
      day: opts.day ?? 'numeric',
      year: opts.year ?? 'numeric',
      ...opts
    }).format(new Date(date));
  } catch (_err) {
    return '';
  }
}

/**
 * Formata uma data de acordo com o idioma atual da UI: dd/MM/aaaa em português
 * e MM/dd/aaaa em inglês. Centraliza a exibição de datas para manter o padrão
 * brasileiro quando o locale for pt-BR. Retorna `fallback` para datas inválidas.
 */
export function formatDateLocalized(
  date: Date | string | number | null | undefined,
  locale: string,
  fallback = '—'
): string {
  if (date == null || date === '') return fallback;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return typeof date === 'string' ? date : fallback;
  }
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(parsed);
}
