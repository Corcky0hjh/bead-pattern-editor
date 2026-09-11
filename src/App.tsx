import { useEffect, useState } from 'react'
import { ToastViewport } from './components/ToastViewport'
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
    <>
      <main className="box-border h-svh overflow-hidden bg-editor-bg p-3 text-editor-text md:p-5">
        <EditorShell />
      </main>
      <ToastViewport />
    </>
  )
}

export default App
