'use client'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> {
  label: string
  as?: 'input' | 'select' | 'textarea'
}

export default function InputField({ label, as = 'input', style, value, ...props }: InputProps) {
  const containerStyle = { marginBottom: '16px' }
  const labelStyle = { display: 'block', marginBottom: '4px', fontSize: '0.75rem', fontWeight: '500', color: 'var(--notion-sub-text)' }
  const inputStyle = { 
    width: '100%', 
    padding: '8px 10px', 
    border: '1px solid var(--notion-border)', 
    borderRadius: 'var(--radius-sm)', 
    fontSize: '0.9rem', 
    outline: 'none',
    backgroundColor: 'var(--notion-bg)',
    color: 'var(--notion-main-text)',
    boxSizing: 'border-box' as const
  }

  const Tag = as as any

  return (
    <div style={containerStyle}>
      <label style={labelStyle}>{label}</label>
      <Tag 
        style={{ ...inputStyle, ...style }} 
        // 🔴 value가 null이나 undefined일 경우 빈 문자열('')이 들어가도록 수정
        value={value ?? ''} 
        onFocus={(e: any) => e.target.style.boxShadow = '0 0 0 2px var(--notion-blue-light)'}
        onBlur={(e: any) => e.target.style.boxShadow = 'none'}
        {...props} 
      />
    </div>
  )
}