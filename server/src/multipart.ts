/**
 * Minimal multipart/form-data parser for a single file upload (+ text fields).
 * No extra deps — body is buffered with a hard byte cap, then parts are split
 * on the boundary. Sufficient for POST /api/assets (one file + optional label).
 */

import type { IncomingMessage } from 'node:http'

export type MultipartFile = {
  fieldName: string
  filename: string
  contentType: string | undefined
  data: Buffer
}

export type MultipartResult = {
  fields: Record<string, string>
  files: MultipartFile[]
}

export type MultipartParseError = {
  status: number
  error: string
}

function parseContentDisposition(header: string): {
  name?: string
  filename?: string
} {
  const nameMatch = /(?:^|;)\s*name="([^"]*)"/i.exec(header)
  const filenameMatch = /(?:^|;)\s*filename="([^"]*)"/i.exec(header)
  // RFC 5987 filename*=UTF-8''…
  const filenameStar = /(?:^|;)\s*filename\*=(?:UTF-8'')?([^;]+)/i.exec(header)
  let filename = filenameMatch?.[1]
  if (filenameStar?.[1]) {
    try {
      filename = decodeURIComponent(filenameStar[1].trim().replace(/^"|"$/g, ''))
    } catch {
      filename = filenameStar[1].trim()
    }
  }
  return {
    name: nameMatch?.[1],
    filename: filename?.replace(/\\"/g, '"'),
  }
}

function extractBoundary(contentType: string | undefined): string | undefined {
  if (!contentType) return undefined
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)
  if (!m) return undefined
  const b = (m[1] ?? m[2] ?? '').trim()
  return b || undefined
}

/**
 * Read the request body up to `maxBytes` (inclusive). Oversize → 413.
 */
export async function readRequestBody(
  req: IncomingMessage,
  maxBytes: number,
): Promise<
  | { ok: true; buffer: Buffer }
  | { ok: false; status: number; error: string }
> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buf.length
    if (total > maxBytes) {
      return { ok: false, status: 413, error: 'body_too_large' }
    }
    chunks.push(buf)
  }
  return { ok: true, buffer: Buffer.concat(chunks) }
}

/**
 * Parse a buffered multipart body. Returns structured fields/files or an error.
 */
export function parseMultipartBuffer(
  buffer: Buffer,
  contentType: string | undefined,
): MultipartResult | MultipartParseError {
  const boundary = extractBoundary(contentType)
  if (!boundary) {
    return { status: 400, error: 'missing_boundary' }
  }

  const delim = Buffer.from(`--${boundary}`)
  const parts: Buffer[] = []
  let start = indexOfBuffer(buffer, delim, 0)
  if (start === -1) {
    return { status: 400, error: 'invalid_multipart' }
  }
  start += delim.length
  // Optional CRLF after opening boundary
  if (buffer[start] === 0x0d && buffer[start + 1] === 0x0a) start += 2

  while (start < buffer.length) {
    const next = indexOfBuffer(buffer, delim, start)
    if (next === -1) break
    // Part ends just before CRLF--boundary or --boundary
    let partEnd = next
    if (buffer[partEnd - 2] === 0x0d && buffer[partEnd - 1] === 0x0a) {
      partEnd -= 2
    }
    parts.push(buffer.subarray(start, partEnd))
    start = next + delim.length
    // Closing boundary ends with --
    if (buffer[start] === 0x2d && buffer[start + 1] === 0x2d) break
    if (buffer[start] === 0x0d && buffer[start + 1] === 0x0a) start += 2
  }

  const fields: Record<string, string> = {}
  const files: MultipartFile[] = []

  for (const part of parts) {
    if (part.length === 0) continue
    const headerEnd = indexOfBuffer(part, Buffer.from('\r\n\r\n'), 0)
    if (headerEnd === -1) continue
    const headerText = part.subarray(0, headerEnd).toString('utf8')
    const body = part.subarray(headerEnd + 4)
    const headers = parsePartHeaders(headerText)
    const disp = headers['content-disposition']
    if (!disp) continue
    const { name, filename } = parseContentDisposition(disp)
    if (!name) continue
    if (filename !== undefined && filename !== '') {
      files.push({
        fieldName: name,
        filename: basenameSafe(filename),
        contentType: headers['content-type'],
        data: body,
      })
    } else {
      fields[name] = body.toString('utf8')
    }
  }

  return { fields, files }
}

function parsePartHeaders(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of raw.split(/\r\n/)) {
    const i = line.indexOf(':')
    if (i === -1) continue
    const key = line.slice(0, i).trim().toLowerCase()
    const val = line.slice(i + 1).trim()
    out[key] = val
  }
  return out
}

function basenameSafe(filename: string): string {
  const normalized = filename.replace(/\\/g, '/')
  const base = normalized.split('/').pop() ?? filename
  return base.trim() || 'upload.bin'
}

function indexOfBuffer(haystack: Buffer, needle: Buffer, from: number): number {
  return haystack.indexOf(needle, from)
}
