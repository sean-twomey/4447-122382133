export type AppScheme = 'light' | 'dark';

export const appColors = {
  tint: '#0A6B7D',
  success: '#2D6A4F',
  warning: '#B07D3A',
  danger: '#C0392B',
  info: '#2E6E8E',
  cardLight: '#F6F6F6',
  cardDark: '#1B1D1F',
  softLight: '#EFEFEF',
  softDark: '#24272A',
  mutedLight: '#5F686D',
  mutedDark: '#A8AFB4',
  dividerLight: '#D9DEE2',
  dividerDark: '#303438',
};

export function surface(scheme: AppScheme) {
  return scheme === 'dark' ? appColors.cardDark : appColors.cardLight;
}

export function headerSurface(scheme: AppScheme) {
  return scheme === 'dark' ? '#17191C' : '#F0F2F4';
}

export function softSurface(scheme: AppScheme) {
  return scheme === 'dark' ? appColors.softDark : appColors.softLight;
}

export function muted(scheme: AppScheme) {
  return scheme === 'dark' ? appColors.mutedDark : appColors.mutedLight;
}

export function divider(scheme: AppScheme) {
  return scheme === 'dark' ? appColors.dividerDark : appColors.dividerLight;
}
