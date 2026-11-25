import React from 'react';
import type { TreasuryAccountType } from '../../types';
import { detectBankBrand, type BankBrandKey } from '../../utils/bankBrand';

interface BankLogoProps {
  name: string;
  treasuryType?: TreasuryAccountType;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLS: Record<NonNullable<BankLogoProps['size']>, string> = {
  xs: 'h-6 w-6 rounded-lg',
  sm: 'h-8 w-8 rounded-xl',
  md: 'h-10 w-10 rounded-xl',
  lg: 'h-12 w-12 rounded-2xl',
};

const SVG_SIZE: Record<NonNullable<BankLogoProps['size']>, number> = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
};

function renderEmblem(key: BankBrandKey, primary: string, secondary: string) {
  switch (key) {
    case 'saman':
      // Saman: iconic blue geometric star/sunburst mark
      return (
        <g>
          <circle cx="16" cy="16" r="11" fill={primary} opacity="0.14" />
          <path
            d="M16 5L18.6 11.4L25 11.4L19.8 15.6L21.8 22L16 18.2L10.2 22L12.2 15.6L7 11.4L13.4 11.4Z"
            fill={primary}
          />
          <circle cx="16" cy="15.2" r="2.6" fill="#FFFFFF" />
        </g>
      );
    case 'mellat':
      // Mellat: crimson interlocking twin curves with gold dot
      return (
        <g>
          <path
            d="M8.5 11.5C8.5 8.5 11.5 6.5 16 6.5C20.5 6.5 23.5 8.5 23.5 11.5C23.5 14 21 15.8 18 16.5L14 17.5C11.5 18.2 9.5 19.5 9.5 21.8C9.5 24 12.2 25.5 16 25.5C19.8 25.5 22.5 24 23 21.5"
            stroke={primary}
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="16" cy="11.5" r="2.4" fill={secondary} />
        </g>
      );
    case 'melli':
      // Melli: golden heritage arch / coin wreath emblem
      return (
        <g>
          <circle cx="16" cy="16" r="10.5" stroke={primary} strokeWidth="2.2" fill="none" />
          <path
            d="M11 21V13.5C11 10.7 13.2 8.8 16 8.8C18.8 8.8 21 10.7 21 13.5V21"
            stroke={primary}
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
          <path d="M16 12.5V21" stroke={secondary} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M10 21.5H22" stroke={primary} strokeWidth="2.2" strokeLinecap="round" />
        </g>
      );
    case 'saderat':
      // Saderat: royal blue geometric diamond-crown
      return (
        <g>
          <path
            d="M16 5.5L25 14.5L16 26.5L7 14.5Z"
            stroke={primary}
            strokeWidth="2.4"
            fill={primary}
            fillOpacity="0.14"
            strokeLinejoin="round"
          />
          <path d="M11.5 14.5L16 10L20.5 14.5L16 21Z" fill={primary} />
        </g>
      );
    case 'tejarat':
      // Tejarat: twin blue interlocking squares / prism
      return (
        <g>
          <rect x="7" y="9" width="11" height="11" rx="2.5" stroke={primary} strokeWidth="2.4" fill="none" />
          <rect x="14" y="12" width="11" height="11" rx="2.5" fill={secondary} fillOpacity="0.22" stroke={secondary} strokeWidth="2.4" />
        </g>
      );
    case 'keshavarzi':
      // Keshavarzi: emerald stylized wheat/leaf
      return (
        <g>
          <path
            d="M16 26V8M16 12C12.5 12 10 9.8 10 7C13.5 7 16 9 16 12ZM16 16C19.5 16 22 13.8 22 11C18.5 11 16 13 16 16ZM16 20C12.5 20 10 17.8 10 15C13.5 15 16 17 16 20Z"
            stroke={primary}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={secondary}
            fillOpacity="0.3"
          />
        </g>
      );
    case 'sepah':
      // Sepah: crimson-gold hexagonal shield
      return (
        <g>
          <path
            d="M16 5.5L24.5 10V18.5C24.5 22.5 20.8 25.4 16 26.8C11.2 25.4 7.5 22.5 7.5 18.5V10L16 5.5Z"
            fill={primary}
            fillOpacity="0.15"
            stroke={primary}
            strokeWidth="2.2"
          />
          <circle cx="16" cy="15.5" r="3.5" fill={secondary} />
        </g>
      );
    case 'parsian':
      // Parsian: warm crimson stylized lotus diamond
      return (
        <g>
          <path d="M16 6L23.5 16L16 26L8.5 16Z" fill={primary} fillOpacity="0.18" stroke={primary} strokeWidth="2.2" />
          <circle cx="16" cy="16" r="3.2" fill={secondary} />
        </g>
      );
    case 'pasargad':
      // Pasargad: gold stepped heritage monument
      return (
        <g>
          <path d="M8 23H24M10 19H22M12 15H20M14 11H18" stroke={primary} strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="16" cy="7.5" r="1.8" fill={secondary} />
        </g>
      );
    case 'shahr':
      // Shahr: geometric rose-red urban hexagon
      return (
        <g>
          <polygon
            points="16,5.5 25,10.8 25,21.2 16,26.5 7,21.2 7,10.8"
            fill={primary}
            fillOpacity="0.14"
            stroke={primary}
            strokeWidth="2.2"
          />
          <rect x="12.5" y="12.5" width="7" height="7" rx="1.5" fill={primary} />
        </g>
      );
    case 'ayandeh':
      return (
        <g>
          <path d="M9 22L16 8L23 22H9Z" fill={secondary} fillOpacity="0.22" stroke={primary} strokeWidth="2.4" strokeLinejoin="round" />
          <circle cx="16" cy="17.5" r="2.2" fill={primary} />
        </g>
      );
    case 'blu':
      return (
        <g>
          <rect x="7" y="7" width="18" height="18" rx="6" fill={primary} />
          <path d="M13 11.5V20.5M13 16H17.2C18.8 16 19.8 16.9 19.8 18.2C19.8 19.5 18.8 20.5 17.2 20.5H13" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      );
    case 'pettyCash':
      return (
        <g>
          <rect x="6" y="8.5" width="20" height="15" rx="3.5" fill={primary} fillOpacity="0.16" stroke={primary} strokeWidth="2.1" />
          <path d="M18 14H26V18H18C16.9 18 16 17.1 16 16C16 14.9 16.9 14 18 14Z" fill={primary} />
          <circle cx="18.5" cy="16" r="1.1" fill="#FFFFFF" />
        </g>
      );
    case 'cash':
      return (
        <g>
          <rect x="6" y="7.5" width="20" height="17" rx="3.5" fill={primary} fillOpacity="0.16" stroke={primary} strokeWidth="2.1" />
          <circle cx="16" cy="16" r="4" stroke={primary} strokeWidth="2" fill={secondary} fillOpacity="0.22" />
          <circle cx="16" cy="16" r="1.4" fill={primary} />
        </g>
      );
    default:
      return (
        <g>
          <path d="M6.5 12.5L16 7L25.5 12.5H6.5Z" fill={primary} />
          <path d="M9.5 15.5V22M16 15.5V22M22.5 15.5V22M6.5 24H25.5" stroke={primary} strokeWidth="2.2" strokeLinecap="round" />
        </g>
      );
  }
}

export const BankLogo: React.FC<BankLogoProps> = ({ name, treasuryType, size = 'md', className = '' }) => {
  const brand = detectBankBrand(name, treasuryType);
  const dim = SVG_SIZE[size];

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 border border-white/70 dark:border-slate-700/70 shadow-xs ${SIZE_CLS[size]} ${className}`}
      style={{ backgroundColor: brand.tintBg }}
      title={name}
    >
      <svg width={dim} height={dim} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        {renderEmblem(brand.key, brand.primaryColor, brand.secondaryColor)}
      </svg>
    </span>
  );
};
