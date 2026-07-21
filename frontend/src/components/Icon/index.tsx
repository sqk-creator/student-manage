import React from 'react';

interface IconProps {
  name: 'check' | 'chevron-down' | 'chevron-right';
  size?: number;
  color?: string;
  className?: string;
}

const Icon: React.FC<IconProps> = ({ name, size = 16, color = 'currentColor', className }) => {
  const icons: Record<string, React.ReactNode> = {
    'check': (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <path d="M3 8l3.5 3.5L13 5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    'chevron-down': (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <path d="M4 6l4 4 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    'chevron-right': (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <path d="M6 4l4 4-4 4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  };

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center' }}>
      {icons[name]}
    </span>
  );
};

export default Icon;
