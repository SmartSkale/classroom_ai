import { useNavigate } from 'react-router-dom'
import { Button } from '../Button'
import { useGeneration } from '../../context/generation-context'
import {
  OUTPUT_TYPES,
  ROUTES,
  outputRoute,
  quizTakeRoute,
  type OutputTypeId,
} from '../../utils/constants'
import './ProjectOutputNav.css'

const OUTPUT_LABELS: Record<OutputTypeId, { teacher: string; student?: string }> = {
  explanation: { teacher: 'View Explanation →' },
  quiz: { teacher: 'View Quiz →', student: 'Take Quiz →' },
  slides: { teacher: 'View Slides →' },
  flashcards: { teacher: 'View Flashcards →' },
  audio: { teacher: 'View Audio →' },
  video: { teacher: 'View Video →' },
  infographic: { teacher: 'View Infographic →' },
  illustration: { teacher: 'View Illustration →' },
}

function routeForOutput(projectId: string, output: OutputTypeId, studentView: boolean): string {
  if (output === 'quiz' && studentView) return quizTakeRoute(projectId)
  return outputRoute(projectId, output)
}

function isOutputVisible(output: OutputTypeId, studentView: boolean): boolean {
  return !(output === 'slides' && studentView)
}

interface ProjectOutputNavProps {
  projectId: string
  activeOutput: OutputTypeId
  projectName?: string
  sourceText?: string
  studentView?: boolean
}

export function ProjectOutputNav({
  projectId,
  activeOutput,
  projectName,
  sourceText,
  studentView = false,
}: ProjectOutputNavProps) {
  const navigate = useNavigate()
  const { jobs } = useGeneration()
  const job = jobs[projectId]

  const enabledOutputs = job?.outputs ?? OUTPUT_TYPES.map((t) => t.id)
  const navState = { name: projectName, text: sourceText || undefined }

  const visibleOutputs = enabledOutputs.filter(
    (output) =>
      output !== activeOutput &&
      isOutputVisible(output, studentView) &&
      (!job || job.outputs.includes(output)),
  )

  const primaryOutput = visibleOutputs.includes('quiz') ? 'quiz' : visibleOutputs[0]

  function goTo(output: OutputTypeId) {
    navigate(routeForOutput(projectId, output, studentView), { state: navState })
  }

  return (
    <footer className="project-output-nav">
      <div className="project-output-nav-actions" role="navigation" aria-label="Project outputs">
        {visibleOutputs.map((output) => {
          const labels = OUTPUT_LABELS[output]
          const label = studentView && labels.student ? labels.student : labels.teacher
          return (
            <Button
              key={output}
              variant={output === primaryOutput ? 'primary' : 'outline'}
              onClick={() => goTo(output)}
            >
              {label}
            </Button>
          )
        })}
        <Button
          variant={studentView ? 'ghost' : 'outline'}
          onClick={() => navigate(studentView ? ROUTES.dashboard : ROUTES.library)}
        >
          {studentView ? 'Back to Dashboard' : 'Project Library'}
        </Button>
      </div>
    </footer>
  )
}

export default ProjectOutputNav
