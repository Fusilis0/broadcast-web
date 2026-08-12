import { createServer } from 'node:http'
import { createApp } from './app.ts'
import { loadServerConfig } from './config.ts'
import { openDatabase } from './db.ts'
import { seedFromRacesDir } from './seed.ts'

const config = loadServerConfig()
const db = openDatabase(config.dbPath)

if (config.seedOnBoot) {
  const seed = seedFromRacesDir(db, config.seedDir)
  console.info('[projects-api] seed', seed)
}

const handler = createApp({
  db,
  editorToken: config.editorToken,
  airToken: config.airToken,
  corsOrigin: config.corsOrigin,
  assetsLibraryDir: config.assetsLibraryDir,
  maxAssetBytes: config.maxAssetBytes,
})

const server = createServer((req, res) => {
  void handler(req, res)
})

server.listen(config.port, config.host, () => {
  console.info(
    `[projects-api] listening on http://${config.host}:${config.port}`,
  )
  console.info(`[projects-api] db=${config.dbPath}`)
  console.info(
    `[projects-api] assets library=${config.assetsLibraryDir} (max ${config.maxAssetBytes} bytes)`,
  )
  if (config.editorToken) {
    console.info(
      '[projects-api] write auth: editor bearer required (PROJECTS_API_EDITOR_TOKEN or PROJECTS_API_TOKEN)',
    )
  } else if (config.airToken) {
    console.info(
      '[projects-api] write auth: air token set but no editor token — writes return 401/403',
    )
  } else {
    console.info(
      '[projects-api] write auth: open (set PROJECTS_API_EDITOR_TOKEN to lock)',
    )
  }
})
