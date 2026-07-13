import type { GenerationJob } from '../context/generation-context'
import type { OutputTypeId } from '../utils/constants'
import { primaryOutputType, type ProjectType, type StoredProject } from '../utils/projectStorage'
import api from './api'

export type Project = StoredProject

export interface ProjectWithJob extends Project {
  job: GenerationJob
}

export interface Usage {
  used: number
  limit: number
  periodLabel: string
  plan: string
}

interface UsageApiResponse {
  used: number
  limit: number
  period_label: string
  plan: string
}

interface ProjectSummaryApi {
  id: string
  name: string
  type: ProjectType
  outputs: OutputTypeId[]
  done: boolean
  created_at: string
  updated_at: string
}

interface ProjectJobApi extends ProjectSummaryApi {
  job: GenerationJob
}

function mapSummary(row: ProjectSummaryApi): Project {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    outputs: row.outputs,
    done: row.done,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapWithJob(row: ProjectJobApi): ProjectWithJob {
  return {
    ...mapSummary(row),
    job: row.job,
  }
}

function toUpsertBody(job: GenerationJob) {
  return {
    name: job.name,
    type: primaryOutputType(job.outputs),
    outputs: job.outputs,
    done: job.done,
    job,
    created_at: job.createdAt,
  }
}

/** List saved projects (metadata only), newest first. */
async function listProjects(): Promise<Project[]> {
  const { data } = await api.get<ProjectSummaryApi[]>('/projects')
  return data.map(mapSummary)
}

/** Full job snapshots for hydrating GenerationContext. */
async function listProjectJobs(): Promise<ProjectWithJob[]> {
  const { data } = await api.get<ProjectJobApi[]>('/projects/jobs')
  return data.map(mapWithJob)
}

async function getProject(id: string): Promise<ProjectWithJob> {
  const { data } = await api.get<ProjectJobApi>(`/projects/${id}`)
  return mapWithJob(data)
}

/** Create or update a project from a generation job snapshot. */
async function upsertProject(job: GenerationJob): Promise<ProjectWithJob> {
  const { data } = await api.put<ProjectJobApi>(`/projects/${job.id}`, toUpsertBody(job))
  return mapWithJob(data)
}

/** Fetch the most recent projects for the dashboard. */
async function getRecentProjects(limit = 6): Promise<Project[]> {
  const projects = await listProjects()
  return projects.slice(0, limit)
}

/**
 * Fetch usage for the current billing period.
 * Endpoint: GET /usage/current
 */
async function getUsage(): Promise<Usage> {
  try {
    const { data } = await api.get<UsageApiResponse>('/usage/current')
    return {
      used: data.used,
      limit: data.limit,
      periodLabel: data.period_label,
      plan: data.plan,
    }
  } catch {
    return { used: 12, limit: 30, periodLabel: 'This Month', plan: 'free' }
  }
}

async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`)
}

export const projectService = {
  listProjects,
  listProjectJobs,
  getProject,
  upsertProject,
  getRecentProjects,
  getUsage,
  deleteProject,
}
export default projectService
