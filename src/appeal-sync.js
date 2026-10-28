'use strict'

// Remote synchronization is opt-in: mkal.pl needs its own trusted API endpoint.
// Local acceptance is never presented as publication on mkal.pl.
function createAppealSync(store, config, logger = console) {
  let busy = false
  async function flush() {
    if (!config.syncUrl || busy) return
    busy = true
    try {
      for (const signature of store.pending()) {
        try {
          const payload = {
            source: 'minecraft',
            signature_id: signature.uuid,
            uuid: signature.uuid,
            name: signature.uuid,
            city: 'MINECRAFT',
            consent_publication: true,
            consent_processing: true,
            signed_at: signature.at
          }
          const res = await fetch(config.syncUrl, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'idempotency-key': 'minecraft-appeal-' + signature.uuid,
              ...(config.syncToken ? { authorization: 'Bearer ' + config.syncToken } : {})
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(8000)
          })
          if (!res.ok) throw new Error('HTTP ' + res.status)
          store.synced(signature.uuid)
          logger.info('[appeal] synced ' + signature.uuid)
        } catch (error) {
          logger.error('[appeal] sync failed for ' + signature.uuid + ': ' + error.message)
        }
      }
    } finally { busy = false }
  }
  const timer = config.syncUrl ? setInterval(() => { flush().catch(e => logger.error(e)) }, 60000) : null
  timer?.unref()
  if (config.syncUrl) queueMicrotask(() => { flush().catch(e => logger.error(e)) })
  return { flush, close: () => { if (timer) clearInterval(timer) } }
}
module.exports = { createAppealSync }
