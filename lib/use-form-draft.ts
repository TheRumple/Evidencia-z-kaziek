'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type DraftEnvelope<T> = {
  savedAt: string
  value: T
}

const DATABASE_NAME = 'itspot-form-drafts'
const STORE_NAME = 'drafts'

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
    }
  })
}

async function readDraft<T>(key: string) {
  const database = await openDatabase()
  return new Promise<DraftEnvelope<T> | null>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(key)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve((request.result as DraftEnvelope<T> | undefined) || null)
    transaction.oncomplete = () => database.close()
  })
}

async function writeDraft<T>(key: string, draft: DraftEnvelope<T>) {
  const database = await openDatabase()
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(draft, key)
    transaction.onerror = () => reject(transaction.error)
    transaction.oncomplete = () => { database.close(); resolve() }
  })
}

async function removeDraft(key: string) {
  const database = await openDatabase()
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).delete(key)
    transaction.onerror = () => reject(transaction.error)
    transaction.oncomplete = () => { database.close(); resolve() }
  })
}

export function useFormDraft<T>(key: string | null, value: T, onRestore: (value: T, savedAt: string) => void, enabled = true) {
  const restoreRef = useRef(onRestore)
  const readyRef = useRef(false)
  const pauseUntilRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState('')

  useEffect(() => { restoreRef.current = onRestore }, [onRestore])

  useEffect(() => {
    if (!key) return
    let cancelled = false
    readyRef.current = false
    void readDraft<T>(key)
      .then((draft) => {
        if (cancelled || !draft) return
        restoreRef.current(draft.value, draft.savedAt)
        setLastSavedAt(draft.savedAt)
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) readyRef.current = true })
    return () => { cancelled = true }
  }, [key])

  useEffect(() => {
    if (!key || !enabled || !readyRef.current || Date.now() < pauseUntilRef.current) return
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      const savedAt = new Date().toISOString()
      void writeDraft(key, { value, savedAt })
        .then(() => setLastSavedAt(savedAt))
        .catch(() => undefined)
    }, 600)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [enabled, key, value])

  const clearDraft = useCallback(() => {
    if (!key) return
    if (timerRef.current) window.clearTimeout(timerRef.current)
    pauseUntilRef.current = Date.now() + 1200
    setLastSavedAt('')
    void removeDraft(key).catch(() => undefined)
  }, [key])

  return { clearDraft, lastSavedAt }
}
