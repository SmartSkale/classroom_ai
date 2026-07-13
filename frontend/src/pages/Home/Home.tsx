import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { ROUTES } from '../../utils/constants'
import './Home.css'

type Feature = {
  icon: string
  title: string
  description: string
}

const FEATURES: Feature[] = [
  {
    icon: '📖',
    title: 'Explanations',
    description: 'Clear, structured explanations of any chapter in your chosen language.',
  },
  {
    icon: '❓',
    title: 'Quizzes',
    description: 'Auto-generated multiple-choice questions with answers and rationale.',
  },
  {
    icon: '🖥️',
    title: 'Slides',
    description: 'Ready-to-present decks with hero titles, visuals and speaker notes.',
  },
  {
    icon: '🗂️',
    title: 'Flashcards',
    description: 'Printable study cards your students can review before class.',
  },
  {
    icon: '🎧',
    title: 'Audio',
    description: 'Natural narration of your lessons for listening on the go.',
  },
  {
    icon: '🎬',
    title: 'Video',
    description: 'Short educational clips built straight from the source material.',
  },
  {
    icon: '📊',
    title: 'Infographics',
    description: 'Visual summaries with timelines, comparisons, and mind maps.',
  },
]

const TEACHER_STEPS = [
  { step: '1', title: 'Sign up free', detail: 'Create a teacher account in under a minute.' },
  { step: '2', title: 'Upload content', detail: 'Drop a PDF chapter or paste your lesson text.' },
  { step: '3', title: 'Pick outputs', detail: 'Choose explanations, quizzes, slides, and more.' },
  { step: '4', title: 'Watch AI work', detail: 'Track real-time progress as each asset is generated.' },
  { step: '5', title: 'Review & download', detail: 'Open each output, then download for your class.' },
  { step: '6', title: 'Revisit anytime', detail: 'Return to your Project Library to regenerate materials.' },
]

const STUDENT_STEPS = [
  { step: '1', title: 'Open a shared link', detail: 'Use the link from your teacher or log in with student credentials.' },
  { step: '2', title: 'See assigned lessons', detail: 'Your dashboard lists every lesson shared with you.' },
  { step: '3', title: 'Read the explanation', detail: 'Open the lesson and work through the chapter summary.' },
  { step: '4', title: 'Take the quiz', detail: 'Answer questions attached to the lesson and submit.' },
  { step: '5', title: 'Review results', detail: 'Check your score and read explanations for wrong answers.' },
  { step: '6', title: 'Reinforce learning', detail: 'Flip through flashcards, listen to audio, or watch the video.' },
]

export function Home() {
  return (
    <div className="home">
      <section className="home-hero" id="home">
        <p className="home-eyebrow">AI-powered teaching materials</p>
        <h1 className="home-headline">
          Convert any textbook chapter into teaching materials in minutes.
        </h1>
        <p className="home-subhead">
          Upload a chapter, PDF, or screenshot and instantly get explanations, quizzes,
          slides, flashcards, audio, video, and infographics — all from a single source.
        </p>
        <div className="home-hero-actions">
          <Link to={ROUTES.login} state={{ mode: 'register' }}>
            <Button variant="primary" size="lg">
              Get Started Free
            </Button>
          </Link>
          <a href="#how-it-works">
            <Button variant="outline" size="lg">
              See How It Works
            </Button>
          </a>
        </div>
      </section>

      <section className="home-journey" id="how-it-works">
        <h2 className="home-section-title">The teacher journey</h2>
        <ol className="home-steps">
          {TEACHER_STEPS.map((item) => (
            <li key={item.step} className="home-step">
              <span className="home-step-num" aria-hidden="true">
                {item.step}
              </span>
              <div>
                <h3 className="home-step-title">{item.title}</h3>
                <p className="home-step-detail">{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-journey home-journey-student" id="student-journey">
        <h2 className="home-section-title">The student journey</h2>
        <ol className="home-steps">
          {STUDENT_STEPS.map((item) => (
            <li key={item.step} className="home-step">
              <span className="home-step-num" aria-hidden="true">
                {item.step}
              </span>
              <div>
                <h3 className="home-step-title">{item.title}</h3>
                <p className="home-step-detail">{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-features" id="features">
        <h2 className="home-section-title">Everything you need for class</h2>
        <div className="home-features-grid">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="feature-card">
              <div className="feature-icon" aria-hidden="true">
                {feature.icon}
              </div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-desc">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export default Home
