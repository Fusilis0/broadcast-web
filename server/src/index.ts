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
  apiToken: config.apiToken,
  corsOrigin: config.corsOrigin,
})

const server = createServer((req, res) => {
  void handler(req, res)
})

server.listen(config.port, config.host, () => {
  console.info(
    `[projects-api] listening on http://${config.host}:${config.port}`,
  )
  console.info(`[projects-api] db=${config.dbPath}`)
  if (config.apiToken) {
    console.info('[projects-api] write auth: bearer token required')
  } else {
    console.info('[projects-api] write auth: open (set PROJECTS_API_TOKEN to lock)')
  }
})
