import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

type Progress = { projectId: string | null; done: number; total: number }

/** Celebrate a completion transition, never a loaded completed project. */
export function BeadingCelebration({ projectId, done, total }: Progress) {
  const previous = useRef<Progress | null>(null)
  const stopAnimation = useRef<(() => void) | null>(null)

  useEffect(() => {
    const before = previous.current
    previous.current = { projectId, done, total }
    if (before?.projectId !== projectId || done < total) {
      stopAnimation.current?.()
      stopAnimation.current = null
    }
    if (!projectId || total <= 0 || !before
      || before.projectId !== projectId || before.total !== total
      || before.done >= total || done < total) return

    toast.success('全部拼完啦！', { description: `完成了 ${total.toLocaleString()} 颗豆子，作品大功告成。` })
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    stopAnimation.current?.()
    stopAnimation.current = launchConfetti()
  }, [projectId, done, total])

  useEffect(() => () => stopAnimation.current?.(), [])
  return null
}

function launchConfetti() {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '1000',
  })
  const context = canvas.getContext('2d')
  if (!context) return () => {}
  document.body.append(canvas)
  const width = window.innerWidth
  const height = window.innerHeight
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = width * ratio
  canvas.height = height * ratio
  context.scale(ratio, ratio)
  const colors = ['#ffb347', '#ef729a', '#78c9ba', '#8c9ee8', '#ffd975']
  const particles = Array.from({ length: width < 640 ? 70 : 120 }, (_, index) => {
    const left = index % 2 === 0
    return {
      x: left ? width * 0.12 : width * 0.88, y: height * 0.6,
      vx: (left ? 1 : -1) * (70 + Math.random() * Math.min(width * 0.5, 440)),
      vy: -(240 + Math.random() * 380), rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 12, size: 5 + Math.random() * 5,
      color: colors[index % colors.length],
    }
  })
  let frame = 0
  const start = performance.now()
  let last = start
  const stop = () => { cancelAnimationFrame(frame); canvas.remove() }
  const render = (now: number) => {
    const elapsed = (now - start) / 1000
    if (elapsed >= 3.2) { stop(); return }
    const dt = Math.min((now - last) / 1000, 0.04)
    last = now
    context.clearRect(0, 0, width, height)
    context.globalAlpha = Math.min(1, (3.2 - elapsed) / 0.8)
    for (const particle of particles) {
      particle.vy += 380 * dt
      particle.vx *= Math.exp(-0.6 * dt)
      particle.x += particle.vx * dt
      particle.y += particle.vy * dt
      particle.rotation += particle.spin * dt
      context.save()
      context.translate(particle.x, particle.y)
      context.rotate(particle.rotation)
      context.fillStyle = particle.color
      context.fillRect(-particle.size / 2, -particle.size / 3,
        particle.size, particle.size * (0.25 + Math.abs(Math.cos(elapsed * 5)) * 0.5))
      context.restore()
    }
    frame = requestAnimationFrame(render)
  }
  frame = requestAnimationFrame(render)
  return stop
}
