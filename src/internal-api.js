'use strict'
const { timingSafeEqual } = require('node:crypto')
const { canonicalUUID } = require('./store')
const MAX_BODY = 4096
function authenticated(header, token) {
  if (!token || token.length < 32 || typeof header !== 'string' || !header.startsWith('Bearer ')) return false
  const supplied = Buffer.from(header.substring(7))
  const secret = Buffer.from(token)
  return supplied.length === secret.length && timingSafeEqual(supplied, secret)
}
function send(res, code, data) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
  res.end(JSON.stringify(data))
}
async function readJSON(req) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) { const error = new Error('Request body too large'); error.status = 413; throw error }
    chunks.push(chunk)
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error()
    return parsed
  } catch { const error = new Error('Malformed JSON'); error.status = 400; throw error }
}
async function handleInternal(req, res, path, { token, store, ballot, onSigned }) {
  if (!authenticated(req.headers.authorization, token)) return send(res, 401, { error: 'Unauthorized' })
  if (req.method !== 'POST' || !['/internal/vote', '/internal/appeal'].includes(path)) return send(res, 404, { error: 'Not found' })
  if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) return send(res, 415, { error: 'Expected application/json' })
  try {
    const body = await readJSON(req)
    const uuid = canonicalUUID(body.uuid)
    if (path === '/internal/vote') {
      if (body.choice !== 'yes' && body.choice !== 'no') return send(res, 400, { error: 'Invalid choice' })
      const saved = store.vote(ballot.id, uuid, body.choice)
      return send(res, 200, { ok: true, created: saved.created, choice: saved.choice })
    }
    if (body.consent !== true) return send(res, 400, { error: 'Explicit consent required' })
    const saved = store.sign(uuid)
    if (saved.created && onSigned) queueMicrotask(() => Promise.resolve().then(onSigned).catch(console.error))
    return send(res, 200, { ok: true, created: saved.created, status: saved.signature.status })
  } catch (error) {
    if (error.message === 'Invalid UUID') return send(res, 400, { error: 'Invalid UUID' })
    if (error.status) return send(res, error.status, { error: error.message })
    console.error('[internal-api] ' + error.message)
    return send(res, 500, { error: 'Internal error' })
  }
}
module.exports = { handleInternal, authenticated }
