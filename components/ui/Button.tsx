'use client'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export default function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  style, 
  ...props 
}: ButtonProps) {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-md)',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background 0.2s, border 0.2s',
    border: '1px solid transparent',
    fontSize: size === 'sm' ? '0.85rem' : '0.9rem',
    padding: size === 'sm' ? '4px 8px' : '8px 14px',
    gap: '6px'
  }

  const variants = {
    primary: { backgroundColor: 'var(--notion-blue)', color: '#fff' },
    outline: { backgroundColor: 'transparent', color: 'var(--notion-main-text)', border: '1px solid var(--notion-border)' },
    ghost: { backgroundColor: 'transparent', color: 'var(--notion-sub-text)' },
    danger: { backgroundColor: 'transparent', color: '#d93025', border: '1px solid var(--notion-border)' }
  }

  return (
    <button 
      style={{ ...baseStyle, ...variants[variant], ...style }} 
      onMouseOver={(e) => {
        if (variant === 'ghost' || variant === 'outline') e.currentTarget.style.backgroundColor = 'var(--notion-soft-bg)'
      }}
      onMouseOut={(e) => {
        if (variant === 'ghost' || variant === 'outline') e.currentTarget.style.backgroundColor = 'transparent'
      }}
      {...props}
    >
      {children}
    </button>
  )
}