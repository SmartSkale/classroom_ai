import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { ROUTES } from '../../utils/constants'
import './ComingSoon.css'

interface ComingSoonProps {
  title: string
  description?: string
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  const navigate = useNavigate()
  const { id } = useParams()

  return (
    <div className="coming-soon">
      <div className="coming-soon-card">
        <div className="coming-soon-icon" aria-hidden="true">
          🚧
        </div>
        <h1>{title}</h1>
        <p>
          {description ??
            (id
              ? `This is where project “${id}” will open. This screen isn’t built yet.`
              : 'This screen isn’t built yet — it’s coming soon.')}
        </p>
        <Button variant="primary" onClick={() => navigate(ROUTES.dashboard)}>
          Back to Dashboard
        </Button>
      </div>
    </div>
  )
}

export default ComingSoon
