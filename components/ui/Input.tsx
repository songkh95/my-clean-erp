'use client'

import React from 'react'

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

  // ✅ any 제거: React.ElementType으로 동적 태그 타입 지정
  const Tag = as as React.ElementType

  return (
    <div style={containerStyle}>
      <label style={labelStyle}>{label}</label>
      <Tag 
        style={{ ...inputStyle, ...style }} 
        value={value ?? ''} 
        // ✅ any 제거: 정확한 이벤트 타입 적용
        onFocus={(e: React.FocusEvent<HTMLElement>) => e.currentTarget.style.boxShadow = '0 0 0 2px var(--notion-blue-light)'}
        onBlur={(e: React.FocusEvent<HTMLElement>) => e.currentTarget.style.boxShadow = 'none'}
        {...props} 
      />
    </div>
  )
}