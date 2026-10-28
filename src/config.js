'use strict'
const fs = require('node:fs')
const path = require('node:path')
function port(value, fallback) {
  const n = Number(value ?? fallback)
  if (!Number.isInteger(n) || n < 0 || n > 65535) throw new Error('Invalid port: ' + value)
  return n
}
function loadConfig(env = process.env) {
  const ballot = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../config/ballot.json'), 'utf8'))
  if (!/^[a-z0-9][a-z0-9_-]{2,79}$/i.test(ballot.id)) throw new Error('Invalid ballot.id')
  for (const key of ['title', 'question', 'appealTitle', 'appealText']) {
    if (typeof ballot[key] !== 'string' || !ballot[key].trim() || ballot[key].length > 500) throw new Error('Invalid ballot.' + key)
  }
  if (!ballot.choices || !ballot.choices.yes || !ballot.choices.no) throw new Error('Invalid ballot choices')
  const syncUrl = env.APPEAL_SYNC_URL?.trim() || ''
  if (syncUrl && new URL(syncUrl).protocol !== 'https:') throw new Error('APPEAL_SYNC_URL must use HTTPS')
  return {
    ballot,
    bridgeToken: env.MC_BRIDGE_TOKEN || '',
    mcHost: env.MC_HOST || '0.0.0.0',
    mcPort: port(env.MC_PORT, 25565),
    httpHost: env.HTTP_HOST || '127.0.0.1',
    httpPort: port(env.HTTP_PORT, 3000),
    dataFile: path.resolve(env.DATA_FILE || './data/votes.json'),
    syncUrl,
    syncToken: env.APPEAL_SYNC_TOKEN || ''
  }
}
module.exports = { loadConfig }
