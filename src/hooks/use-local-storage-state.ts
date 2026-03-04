import { useCallback, useState } from "react"
import type { Dispatch, SetStateAction } from "react"

/**
 * A tiny localStorage state wrapper with safe JSON parse fallback.
 * The hook keeps React state as the source of truth and mirrors updates
 * to localStorage so user data survives page reloads.
 */
export function useLocalStorageState<T>(
  key: string,
  initialValue: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === "undefined") {
      return typeof initialValue === "function"
        ? (initialValue as () => T)()
        : initialValue
    }

    const storageValue = window.localStorage.getItem(key)
    if (!storageValue) {
      return typeof initialValue === "function"
        ? (initialValue as () => T)()
        : initialValue
    }

    try {
      return JSON.parse(storageValue) as T
    } catch {
      return typeof initialValue === "function"
        ? (initialValue as () => T)()
        : initialValue
    }
  })

  const setValue: Dispatch<SetStateAction<T>> = useCallback(
    (value) => {
      setState((prevState) => {
        const nextValue =
          typeof value === "function"
            ? (value as (prev: T) => T)(prevState)
            : value

        window.localStorage.setItem(key, JSON.stringify(nextValue))
        return nextValue
      })
    },
    [key]
  )

  return [state, setValue]
}
