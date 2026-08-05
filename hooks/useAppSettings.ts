'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  loadAppSettings,
  saveAppSettings,
} from '@/utils/appSettings'

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setSettings(loadAppSettings())
    setReady(true)

    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key.includes('my-clean-erp-settings')) {
        setSettings(loadAppSettings())
      }
    }
    const onCustom = () => setSettings(loadAppSettings())

    window.addEventListener('storage', onStorage)
    window.addEventListener('app-settings-changed', onCustom)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('app-settings-changed', onCustom)
    }
  }, [])

  const updateSettings = useCallback((next: AppSettings) => {
    setSettings(next)
    saveAppSettings(next)
  }, [])

  const patchSection = useCallback(<K extends keyof AppSettings>(
    key: K,
    patch: Partial<AppSettings[K]>
  ) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: { ...prev[key], ...patch } }
      saveAppSettings(next)
      return next
    })
  }, [])

  return { settings, ready, updateSettings, patchSection }
}
