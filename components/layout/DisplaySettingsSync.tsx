'use client'

import { useEffect } from 'react'
import { APP_SETTINGS_STORAGE_KEY, loadAppSettings } from '@/utils/appSettings'
import { applyDisplaySettings } from '@/utils/displaySettings'

/** 저장된 화면 설정(글꼴, 글자 크기)을 적용하고, 설정이 바뀌면 다시 적용 */
export default function DisplaySettingsSync() {
  useEffect(() => {
    const apply = () => applyDisplaySettings(loadAppSettings().general)
    const onStorage = (e: StorageEvent) => {
      if (e.key === APP_SETTINGS_STORAGE_KEY) apply()
    }
    apply()
    window.addEventListener('app-settings-changed', apply)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('app-settings-changed', apply)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return null
}
