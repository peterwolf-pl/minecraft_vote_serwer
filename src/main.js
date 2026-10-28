'use strict'
const { loadConfig } = require('./config')
const { VoteStore } = require('./store')
const { createHttpServer } = require('./http')
const { createAppealSync } = require('./appeal-sync')

async function main () {
  const config = loadConfig()
  if (!config.bridgeToken || config.bridgeToken.length < 32) {
    throw new Error('Set MC_BRIDGE_TOKEN to a random secret of at least 32 characters (openssl rand -hex 32)')
  }
  const store = new VoteStore(config.dataFile)
  const sync = createAppealSync(store, config)
  const http = createHttpServer(store, config.ballot, {
    host: config.httpHost,
    port: config.httpPort,
    bridgeToken: config.bridgeToken,
    onSigned: sync.flush
  })
  try {
    const address = await http.start()
    console.log('[http] Node.js API on ' + config.httpHost + ':' + address.port)
    console.log('[minecraft] Paper 26.3 runs in a separate process/container, not inside Node.js')
  } catch (error) { sync.close(); throw error }
  let closing = false
  async function shutdown () {
    if (closing) return
    closing = true
    sync.close()
    await http.close()
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1 })
module.exports = { main }
