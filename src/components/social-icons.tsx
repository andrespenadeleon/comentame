import type { SVGProps } from 'react';

type SocialIconProps = SVGProps<SVGSVGElement> & { size?: number };

export function InstagramIcon({ size = 24, ...props }: SocialIconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} focusable="false" {...props}><rect x={3} y={3} width={18} height={18} rx={5}/><circle cx={12} cy={12} r={4}/><circle cx={17.5} cy={6.5} r={1} fill="currentColor" stroke="none"/></svg>;
}

export function FacebookIcon({ size = 24, ...props }: SocialIconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" focusable="false" {...props}><path d="M14 22v-9h3l.5-4H14V7c0-1.2.4-2 2-2h2V1.4A24 24 0 0 0 15 1c-3.5 0-5 2.2-5 5.5V9H7v4h3v9z"/></svg>;
}

export function YoutubeIcon({ size = 24, ...props }: SocialIconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} focusable="false" {...props}><rect x={2} y={5} width={20} height={14} rx={4}/><path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none"/></svg>;
}
