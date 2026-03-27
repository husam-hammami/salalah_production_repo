import { useEffect } from 'react'
import Lenis from '@studio-freight/lenis'

export const useLenisScroll = () => {
  useEffect(() => {
    const lenis = new Lenis({
    duration: 1.4,
    easing: (t) => 1 - Math.pow(1 - t, 3), // cubic ease-out
    smooth: true,
    smoothTouch: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])
}
