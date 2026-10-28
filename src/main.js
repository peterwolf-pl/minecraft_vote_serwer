'use strict'
const { loadConfig } = require('./config')
const { VoteStore } = require('./store')
const { createHttpServer } = require('./http')
const { createAppealSync } = require('./appeal-sync')
const { startMinecraft } = require('./minecraft')

async function main() {
  const config = loadConfig()
  const store = new VoteStore(config.dataFile)
  const http = createHttpServer(store, config.ballot, { host: config.httpHost, port: config.httpPort })
  const address = await http.start()
  console.log('[http] ' + config.httpHost + ':' + address.port)
  const sync = createAppealSync(store, config)
  const mc = startMinecraft(store, config, sync)
  let closing = false
  async function shutdown() {
    if (closing) return
    closing = true
    sync.close()
    await Promise.allSettled([http.close(), mc.destroy()])
    process.exitCode = 0
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1 })
module.exports = { main }
