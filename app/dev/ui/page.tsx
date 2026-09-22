import { notFound } from 'next/navigation'
import UiPreview from './UiPreview'

/** 공통 UI 컴포넌트 미리보기. 개발 모드에서만 열림 (배포 환경은 404) */
export default function DevUiPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <UiPreview />
}
