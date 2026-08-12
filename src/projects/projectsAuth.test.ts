import { describe, expect, it } from 'vitest'
import {
  canWriteProjectsApi,
  normalizeProjectsRole,
  projectsApiBearerToken,
  projectsRoleFromSearch,
  resolveProjectsRole,
} from './projectsAuth.ts'

describe('normalizeProjectsRole', () => {
  it('maps air aliases', () => {
    expect(normalizeProjectsRole('air')).toBe('air')
    expect(normalizeProjectsRole('AIR-ONLY')).toBe('air')
  })

  it('defaults unknown / empty to editor', () => {
    expect(normalizeProjectsRole(undefined)).toBe('editor')
    expect(normalizeProjectsRole('')).toBe('editor')
    expect(normalizeProjectsRole('ops')).toBe('editor')
  })
})

describe('projectsRoleFromSearch', () => {
  it('reads projectsRole or role query', () => {
    expect(projectsRoleFromSearch('?projectsRole=air')).toBe('air')
    expect(projectsRoleFromSearch('role=air')).toBe('air')
    expect(projectsRoleFromSearch('?race=demo')).toBeUndefined()
  })
})

describe('resolveProjectsRole / canWriteProjectsApi', () => {
  it('query overrides config', () => {
    expect(
      resolveProjectsRole({ projectsRole: 'editor' }, '?role=air'),
    ).toBe('air')
    expect(
      canWriteProjectsApi({ projectsRole: 'editor' }, '?projectsRole=air'),
    ).toBe(false)
  })

  it('air config disables writes', () => {
    expect(canWriteProjectsApi({ projectsRole: 'air' })).toBe(false)
    expect(canWriteProjectsApi({ projectsRole: 'editor' })).toBe(true)
  })
})

describe('projectsApiBearerToken', () => {
  it('trims or omits empty', () => {
    expect(projectsApiBearerToken({ projectsApiToken: '  secret  ' })).toBe(
      'secret',
    )
    expect(projectsApiBearerToken({ projectsApiToken: '  ' })).toBeUndefined()
  })
})
