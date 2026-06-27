import { useEffect, useState } from 'react'
import { EditorShell } from './features/editor/EditorShell'
import { ThemePreview } from './features/theme-preview/ThemePreview'

function App() {
  // 简单 hash 路由:#themes 显示主题预览页,其他显示主编辑器
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  if (hash === '#themes') return <ThemePreview />

  return (
    <main className="min-h-svh bg-editor-bg p-4 text-editor-text md:p-8 2xl:box-border 2xl:h-svh 2xl:overflow-hidden">
      <EditorShell />
    </main>
  )
}

export default App
