// 主题预览页 —— 临时工具,挑选全站配色用。
// 入口:在地址栏后面加 #themes,例如 http://localhost:5333/#themes
//
// 主题数据集中在 src/core/theme/themes.ts,加新主题改那一处即可。
// 这里每张卡片用 inline CSS variables 在卡片范围内 override token,不影响主 app。

import { applyTheme, THEMES, type Theme } from '../../core/theme/themes'

export function ThemePreview() {
  return (
    <main
      style={{
        background: '#1f1812',
        minHeight: '100vh',
        padding: '32px',
        color: '#fff',
      }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>
          主题预览
        </h1>
        <p style={{ opacity: 0.6, fontSize: 13, marginBottom: 32 }}>
          每张卡片用对应主题渲染常见组件。点击"用这套"可立即切换全站主题。
          回到 <code>#</code>(去掉 hash) 就能看到效果。
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
            gap: 24,
          }}
        >
          {THEMES.map((theme) => (
            <ThemeCard key={theme.id} theme={theme} />
          ))}
        </div>
      </div>
    </main>
  )
}

function ThemeCard({ theme }: { theme: Theme }) {
  return (
    <div
      style={{
        ...(theme.vars as React.CSSProperties),
        background: 'var(--color-editor-bg)',
        color: 'var(--color-editor-text)',
        padding: 24,
        borderRadius: 24,
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
      }}
    >
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: 'var(--color-editor-strong)',
              margin: 0,
              marginBottom: 4,
            }}
          >
            {theme.label}
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                opacity: 0.6,
                marginLeft: 8,
                fontFamily: 'monospace',
              }}
            >
              #{theme.id}
            </span>
          </h2>
          <p style={{ fontSize: 12, opacity: 0.8, margin: 0 }}>
            {theme.description}
          </p>
        </div>
        <button
          onClick={() => {
            applyTheme(theme.id)
            localStorage.setItem('bead-pattern-editor:theme', theme.id)
            // 跳回主页
            window.location.hash = ''
          }}
          style={{
            background: 'var(--color-editor-accent)',
            color: '#fff',
            border: 'none',
            padding: '6px 12px',
            borderRadius: 14,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          用这套
        </button>
      </div>

      <div
        style={{
          background: 'var(--color-editor-surface)',
          border: `1px solid var(--color-editor-border)`,
          padding: 16,
          borderRadius: 16,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--color-editor-text)',
            marginBottom: 8,
          }}
        >
          示例卡片
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 900,
            color: 'var(--color-editor-strong)',
          }}
        >
          这是强调文字
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--color-editor-text)',
            marginTop: 4,
          }}
        >
          这是普通正文,描述一些内容。
        </div>
      </div>

      <div
        style={{
          background: 'var(--color-editor-surface-soft)',
          padding: 12,
          borderRadius: 16,
          marginBottom: 12,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <button
          style={{
            background: 'var(--color-editor-accent)',
            color: '#fff',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 16,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          主按钮
        </button>
        <button
          style={{
            background: 'var(--color-editor-accent-soft)',
            color: 'var(--color-editor-accent)',
            border: `1px solid var(--color-editor-border)`,
            padding: '8px 16px',
            borderRadius: 16,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          次按钮
        </button>
        <span
          style={{
            background: 'var(--color-editor-surface)',
            color: 'var(--color-editor-strong)',
            border: `1px solid var(--color-editor-border)`,
            padding: '6px 12px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'monospace',
          }}
        >
          A01
        </span>
      </div>

      <div
        style={{
          background: 'var(--color-editor-surface-soft)',
          padding: 12,
          borderRadius: 16,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--color-editor-text)',
            marginBottom: 8,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>纸面透明度</span>
          <span
            style={{
              fontFamily: 'monospace',
              fontWeight: 900,
              color: 'var(--color-editor-strong)',
            }}
          >
            0.40
          </span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 999,
            background: `linear-gradient(to right,
              var(--color-editor-accent) 0%,
              var(--color-editor-accent) 40%,
              rgba(0,0,0,0.12) 40%,
              rgba(0,0,0,0.12) 100%)`,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '40%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: '#fff',
              border: `2px solid var(--color-editor-accent)`,
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            }}
          />
        </div>
      </div>

      <div
        style={{
          background: 'var(--color-editor-surface-soft)',
          padding: 12,
          borderRadius: 16,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--color-editor-text)',
            marginBottom: 8,
          }}
        >
          色板示例
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ec4899'].map(
            (c) => (
              <div
                key={c}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: c,
                  border: `2px solid var(--color-editor-surface)`,
                  outline: `1px solid var(--color-editor-border)`,
                }}
              />
            ),
          )}
        </div>
      </div>
    </div>
  )
}
