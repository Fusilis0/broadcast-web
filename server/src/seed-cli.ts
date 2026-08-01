import { loadServerConfig } from './config.ts'
import { openDatabase } from './db.ts'
import { seedFromRacesDir } from './seed.ts'

const config = loadServerConfig()
const db = openDatabase(config.dbPath)
const result = seedFromRacesDir(db, config.seedDir)
console.info('[projects-api] seed', result)
db.close()
if (result.errors.length > 0) process.exitCode = 1
