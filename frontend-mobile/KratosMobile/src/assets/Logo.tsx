import React from 'react';
import Svg, { Circle, Path, Ellipse, Rect, Line, Text as SvgText } from 'react-native-svg';

interface LogoProps {
  size?: number;
  showText?: boolean;
}

export default function Logo({ size = 120, showText = false }: LogoProps) {
  const s = size / 400;
  return (
    <Svg width={size} height={size} viewBox="0 0 400 400">
      {/* Fundo */}
      <Rect width="400" height="400" fill="#0A0A0F" rx="32"/>

      {/* Sombra */}
      <Ellipse cx="202" cy="222" rx="82" ry="10" fill="#FF6B1A" opacity="0.15"/>

      {/* Bola */}
      <Circle cx="200" cy="200" r="80" fill="#FF6B1A"/>

      {/* Linhas da bola */}
      <Path d="M200 120 Q220 160 220 200 Q220 240 200 280"
        fill="none" stroke="#0A0A0F" strokeWidth="3.5" strokeLinecap="round"/>
      <Path d="M200 120 Q180 160 180 200 Q180 240 200 280"
        fill="none" stroke="#0A0A0F" strokeWidth="3.5" strokeLinecap="round"/>
      <Path d="M120 195 Q160 180 200 180 Q240 180 280 195"
        fill="none" stroke="#0A0A0F" strokeWidth="3.5" strokeLinecap="round"/>
      <Path d="M122 210 Q160 225 200 225 Q240 225 278 210"
        fill="none" stroke="#0A0A0F" strokeWidth="3.5" strokeLinecap="round"/>

      {/* Sombra interna */}
      <Ellipse cx="230" cy="170" rx="30" ry="20" fill="#C94D00" opacity="0.25"/>

      {/* Aro */}
      <Path d="M155 122 Q200 108 245 122"
        fill="none" stroke="#FF8C42" strokeWidth="4" strokeLinecap="round"/>
    </Svg>
  );
}
