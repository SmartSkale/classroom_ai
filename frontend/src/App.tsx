import { useState } from 'react'
import { OUTPUT_LANGUAGE_LABELS, type ModelStack, type OutputLanguageCode } from './api'
import { Icon, type IconName } from './components/icons'
import { Field } from './components/ui'
import { SourceProvider } from './source/SourceProvider'
import { useSource } from './source/SourceContext'
import { FlashcardsTab } from './tabs/FlashcardsTab'
import { InfographicTab } from './tabs/InfographicTab'
import { LessonTab } from './tabs/LessonTab'
import { ListenTab } from './tabs/ListenTab'
import { PresenterTab } from './tabs/PresenterTab'
import { QuizTab } from './tabs/QuizTab'
import { SlidesTab } from './tabs/SlidesTab'
import { VideoTab } from './tabs/VideoTab'
import './App.css'

type TabId = 'lesson' | 'presenter' | 'quiz' | 'slides' | 'flashcards' | 'infographic' | 'listen' | 'video'

const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'lesson', label: 'Lesson', icon: 'lesson' },
  { id: 'presenter', label: 'Presenter', icon: 'presenter' },
  { id: 'quiz', label: 'Quiz', icon: 'quiz' },
  { id: 'slides', label: 'Slides', icon: 'slides' },
  { id: 'flashcards', label: 'Flashcards', icon: 'cards' },
  { id: 'infographic', label: 'Infographic', icon: 'image' },
  { id: 'listen', label: 'Listen', icon: 'audio' },
  { id: 'video', label: 'Video', icon: 'video' },
]

function tabFromHash(): TabId {
  const id = window.location.hash.replace('#', '') as TabId
  return TABS.some((t) => t.id === id) ? id : 'lesson'
}

/** Tabs stay mounted and are hidden, so each one keeps its results when you switch. The URL hash tracks the open tab. */
function Workspace() {
  const s = useSource()
  const [tab, setTabState] = useState<TabId>(tabFromHash)
  const current = TABS.find((t) => t.id === tab)

  const setTab = (next: TabId) => {
    setTabState(next)
    window.history.replaceState(null, '', `#${next}`)
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src="/favicon.svg" alt="" />
          <div>
            <strong>ClassroomAI</strong>
            <span>Lesson studio</span>
          </div>
        </div>

        <nav className="nav" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="nav-item"
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon} size={20} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <span className="chip">{s.stack === 'openai' ? 'OpenAI stack' : 'Open-source stack'}</span>
          <span className="muted">Output: {OUTPUT_LANGUAGE_LABELS[s.outputLanguage]}</span>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">
            <span className="muted">ClassroomAI</span>
            <span aria-hidden="true">/</span>
            <strong>{current?.label}</strong>
          </div>
          <div className="topbar-controls">
            <Field label="Model stack">
              <select value={s.stack} onChange={(e) => s.setStack(e.target.value as ModelStack)}>
                <option value="opensource">Open source (Ollama + local)</option>
                <option value="openai">OpenAI</option>
              </select>
            </Field>
            <Field label="Output language">
              <select value={s.outputLanguage} onChange={(e) => s.setOutputLanguage(e.target.value as OutputLanguageCode)}>
                <option value="english">English</option>
                <option value="hindi">Hindi (देवनागरी)</option>
                <option value="roman_hindi">Roman Hindi</option>
              </select>
            </Field>
          </div>
        </header>

        <main className="content">
          <section hidden={tab !== 'lesson'}>
            <LessonTab />
          </section>
          <section hidden={tab !== 'presenter'}>
            <PresenterTab active={tab === 'presenter'} />
          </section>
          <section hidden={tab !== 'quiz'}>
            <QuizTab />
          </section>
          <section hidden={tab !== 'slides'}>
            <SlidesTab active={tab === 'slides'} />
          </section>
          <section hidden={tab !== 'flashcards'}>
            <FlashcardsTab active={tab === 'flashcards'} />
          </section>
          <section hidden={tab !== 'infographic'}>
            <InfographicTab />
          </section>
          <section hidden={tab !== 'listen'}>
            <ListenTab />
          </section>
          <section hidden={tab !== 'video'}>
            <VideoTab />
          </section>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <SourceProvider>
      <Workspace />
    </SourceProvider>
  )
}
