import { createPatternGrid } from '../../core/pattern/grid'
import { CanvasStage } from '../../platform/web/CanvasStage'

const previewPattern = createPatternGrid({
  width: 12,
  height: 10,
  palette: ['#1f1812', '#b64f2b', '#e7ad4f', '#f6e8d1'],
})

export function EditorShell() {
  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
      <section>
        <div className="rounded-[28px] border border-editor-border bg-editor-surface p-8 shadow-editor">
          <p className="mb-3.5 text-[13px] font-bold tracking-[0.16em] text-editor-accent uppercase">
            Bead Pattern Editor
          </p>
          <h1 className="m-0 max-w-3xl text-[clamp(38px,6vw,72px)] leading-[0.95] font-bold tracking-[-0.06em] text-editor-strong">
            把图片快速转成可编辑的像素珠子图。
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-editor-text">
            第一阶段先专注 Web：图片转换、颜色替换、画布编辑、导出 PNG。
            核心算法和数据模型会保持平台无关，方便以后迁移到 React Native。
          </p>

          <div className="mt-7 grid grid-cols-1 gap-3 md:grid-cols-3">
            <article className="min-h-30 rounded-2xl bg-editor-surface-soft p-4.5 text-editor-text">
              <strong className="mb-2.5 block text-editor-strong">
                01. Image
              </strong>
              上传图片后用调色板约束颜色，逐步接入量化和抖动算法。
            </article>
            <article className="min-h-30 rounded-2xl bg-editor-surface-soft p-4.5 text-editor-text">
              <strong className="mb-2.5 block text-editor-strong">
                02. Pattern
              </strong>
              网格、历史栈、填充、替换颜色都沉到 core 层，避免绑死 UI。
            </article>
            <article className="min-h-30 rounded-2xl bg-editor-surface-soft p-4.5 text-editor-text">
              <strong className="mb-2.5 block text-editor-strong">
                03. Export
              </strong>
              先输出 PNG 和项目 JSON，后续再扩展分享、模板和移动端能力。
            </article>
          </div>
        </div>

        <CanvasStage pattern={previewPattern} />
      </section>

      <aside className="rounded-[28px] border border-editor-border bg-editor-surface p-6 shadow-editor">
        <h2 className="m-0 mb-3 text-2xl font-bold text-editor-strong">
          项目骨架
        </h2>
        <div className="py-4">
          <h3 className="m-0 mb-2.5 text-base font-bold text-editor-strong">
            核心原则
          </h3>
          <p className="text-editor-text">
            组件负责交互，core 负责算法和数据，platform/web 负责 Canvas 适配。
          </p>
        </div>
        <div className="border-t border-editor-border py-4">
          <h3 className="m-0 mb-2.5 text-base font-bold text-editor-strong">
            下一步
          </h3>
          <ul className="m-0 list-disc pl-5 text-editor-text">
            <li>建立真实编辑器状态和撤销重做。</li>
            <li>迁移 HTML 原型中验证过的颜色和导出逻辑。</li>
            <li>补移动浏览器触摸交互和响应式布局。</li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
