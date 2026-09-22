'use client'

import React, { useId } from 'react'
import styles from './ui.module.css'
import { cx } from './cx'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> {
  label: string
  as?: 'input' | 'select' | 'textarea'
  /** as="textarea" 일 때 줄 수 */
  rows?: number
  /** 입력창 아래 빨간 한 줄 */
  error?: string
  /** 입력창 아래 흐린 안내 한 줄 (오류가 없을 때만) */
  hint?: string
  /** 바깥 묶음(라벨 + 입력창)에 줄 클래스 */
  containerClassName?: string
}

export default function InputField({
  label,
  as = 'input',
  value,
  error,
  hint,
  className,
  containerClassName,
  id,
  ...props
}: InputProps) {
  const autoId = useId()
  const controlId = id ?? autoId
  const Tag = as as React.ElementType

  return (
    <div className={cx(styles.field, containerClassName)}>
      <label className={styles.label} htmlFor={controlId}>{label}</label>
      <Tag
        id={controlId}
        className={cx(
          styles.control,
          as === 'textarea' ? styles.controlArea : styles.controlBox,
          error && styles.controlError,
          className,
        )}
        value={value ?? ''}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error ? (
        <div className={styles.errorText} role="alert">{error}</div>
      ) : hint ? (
        <div className={styles.hintText}>{hint}</div>
      ) : null}
    </div>
  )
}
