export const SCENE_CONFIG_FORMAT = 'nocturne-scene-config'
export const SCENE_CONFIG_VERSION = 1
export const ACTIVE_SCENE_KEY = 'nocturne.scene-config'
export const SAVED_SCENE_KEY = 'nocturne.scene-config.saved'
export const DEFAULT_SCENE_KEY = 'nocturne.scene-config.default'

export type JsonObject = Record<string, unknown>

export type ParticleSceneConfig = {
  composition: JsonObject
  physics: JsonObject
  appearance: JsonObject
}

export type SceneConfig = {
  format: typeof SCENE_CONFIG_FORMAT
  version: number
  updatedAt: string
  bottle: JsonObject
  spheres: JsonObject
  ripples: JsonObject
  particles: ParticleSceneConfig
}

const isObject = (value: unknown): value is JsonObject => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const migrations: Record<number, (config: JsonObject) => JsonObject> = {
  1: (config) => ({ ...config, format: SCENE_CONFIG_FORMAT, version: 1 }),
}

function migrateVersion(raw: unknown) {
  if (!isObject(raw)) return {}
  let config = structuredClone(raw)
  let version = typeof config.version === 'number' && Number.isFinite(config.version) ? config.version : 0
  while (version < SCENE_CONFIG_VERSION) {
    const nextVersion = version + 1
    const migration = migrations[nextVersion]
    if (!migration) break
    config = migration(config)
    version = nextVersion
  }
  return config
}

function compatibleValue(defaultValue: unknown, savedValue: unknown): unknown {
  if (Array.isArray(defaultValue)) {
    if (!Array.isArray(savedValue)) return structuredClone(defaultValue)
    return defaultValue.map((item, index) => compatibleValue(item, savedValue[index]))
  }
  if (isObject(defaultValue)) {
    if (!isObject(savedValue)) return structuredClone(defaultValue)
    const keys = Object.keys(defaultValue)
    if (keys.length === 0) return structuredClone(savedValue)
    return Object.fromEntries(keys.map((key) => [key, compatibleValue(defaultValue[key], savedValue[key])]))
  }
  if (savedValue === undefined || savedValue === null) return defaultValue
  if (typeof defaultValue === 'number') return typeof savedValue === 'number' && Number.isFinite(savedValue) ? savedValue : defaultValue
  if (typeof defaultValue === 'string') return typeof savedValue === 'string' ? savedValue : defaultValue
  if (typeof defaultValue === 'boolean') return typeof savedValue === 'boolean' ? savedValue : defaultValue
  return defaultValue
}

export function migrateSceneConfig(raw: unknown, defaults: SceneConfig): SceneConfig {
  const source = migrateVersion(raw)
  const sourceParticles = isObject(source.particles) ? source.particles : {}
  const defaultsParticles = defaults.particles
  return {
    format: SCENE_CONFIG_FORMAT,
    version: SCENE_CONFIG_VERSION,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : defaults.updatedAt,
    bottle: compatibleValue(defaults.bottle, source.bottle) as JsonObject,
    spheres: compatibleValue(defaults.spheres, source.spheres) as JsonObject,
    ripples: compatibleValue(defaults.ripples, source.ripples) as JsonObject,
    particles: {
      composition: compatibleValue(defaultsParticles.composition, sourceParticles.composition) as JsonObject,
      physics: compatibleValue(defaultsParticles.physics, sourceParticles.physics) as JsonObject,
      appearance: compatibleValue(defaultsParticles.appearance, sourceParticles.appearance) as JsonObject,
    },
  }
}

export function parseSceneConfig(value: string | null): unknown {
  if (!value) return null
  try { return JSON.parse(value) as unknown } catch { return null }
}

export function stampSceneConfig(config: SceneConfig): SceneConfig {
  return { ...structuredClone(config), format: SCENE_CONFIG_FORMAT, version: SCENE_CONFIG_VERSION, updatedAt: new Date().toISOString() }
}

export function storeSceneConfig(key: string, config: SceneConfig) {
  localStorage.setItem(key, JSON.stringify(stampSceneConfig(config)))
}
