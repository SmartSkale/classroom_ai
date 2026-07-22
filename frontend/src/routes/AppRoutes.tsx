import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { MainLayout } from '../layouts/MainLayout'
import { AuthLayout } from '../layouts/AuthLayout'
import { DashboardLayout } from '../layouts/DashboardLayout'
import { Home } from '../pages/Home'
import { Login } from '../pages/Login'
import { Dashboard } from '../pages/Dashboard'
import { Profile } from '../pages/Profile'
import { Settings } from '../pages/Settings'
import { Upload } from '../pages/Upload'
import { Processing } from '../pages/Processing'
import { Quiz } from '../pages/Quiz'
import { QuizTake } from '../pages/QuizTake'
import { SharedLesson } from '../pages/SharedLesson'
import { QuizResults } from '../pages/QuizResults'
import { Slides, SlidesPreview } from '../pages/Slides'
import { Flashcards } from '../pages/Flashcards'
import { Audio } from '../pages/Audio'
import { Infographic } from '../pages/Infographic'
import { Illustration } from '../pages/Illustration'
import { Explanation } from '../pages/Explanation'
import { Library } from '../pages/Library'
import { Groups } from '../pages/Groups'
import { Video } from '../pages/Video'
import { ComingSoon } from '../pages/ComingSoon'
import { Loader } from '../components/Loader'
import { useAuth } from '../hooks/useAuth'
import { ROUTES } from '../utils/constants'

function ProtectedRoute() {
  const { isAuthenticated, status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <Loader fullscreen />
  if (!isAuthenticated) {
    return (
      <Navigate
        to={ROUTES.login}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }
  return <Outlet />
}

/** Logged-in users keep the dashboard sidebar on the home page. */
function HomeRouteLayout() {
  const { isAuthenticated, status } = useAuth()
  if (status === 'loading') return <Loader fullscreen />
  if (isAuthenticated) return <DashboardLayout />
  return <MainLayout />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.home} element={<HomeRouteLayout />}>
        <Route index element={<Home />} />
      </Route>

      {/* Shared lesson link — login required, then opens assignment */}
      <Route element={<ProtectedRoute />}>
        <Route path="/q/:id" element={<SharedLesson />} />
      </Route>

      {/* Authenticated app shell with collapsible sidebar */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path={ROUTES.dashboard} element={<Dashboard />} />
          <Route path={ROUTES.profile} element={<Profile />} />
          <Route path={ROUTES.settings} element={<Settings />} />
          <Route
            path={ROUTES.billing}
            element={
              <ComingSoon
                title="Upgrade Plan"
                description="Billing and subscription upgrades are coming soon."
              />
            }
          />
          <Route path={ROUTES.library} element={<Library />} />
          <Route path={ROUTES.groups} element={<Groups />} />
          <Route path={ROUTES.upload} element={<Upload />} />
          <Route path={ROUTES.processing} element={<Processing />} />
          <Route path="/projects/:id/quiz/results" element={<QuizResults />} />
          <Route path="/projects/:id/quiz/take" element={<QuizTake />} />
          <Route path="/projects/:id/quiz" element={<Quiz />} />
          <Route path="/projects/:id/slides/preview" element={<SlidesPreview />} />
          <Route path="/projects/:id/slides" element={<Slides />} />
          <Route path="/projects/:id/flashcards" element={<Flashcards />} />
          <Route path="/projects/:id/audio" element={<Audio />} />
          <Route path="/projects/:id/infographic" element={<Infographic />} />
          <Route path="/projects/:id/illustration" element={<Illustration />} />
          <Route path="/projects/:id/video" element={<Video />} />
          <Route path="/projects/:id" element={<Explanation />} />
        </Route>
      </Route>

      {/* Auth */}
      <Route element={<AuthLayout />}>
        <Route path={ROUTES.login} element={<Login />} />
      </Route>

      <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
    </Routes>
  )
}

export default AppRoutes
