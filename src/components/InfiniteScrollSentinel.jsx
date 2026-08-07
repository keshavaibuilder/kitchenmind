import { useEffect, useRef } from 'react'

/**
 * Drop this at the bottom of a scrollable list; calls onIntersect() once when it enters the
 * viewport (e.g. to fetchNextPage()). Avoids pulling in a virtualization/infinite-scroll
 * library for what a single IntersectionObserver already does.
 */
export default function InfiniteScrollSentinel({ onIntersect, enabled = true }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!enabled || !ref.current) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onIntersect()
      },
      { rootMargin: '200px' }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [onIntersect, enabled])

  return <div ref={ref} className="h-4" aria-hidden="true" />
}
