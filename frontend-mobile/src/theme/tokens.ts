// src/theme/tokens.ts
// Design tokens do Kratos Basquete Urbano
// Tema: Asfalto Digital — dark, urban, esportivo

export const colors = {
  // Backgrounds
  bg:      '#0A0A0F',
  bg2:     '#111118',
  bg3:     '#1A1A24',
  bg4:     '#22222E',

  // Acentos
  orange:  '#FF6B1A',  // cor primária — quadra
  green:   '#00E5A0',  // validado / sucesso
  blue:    '#4A9EFF',  // Bluetooth / informação
  red:     '#FF4A6B',  // alerta / perigo
  purple:  '#A855F7',  // especial

  // Texto
  text:    '#F0F0F8',
  text2:   '#9090A8',
  text3:   '#5A5A72',

  // Bordas
  border:  '#2A2A3A',
} as const;

export const fonts = {
  display: 'BarlowCondensed_900Black',
  bold:    'BarlowCondensed_700Bold',
  body:    'DMSans_400Regular',
  medium:  'DMSans_500Medium',
} as const;

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 28,
} as const;

export const radius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  full: 999,
} as const;

export const shadows = {
  orange: {
    shadowColor: '#FF6B1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  blue: {
    shadowColor: '#4A9EFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;
