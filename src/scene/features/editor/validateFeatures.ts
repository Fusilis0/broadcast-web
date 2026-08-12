import { gateBaseName } from '../../course/gatePairing.ts'
import type { WorldFeature } from '../types.ts'

export type ValidationSeverity = 'error' | 'warning'

export type FeatureValidationIssue = {
  severity: ValidationSeverity
  code: string
  message: string
  featureId?: string
}

export type FeatureValidationResult = {
  ok: boolean
  errors: FeatureValidationIssue[]
  warnings: FeatureValidationIssue[]
  issues: FeatureValidationIssue[]
}

function issue(
  severity: ValidationSeverity,
  code: string,
  message: string,
  featureId?: string,
): FeatureValidationIssue {
  return { severity, code, message, featureId }
}

/**
 * Authoring checks before Save / Export.
 * Errors block; warnings may proceed after confirm (caller decides).
 */
export function validateWorldFeatures(
  features: readonly WorldFeature[],
): FeatureValidationResult {
  const errors: FeatureValidationIssue[] = []
  const warnings: FeatureValidationIssue[] = []

  const leftByBase = new Map<string, WorldFeature[]>()
  const rightByBase = new Map<string, WorldFeature[]>()

  for (const f of features) {
    if (!f.name?.trim()) {
      errors.push(
        issue('error', 'empty_name', `Feature "${f.id}" has empty name`, f.id),
      )
    }

    if (!f.points || f.points.length === 0) {
      errors.push(
        issue(
          'error',
          'no_points',
          `${f.type} "${f.name || f.id}" has no points`,
          f.id,
        ),
      )
      continue
    }

    if (f.type === 'sponsor') {
      if (f.points.length < 2) {
        errors.push(
          issue(
            'error',
            'sponsor_missing_b',
            `Sponsor "${f.name || f.id}" missing point B`,
            f.id,
          ),
        )
      }
      if (!f.label?.trim()) {
        warnings.push(
          issue(
            'warning',
            'sponsor_empty_label',
            `Sponsor "${f.name || f.id}" has empty label`,
            f.id,
          ),
        )
      }
    }

    if (f.type === 'billboardChain') {
      if (f.points.length < 2) {
        errors.push(
          issue(
            'error',
            'chain_too_short',
            `Billboard chain "${f.name || f.id}" needs ≥2 points`,
            f.id,
          ),
        )
      }
      if (
        f.spacingM !== undefined &&
        (!Number.isFinite(f.spacingM) || f.spacingM <= 0)
      ) {
        errors.push(
          issue(
            'error',
            'chain_bad_spacing',
            `Billboard chain "${f.name || f.id}" has invalid spacingM`,
            f.id,
          ),
        )
      }
      if (f.spacingM === undefined) {
        warnings.push(
          issue(
            'warning',
            'chain_default_spacing',
            `Billboard chain "${f.name || f.id}" missing spacingM (default at remount)`,
            f.id,
          ),
        )
      }
    }

    if (f.type === 'buoy' && f.points.length < 1) {
      errors.push(
        issue(
          'error',
          'buoy_no_point',
          `Buoy "${f.name || f.id}" has no point`,
          f.id,
        ),
      )
    }

    if (f.type === 'gateLeft') {
      const base = gateBaseName(f.name)
      const list = leftByBase.get(base) ?? []
      list.push(f)
      leftByBase.set(base, list)
    } else if (f.type === 'gateRight') {
      const base = gateBaseName(f.name)
      const list = rightByBase.get(base) ?? []
      list.push(f)
      rightByBase.set(base, list)
    }

    for (const p of f.points) {
      if (
        !Number.isFinite(p.lat) ||
        !Number.isFinite(p.lon) ||
        !Number.isFinite(p.altMsl)
      ) {
        errors.push(
          issue(
            'error',
            'bad_coords',
            `${f.type} "${f.name || f.id}" has non-finite coordinates`,
            f.id,
          ),
        )
        break
      }
    }
  }

  const allBases = new Set([...leftByBase.keys(), ...rightByBase.keys()])
  for (const base of allBases) {
    const lefts = leftByBase.get(base) ?? []
    const rights = rightByBase.get(base) ?? []
    if (lefts.length > 0 && rights.length === 0) {
      for (const f of lefts) {
        errors.push(
          issue(
            'error',
            'orphan_gate_left',
            `Orphan gate left "${f.name}" (no matching -Right)`,
            f.id,
          ),
        )
      }
    } else if (rights.length > 0 && lefts.length === 0) {
      for (const f of rights) {
        errors.push(
          issue(
            'error',
            'orphan_gate_right',
            `Orphan gate right "${f.name}" (no matching -Left)`,
            f.id,
          ),
        )
      }
    } else if (lefts.length > 1 || rights.length > 1) {
      warnings.push(
        issue(
          'warning',
          'duplicate_gate_base',
          `Duplicate gate ends for base "${base}" (L=${lefts.length}, R=${rights.length})`,
          lefts[0]?.id ?? rights[0]?.id,
        ),
      )
    }
  }

  const issues = [...errors, ...warnings]
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    issues,
  }
}

/** One-line HUD summary; prefers first error, else first warning. */
export function formatValidationSummary(
  result: FeatureValidationResult,
): string {
  if (result.errors.length > 0) {
    const n = result.errors.length
    const first = result.errors[0]!.message
    return n === 1 ? `Invalid: ${first}` : `Invalid (${n}): ${first}`
  }
  if (result.warnings.length > 0) {
    const n = result.warnings.length
    const first = result.warnings[0]!.message
    return n === 1 ? `Warning: ${first}` : `Warnings (${n}): ${first}`
  }
  return 'Features OK'
}
