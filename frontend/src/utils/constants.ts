export const APP_NAME = 'ClassroomAI'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export const TOKEN_STORAGE_KEY = 'classroomai.token'

export const ROUTES = {
  home: '/',
  login: '/login',
  dashboard: '/dashboard',
  profile: '/profile',
  billing: '/billing',
  library: '/library',
  groups: '/groups',
  upload: '/upload',
  processing: '/processing',
} as const

export const projectRoute = (id: string | number) => `/projects/${id}`
export const quizRoute = (id: string | number) => `/projects/${id}/quiz`
export const quizResultsRoute = (id: string | number) => `/projects/${id}/quiz/results`
export const quizTakeRoute = (id: string | number) => `/projects/${id}/quiz/take`
export const sharedLessonRoute = (id: string | number) => `/q/${id}`
export const slidesRoute = (id: string | number) => `/projects/${id}/slides`
export const slidesPreviewRoute = (id: string | number) => `/projects/${id}/slides/preview`
export const flashcardsRoute = (id: string | number) => `/projects/${id}/flashcards`
export const audioRoute = (id: string | number) => `/projects/${id}/audio`
export const videoRoute = (id: string | number) => `/projects/${id}/video`
export const infographicRoute = (id: string | number) => `/projects/${id}/infographic`

/** Minimum fraction correct to pass a quiz. */
export const QUIZ_PASS_THRESHOLD = 0.6

/** Quiz configuration options. Backend currently supports 1–15 questions. */
export const QUIZ_COUNT_MIN = 5
export const QUIZ_COUNT_MAX = 15
export const QUIZ_COUNT_OPTIONS = [5, 10, 15] as const

export const QUESTION_TYPES = [
  { id: 'mcq', label: 'MCQ' },
  { id: 'truefalse', label: 'True/False' },
  { id: 'fill', label: 'Fill-in-the-blank' },
] as const

export type QuestionTypeId = (typeof QUESTION_TYPES)[number]['id']

export const DIFFICULTIES = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
] as const

export type Difficulty = (typeof DIFFICULTIES)[number]['id']

/**
 * Slide configuration. The backend accepts 4–20 slides; we expose 5–20 to
 * match the product spec's lower bound while staying within the API limit.
 */
export const SLIDE_COUNT_MIN = 5
export const SLIDE_COUNT_MAX = 20
export const SLIDE_COUNT_OPTIONS = [5, 10, 15, 20] as const

export const SLIDE_THEMES = [
  { id: 'professional_dark', label: 'Professional Dark' },
  { id: 'light', label: 'Light' },
  { id: 'vibrant', label: 'Vibrant' },
  { id: 'minimal', label: 'Minimal' },
] as const

export type SlideThemeId = (typeof SLIDE_THEMES)[number]['id']

/**
 * Audio (text-to-speech) options. Voices map to the backend's OpenAI TTS voices
 * (alloy | echo | fable | onyx | nova | shimmer). Speed is applied client-side
 * to the player's playback rate (the TTS endpoint does not take a speed param).
 */
export const AUDIO_VOICES = [
  { id: 'nova', label: 'Female — Nova' },
  { id: 'shimmer', label: 'Female — Shimmer' },
  { id: 'alloy', label: 'Neutral — Alloy' },
  { id: 'echo', label: 'Male — Echo' },
  { id: 'onyx', label: 'Male — Onyx' },
  { id: 'fable', label: 'Male — Fable' },
] as const

export type AudioVoiceId = (typeof AUDIO_VOICES)[number]['id']

export const AUDIO_SPEEDS = [
  { id: 'slow', label: 'Slow', rate: 0.75 },
  { id: 'normal', label: 'Normal', rate: 1 },
  { id: 'fast', label: 'Fast', rate: 1.25 },
] as const

export type AudioSpeedId = (typeof AUDIO_SPEEDS)[number]['id']

export const AUDIO_LANGUAGES = [
  { id: 'english', label: 'English' },
  { id: 'hindi', label: 'Hindi' },
  { id: 'roman_hindi', label: 'Roman Hindi' },
] as const

export type AudioLanguageId = (typeof AUDIO_LANGUAGES)[number]['id']

/**
 * Infographic options. Layout + color are composed into the `style` string the
 * backend appends to the image-generation prompt.
 */
export const INFOGRAPHIC_LAYOUTS = [
  { id: 'timeline', label: 'Timeline', prompt: 'horizontal timeline layout with sequential milestones and connectors' },
  { id: 'comparison', label: 'Comparison', prompt: 'side-by-side comparison layout with two balanced columns' },
  { id: 'step_by_step', label: 'Step-by-step', prompt: 'numbered step-by-step vertical flow layout with arrows' },
  { id: 'mind_map', label: 'Mind Map', prompt: 'central mind-map layout with branching nodes radiating outward' },
] as const

export type InfographicLayoutId = (typeof INFOGRAPHIC_LAYOUTS)[number]['id']

export const INFOGRAPHIC_COLORS = [
  { id: 'teal_navy', label: 'Teal & Navy', prompt: 'teal and deep navy blue palette' },
  { id: 'sunset', label: 'Sunset', prompt: 'warm sunset orange, coral and pink palette' },
  { id: 'forest', label: 'Forest', prompt: 'forest green and earthy brown palette' },
  { id: 'purple_gold', label: 'Purple & Gold', prompt: 'royal purple and gold palette' },
  { id: 'monochrome', label: 'Monochrome', prompt: 'clean monochrome grayscale palette' },
] as const

export type InfographicColorId = (typeof INFOGRAPHIC_COLORS)[number]['id']

/** Upload constraints (mirror the backend limits). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50 MB
export const MAX_TEXT_LENGTH = 10_000
export const PROJECT_NAME_MIN = 3
export const PROJECT_NAME_MAX = 80
export const ACCEPTED_FILE_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'docx'] as const

export const OUTPUT_TYPES = [
  { id: 'explanation', label: 'Explanation' },
  { id: 'quiz', label: 'Quiz' },
  { id: 'slides', label: 'Slides' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'audio', label: 'Audio' },
  { id: 'video', label: 'Video' },
  { id: 'illustration', label: 'Illustration' },
  { id: 'infographic', label: 'Infographic' },
] as const

export type OutputTypeId = (typeof OUTPUT_TYPES)[number]['id']

export const DEFAULT_OUTPUT_TYPES: OutputTypeId[] = ['explanation', 'quiz', 'slides']

export const USER_ROLES = {
  teacher: 'teacher',
  student: 'student',
  courseCreator: 'course_creator',
  admin: 'admin',
} as const

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

/** Roles a user may choose during public registration (admin is created server-side only). */
export const SIGNUP_ROLE_OPTIONS = [
  {
    id: 'student',
    title: "I'm a student",
    description: 'Learn from generated lessons',
    icon: '🎓',
  },
  {
    id: 'teacher',
    title: "I'm a teacher",
    description: 'Create teaching materials',
    icon: '✨',
  },
  {
    id: 'course_creator',
    title: "I'm a creator",
    description: 'Build & publish courses',
    icon: '🧩',
  },
] as const satisfies ReadonlyArray<{
  id: UserRole
  title: string
  description: string
  icon: string
}>
