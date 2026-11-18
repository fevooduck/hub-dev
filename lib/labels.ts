/** Rótulos e links leves (sem carregar o pacote web-features), usados no painel e no digest. */
import type { SupportStatus } from './baseline.ts';

export const SUPPORT_LABEL: Record<SupportStatus, string> = {
  widely: 'Baseline: amplamente disponível',
  newly: 'Baseline: recém-disponível',
  limited: 'Suporte limitado',
  nao_aplica: 'Não se aplica',
  desconhecido: 'Suporte não verificado',
};

export const SUPPORT_SHORT: Record<SupportStatus, string> = {
  widely: 'Baseline ✓✓',
  newly: 'Baseline ✓',
  limited: 'Suporte limitado',
  nao_aplica: '',
  desconhecido: '',
};

export function explorerUrl(id: string): string {
  return `https://web-platform-dx.github.io/web-features-explorer/features/${id}/`;
}
