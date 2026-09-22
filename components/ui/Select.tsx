'use client'

import type { ComponentProps } from 'react'
import InputField from './Input'

type SelectProps = Omit<ComponentProps<typeof InputField>, 'as'>

/** 라벨이 위에 붙는 기본 select. 옵션은 children 으로 전달 */
export default function Select(props: SelectProps) {
  return <InputField as="select" {...props} />
}
