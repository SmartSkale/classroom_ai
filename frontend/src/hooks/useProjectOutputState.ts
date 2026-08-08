import type { GenerationJob } from '../context/generation-context'
import type { OutputTypeId } from '../utils/constants'
import {
  getOutputGeneratingLabel,
  isOutputStepActive,
} from '../utils/projectStatus'

interface UseProjectOutputStateResult {
  /** Local page regen or project pipeline regen for this output. */
  isGenerating: boolean
  /** Loader label while `isGenerating` is true. */
  generatingLabel: string
  /** Project pipeline is (re)generating this output (not a one-off page action). */
  pipelineGenerating: boolean
}

/**
 * Combine per-page loading (Regenerate button) with project pipeline step status
 * so output pages show a generating state during full project regeneration too.
 */
export function useProjectOutputState(
  job: GenerationJob | undefined,
  stepKey: OutputTypeId,
  localLoading: boolean,
  defaultLabel: string,
): UseProjectOutputStateResult {
  const pipelineGenerating = isOutputStepActive(job, stepKey)
  const isGenerating = localLoading || pipelineGenerating
  const generatingLabel = localLoading
    ? defaultLabel
    : getOutputGeneratingLabel(job, stepKey, defaultLabel)

  return { isGenerating, generatingLabel, pipelineGenerating }
}
