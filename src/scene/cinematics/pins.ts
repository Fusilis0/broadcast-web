/**
 * Cinematic pins + labels. Globe pins use GEO `geodeticToEcefMeters`.
 * Hero pins use `enuKeyframeToScene`. Always drawn on top of terrain
 * (`depthTest: false`); far-side globe markers still hide.
 *
 * Country chrome: `public/cinematics/pins/country.png` (empty flag circle).
 * Hero names: `public/cinematics/pins/name.png`. İstanbul: `place.png` (no flag).
 * Typeface: Allumi Std Extended Bold.
 */

import * as THREE from 'three'
import {
  enuKeyframeToScene,
  geodeticToEcefMeters,
} from '../../geodesy/index.ts'
import type { CinematicPin } from './types.ts'

/** Metres AMSL so globe markers sit above World Terrain LOD. */
export const CINEMATIC_PIN_ALT_MSL = 80_000
/** Fallback ENU height when the hero mesh AABB is not ready. */
export const CINEMATIC_HERO_PIN_ALT_MSL = 140

const PIN_FONT_FAMILY = 'Allumi Std Extended'
const PIN_FONT_URL = '/fonts/AllumiStdExtendedBold.otf'
const COUNTRY_TMPL_URL = '/cinematics/pins/country.png'
const NAME_TMPL_URL = '/cinematics/pins/name.png'
const PLACE_TMPL_URL = '/cinematics/pins/place.png'

/**
 * Source art is 1181×1181. Crop keeps the needle near the sprite bottom
 * so `sprite.center.y` stays below 0.08.
 */
type PinLayout = {
  cropX: number
  cropY: number
  cropW: number
  cropH: number
  anchorX: number
  anchorY: number
  scaleY: number
}

const COUNTRY_LAYOUT: PinLayout = {
  cropX: 345,
  cropY: 120,
  cropW: 730,
  cropH: 420,
  anchorX: 395,
  anchorY: 508,
  scaleY: 0.092,
}

const NAME_LAYOUT: PinLayout = {
  cropX: 662,
  cropY: 61,
  cropW: 498,
  cropH: 327,
  anchorX: 702,
  anchorY: 378,
  scaleY: 0.078,
}

const PLACE_LAYOUT: PinLayout = {
  cropX: 341,
  cropY: 360,
  cropW: 588,
  cropH: 238,
  anchorX: 381,
  anchorY: 580,
  scaleY: 0.07,
}

const FLAG_SRC = { cx: 896, cy: 306, r: 118 }
const COUNTRY_TEXT_SRC = { x: 512, y: 214, w: 155, h: 58 }
const NAME_TEXT_SRC = { x: 790, y: 86, w: 330, h: 108 }
const PLACE_TEXT_SRC = { x: 420, y: 434, w: 460, h: 42 }

const FOCUS_SCALE = 1.42
const FOCUS_LERP = 0.18

const COUNTRY_CODE: Record<string, string> = {
  usa: 'USA',
  canada: 'CAN',
  uk: 'UK',
  gbr: 'UK',
  russia: 'RUS',
  bulgaria: 'BGR',
  turkey: 'TUR',
  istanbul: 'IST',
}

const FLAG_PHOTO_URLS: Record<string, string> = {
  usa: '/cinematics/pins/flags/usa.webp',
  canada: '/cinematics/pins/flags/canada.webp',
  bulgaria: '/cinematics/pins/flags/bulgaria.webp',
}

export type CinematicPinFrame = 'globe' | 'enu'

export type GeodeticToEcefMetersFn = (
  lat: number,
  lon: number,
  altMsl: number,
) => { x: number; y: number; z: number }

export type EnuKeyframeToSceneFn = (
  lat: number,
  lon: number,
  altMsl: number,
) => { x: number; y: number; z: number }

export type HeroPinAnchorFn = (
  id: string,
) => { x: number; y: number; z: number } | null

export type CinematicPinsHandle = {
  root: THREE.Group
  setPins: (pins: readonly CinematicPin[]) => void
  setFrame: (frame: CinematicPinFrame) => void
  setVisible: (visible: boolean) => void
  update: (camera: THREE.Camera, focusId?: string | null) => void
  dispose: () => void
}

type PinAssets = {
  country: HTMLImageElement | null
  name: HTMLImageElement | null
  flags: Record<string, HTMLImageElement | null>
  place: HTMLImageElement | null
}

let assetsPromise: Promise<PinAssets> | null = null
let pinAssets: PinAssets = { country: null, name: null, place: null, flags: {} }

function isHeroPin(pin: CinematicPin): boolean {
  return pin.kind === 'hero'
}

function isPlacePin(pin: CinematicPin): boolean {
  return pin.kind === 'place' || pin.id.toLowerCase() === 'istanbul'
}

function layoutFor(pin: CinematicPin): PinLayout {
  if (isHeroPin(pin)) return NAME_LAYOUT
  if (isPlacePin(pin)) return PLACE_LAYOUT
  return COUNTRY_LAYOUT
}

function spriteCenter(layout: PinLayout): { x: number; y: number } {
  return {
    x: (layout.anchorX - layout.cropX) / layout.cropW,
    y: 1 - (layout.anchorY - layout.cropY) / layout.cropH,
  }
}

function flagKey(pin: CinematicPin): string | null {
  if (pin.flag) return pin.flag
  if (pin.kind === 'hero') return null
  const id = pin.id.toLowerCase()
  if (id === 'istanbul') return null
  if (
    id === 'usa' ||
    id === 'canada' ||
    id === 'uk' ||
    id === 'russia' ||
    id === 'bulgaria' ||
    id === 'turkey'
  ) {
    return id
  }
  return null
}

function countryHudText(pin: CinematicPin): string {
  const id = pin.id.toLowerCase()
  if (id === 'istanbul') return 'IST'
  const key = (pin.flag ?? pin.id).toLowerCase()
  if (COUNTRY_CODE[key]) return COUNTRY_CODE[key]
  const compact = pin.label.replace(/\s+/g, '')
  return compact.slice(0, 3).toLocaleUpperCase('en')
}

function pinFont(sizePx: number): string {
  return `700 ${sizePx}px "${PIN_FONT_FAMILY}", "Segoe UI", system-ui, sans-serif`
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (typeof Image === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

async function loadPinFont(): Promise<void> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') {
    return
  }
  try {
    const face = new FontFace(PIN_FONT_FAMILY, `url("${PIN_FONT_URL}")`, {
      weight: '700',
      style: 'normal',
    })
    const loaded = await face.load()
    document.fonts.add(loaded)
    await document.fonts.ready
  } catch {
    /* tests / missing file — canvas falls back to Segoe */
  }
}

function loadCinematicPinAssets(): Promise<PinAssets> {
  if (!assetsPromise) {
    const flagKeys = Object.keys(FLAG_PHOTO_URLS)
    assetsPromise = Promise.all([
      loadImage(COUNTRY_TMPL_URL),
      loadImage(NAME_TMPL_URL),
      loadImage(PLACE_TMPL_URL),
      loadPinFont(),
      ...flagKeys.map((key) => loadImage(FLAG_PHOTO_URLS[key]!)),
    ]).then(([country, name, place, _font, ...flagImgs]) => {
      const flags: Record<string, HTMLImageElement | null> = {}
      for (let i = 0; i < flagKeys.length; i++) {
        flags[flagKeys[i]!] = (flagImgs[i] as HTMLImageElement | null) ?? null
      }
      pinAssets = { country, name, place, flags }
      return pinAssets
    })
  }
  return assetsPromise
}

/** Keep PNG alpha. Only lift near-black fully opaque pixels (bad exports). */
function punchOpaqueBlack(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  let opaque = 0
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 200) opaque += 1
  }
  if (opaque < w * h * 0.6) return
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] + d[i + 1] + d[i + 2]) / 3
    if (lum < 18) {
      d[i + 3] = 0
    }
  }
  ctx.putImageData(img, 0, 0)
}

function drawFlag(
  ctx: CanvasRenderingContext2D,
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
  photo?: HTMLImageElement | null,
): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  const k = key.toLowerCase()
  if (photo && photo.naturalWidth > 0) {
    ctx.drawImage(photo, x, y, w, h)
    ctx.restore()
    return
  }
  if (k === 'usa') {
    ctx.fillStyle = '#bf0a30'
    ctx.fillRect(x, y, w, h)
    const stripeH = h / 13
    for (let i = 0; i < 13; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#bf0a30' : '#fff'
      ctx.fillRect(x, y + i * stripeH, w, stripeH + 0.5)
    }
    ctx.fillStyle = '#002868'
    ctx.fillRect(x, y, w * 0.4, stripeH * 7)
  } else if (k === 'canada') {
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#fff'
    ctx.fillRect(x + w * 0.28, y, w * 0.44, h)
    ctx.fillStyle = '#ff0000'
    ctx.beginPath()
    ctx.moveTo(x + w * 0.5, y + h * 0.22)
    ctx.lineTo(x + w * 0.58, y + h * 0.48)
    ctx.lineTo(x + w * 0.72, y + h * 0.42)
    ctx.lineTo(x + w * 0.58, y + h * 0.62)
    ctx.lineTo(x + w * 0.5, y + h * 0.82)
    ctx.lineTo(x + w * 0.42, y + h * 0.62)
    ctx.lineTo(x + w * 0.28, y + h * 0.42)
    ctx.lineTo(x + w * 0.42, y + h * 0.48)
    ctx.closePath()
    ctx.fill()
  } else if (k === 'uk') {
    ctx.fillStyle = '#012169'
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = Math.max(3, h * 0.22)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + w, y + h)
    ctx.moveTo(x + w, y)
    ctx.lineTo(x, y + h)
    ctx.stroke()
    ctx.strokeStyle = '#c8102e'
    ctx.lineWidth = Math.max(1.5, h * 0.1)
    ctx.stroke()
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = Math.max(4, h * 0.28)
    ctx.beginPath()
    ctx.moveTo(x + w / 2, y)
    ctx.lineTo(x + w / 2, y + h)
    ctx.moveTo(x, y + h / 2)
    ctx.lineTo(x + w, y + h / 2)
    ctx.stroke()
    ctx.strokeStyle = '#c8102e'
    ctx.lineWidth = Math.max(2, h * 0.14)
    ctx.stroke()
  } else if (k === 'russia') {
    ctx.fillStyle = '#fff'
    ctx.fillRect(x, y, w, h / 3)
    ctx.fillStyle = '#0039a6'
    ctx.fillRect(x, y + h / 3, w, h / 3)
    ctx.fillStyle = '#d52b1e'
    ctx.fillRect(x, y + (2 * h) / 3, w, h / 3)
  } else if (k === 'turkey') {
    ctx.fillStyle = '#e30a17'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(x + w * 0.4, y + h * 0.5, h * 0.28, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#e30a17'
    ctx.beginPath()
    ctx.arc(x + w * 0.48, y + h * 0.5, h * 0.22, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    const cx = x + w * 0.62
    const cy = y + h * 0.5
    const r = h * 0.12
    ctx.moveTo(cx, cy - r)
    for (let i = 1; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
  } else if (k === 'bulgaria') {
    ctx.fillStyle = '#fff'
    ctx.fillRect(x, y, w, h / 3)
    ctx.fillStyle = '#00966e'
    ctx.fillRect(x, y + h / 3, w, h / 3)
    ctx.fillStyle = '#d62612'
    ctx.fillRect(x, y + (2 * h) / 3, w, h / 3)
  } else {
    ctx.fillStyle = '#d8dde4'
    ctx.fillRect(x, y, w, h)
  }
  ctx.restore()
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [text]
  const lines: string[] = []
  let cur = words[0] ?? ''
  for (let i = 1; i < words.length; i++) {
    const trial = `${cur} ${words[i]}`
    if (ctx.measureText(trial).width <= maxW) {
      cur = trial
    } else {
      lines.push(cur)
      cur = words[i] ?? ''
    }
  }
  lines.push(cur)
  return lines.slice(0, 3)
}

function fillFittedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  maxSize: number,
  minSize: number,
  align: CanvasTextAlign,
): void {
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#f4f7fb'
  let size = maxSize
  let lines = [text]
  while (size >= minSize) {
    ctx.font = pinFont(size)
    lines = wrapLines(ctx, text, w)
    const widest = Math.max(...lines.map((ln) => ctx.measureText(ln).width), 0)
    const blockH = lines.length * size * 1.12
    if (widest <= w && blockH <= h) break
    size -= 1
  }
  const used = Math.max(minSize, size)
  ctx.font = pinFont(used)
  const lineH = used * 1.12
  const blockH = lines.length * lineH
  let ty = y + (h - blockH) / 2 + lineH / 2
  const tx = align === 'left' ? x : x + w / 2
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.lineWidth = Math.max(3, used * 0.14)
  ctx.strokeStyle = 'rgba(10, 14, 20, 0.78)'
  for (const ln of lines) {
    ctx.strokeText(ln, tx, ty, w)
    ctx.fillText(ln, tx, ty, w)
    ty += lineH
  }
}

function drawFallbackChrome(
  ctx: CanvasRenderingContext2D,
  layout: PinLayout,
  pin: CinematicPin,
): void {
  const ax = layout.anchorX - layout.cropX
  const ay = layout.anchorY - layout.cropY
  ctx.strokeStyle = '#f4f7fb'
  ctx.fillStyle = '#f4f7fb'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(ax, ay, 10, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(ax, ay, 4, 0, Math.PI * 2)
  ctx.fill()
  const text = isHeroPin(pin)
    ? NAME_TEXT_SRC
    : isPlacePin(pin)
      ? PLACE_TEXT_SRC
      : COUNTRY_TEXT_SRC
  const tx = text.x - layout.cropX
  const ty = text.y - layout.cropY
  ctx.beginPath()
  ctx.moveTo(ax + 8, ay - 8)
  ctx.lineTo(tx, ty + text.h)
  ctx.stroke()
  ctx.strokeRect(tx, ty, text.w, text.h)
}

function drawPinLabel(
  canvas: HTMLCanvasElement,
  pin: CinematicPin,
  assets: PinAssets,
): void {
  const layout = layoutFor(pin)
  canvas.width = layout.cropW
  canvas.height = layout.cropH
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, layout.cropW, layout.cropH)

  const tmpl = isHeroPin(pin)
    ? assets.name
    : isPlacePin(pin)
      ? assets.place
      : assets.country
  if (tmpl) {
    ctx.drawImage(
      tmpl,
      layout.cropX,
      layout.cropY,
      layout.cropW,
      layout.cropH,
      0,
      0,
      layout.cropW,
      layout.cropH,
    )
    punchOpaqueBlack(ctx, layout.cropW, layout.cropH)
  } else {
    drawFallbackChrome(ctx, layout, pin)
  }

  if (isPlacePin(pin)) {
    fillFittedText(
      ctx,
      pin.label,
      PLACE_TEXT_SRC.x - layout.cropX,
      PLACE_TEXT_SRC.y - layout.cropY,
      PLACE_TEXT_SRC.w,
      PLACE_TEXT_SRC.h,
      36,
      14,
      'center',
    )
    return
  }

  if (!isHeroPin(pin)) {
    const eraseX = COUNTRY_TEXT_SRC.x - layout.cropX
    const eraseY = COUNTRY_TEXT_SRC.y - layout.cropY
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = '#000'
    ctx.fillRect(eraseX - 4, eraseY - 4, COUNTRY_TEXT_SRC.w + 8, COUNTRY_TEXT_SRC.h + 6)
    ctx.restore()

    const flag = flagKey(pin)
    if (flag) {
      const fx = FLAG_SRC.cx - layout.cropX
      const fy = FLAG_SRC.cy - layout.cropY
      ctx.save()
      ctx.beginPath()
      ctx.arc(fx, fy, FLAG_SRC.r, 0, Math.PI * 2)
      ctx.clip()
      drawFlag(
        ctx,
        flag,
        fx - FLAG_SRC.r,
        fy - FLAG_SRC.r,
        FLAG_SRC.r * 2,
        FLAG_SRC.r * 2,
        assets.flags[flag] ?? null,
      )
      ctx.restore()
    }

    ctx.globalCompositeOperation = 'source-over'
    fillFittedText(
      ctx,
      countryHudText(pin),
      COUNTRY_TEXT_SRC.x - layout.cropX,
      COUNTRY_TEXT_SRC.y - layout.cropY,
      COUNTRY_TEXT_SRC.w,
      COUNTRY_TEXT_SRC.h,
      42,
      16,
      'center',
    )
    return
  }

  fillFittedText(
    ctx,
    pin.label,
    NAME_TEXT_SRC.x - layout.cropX,
    NAME_TEXT_SRC.y - layout.cropY,
    NAME_TEXT_SRC.w,
    NAME_TEXT_SRC.h,
    36,
    14,
    'center',
  )
}

function createPinSprite(
  pin: CinematicPin,
  assets: PinAssets,
): THREE.Sprite | null {
  if (typeof document === 'undefined') return null
  const layout = layoutFor(pin)
  const canvas = document.createElement('canvas')
  drawPinLabel(canvas, pin, assets)
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.needsUpdate = true
  const material = new THREE.SpriteMaterial({
    map,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: false,
    fog: false,
    toneMapped: false,
  })
  const sprite = new THREE.Sprite(material)
  sprite.name = `cinematicPin:${pin.id}`
  const c = spriteCenter(layout)
  sprite.center.set(c.x, c.y)
  const aspect = layout.cropW / layout.cropH
  sprite.scale.set(layout.scaleY * aspect, layout.scaleY, 1)
  sprite.renderOrder = 24
  sprite.userData.pinId = pin.id
  sprite.userData.hero = isHeroPin(pin)
  sprite.userData.baseScaleY = layout.scaleY
  sprite.userData.aspect = aspect
  sprite.userData.focus01 = 0
  return sprite
}

/**
 * Country pins (globe) and hero pins (ENU). `update` hides far-side globe
 * markers and pops the focused id.
 */
export function createCinematicPins(
  options: {
    geodeticToEcefMeters?: GeodeticToEcefMetersFn
    enuKeyframeToScene?: EnuKeyframeToSceneFn
    heroAnchor?: HeroPinAnchorFn
  } = {},
): CinematicPinsHandle {
  const toEcef = options.geodeticToEcefMeters ?? geodeticToEcefMeters
  const toEnu = options.enuKeyframeToScene ?? enuKeyframeToScene
  const heroAnchor = options.heroAnchor
  const root = new THREE.Group()
  root.name = 'cinematicPins'
  root.visible = false
  const disposables: Array<{
    tex?: THREE.Texture
    mat?: THREE.Material
  }> = []
  let pinList: readonly CinematicPin[] = []
  let frame: CinematicPinFrame = 'globe'
  let disposed = false
  let istanbulUnlocked = false

  function clear(): void {
    for (const child of root.children.slice()) {
      root.remove(child)
    }
    for (const d of disposables) {
      d.tex?.dispose()
      d.mat?.dispose()
    }
    disposables.length = 0
  }

  function placeSprite(sprite: THREE.Sprite, pin: CinematicPin): void {
    if (frame === 'enu') {
      const mesh = heroAnchor?.(pin.id)
      if (mesh) {
        sprite.position.set(mesh.x, mesh.y, mesh.z)
        return
      }
      const enu = toEnu(pin.lat, pin.lon, CINEMATIC_HERO_PIN_ALT_MSL)
      sprite.position.set(enu.x, enu.y, enu.z)
      return
    }
    const ecef = toEcef(pin.lat, pin.lon, CINEMATIC_PIN_ALT_MSL)
    sprite.position.set(ecef.x, ecef.y, ecef.z)
  }

  function rebuild(): void {
    clear()
    for (const pin of pinList) {
      const sprite = createPinSprite(pin, pinAssets)
      if (!sprite) continue
      placeSprite(sprite, pin)
      const mat = sprite.material
      disposables.push({
        tex: mat.map ?? undefined,
        mat,
      })
      root.add(sprite)
    }
  }

  void loadCinematicPinAssets().then(() => {
    if (disposed || pinList.length === 0) return
    rebuild()
  })

  return {
    root,
    setPins(pins: readonly CinematicPin[]): void {
      if (pins === pinList) return
      pinList = pins
      rebuild()
    },
    setFrame(next: CinematicPinFrame): void {
      if (next === frame) return
      frame = next
      if (next === 'globe') istanbulUnlocked = false
      rebuild()
    },
    setVisible(visible: boolean): void {
      root.visible = visible === true
    },
    update(camera: THREE.Camera, focusId?: string | null): void {
      if (!root.visible) return
      const cx = camera.position.x
      const cy = camera.position.y
      const cz = camera.position.z
      const wantId = focusId ?? ''
      if (wantId === 'turkey' || wantId === 'istanbul') istanbulUnlocked = true
      if (
        wantId === 'earth-europe' ||
        wantId === 'europe' ||
        wantId === 'north-atlantic'
      ) {
        istanbulUnlocked = false
      }
      for (const child of root.children) {
        const pinId = String(child.userData.pinId ?? '')
        const isHero = child.userData.hero === true
        if (frame === 'globe') {
          const px = child.position.x
          const py = child.position.y
          const pz = child.position.z
          const facing = px * cx + py * cy + pz * cz > 0
          const istanbulOk = pinId !== 'istanbul' || istanbulUnlocked
          child.visible = facing && istanbulOk
        } else if (isHero) {
          child.visible = wantId !== '' && pinId === wantId
        } else {
          child.visible = true
        }
        if (!(child instanceof THREE.Sprite)) continue
        const pin = pinList.find((p) => p.id === pinId)
        if (pin) placeSprite(child, pin)
        if (!child.visible) {
          child.userData.focus01 = 0
          continue
        }
        const base = Number(child.userData.baseScaleY) || COUNTRY_LAYOUT.scaleY
        const aspect = Number(child.userData.aspect) || COUNTRY_LAYOUT.cropW / COUNTRY_LAYOUT.cropH
        const target = pinId === wantId ? 1 : 0
        const prev = Number(child.userData.focus01) || 0
        const next = prev + (target - prev) * FOCUS_LERP
        child.userData.focus01 = next
        const s = base * (1 + (FOCUS_SCALE - 1) * next)
        child.scale.set(s * aspect, scaleYSafe(s), 1)
      }
    },
    dispose(): void {
      disposed = true
      clear()
      pinList = []
      root.visible = false
    },
  }
}

function scaleYSafe(s: number): number {
  return Number.isFinite(s) && s > 0 ? s : COUNTRY_LAYOUT.scaleY
}
