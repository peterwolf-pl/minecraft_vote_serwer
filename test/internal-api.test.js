'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { VoteStore } = require('../src/store')
const { createHttpServer } = require('../src/http')
const TOKEN = 'a'.repeat(64)
const UUID = '01234567-89ab-cdef-0123-456789abcdef'

test('authenticated bridge accepts votes once, rejects forged and repeat submissions', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mka-vote-api-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const ballot = { id: 'election', title: 'Election', question: 'Yes?', choices: { yes: 'Yes', no: 'No' } }
  const store = new VoteStore(path.join(dir, 'data.json'))
  let signed = 0
  const app = createHttpServer(store, ballot, { port: 0, bridgeToken: TOKEN, onSigned: () => { signed++ } })
  const addr = await app.start()
  t.after(() => app.close())
  const root = 'http://127.0.0.1:' + addr.port
  const send = (endpoint, data, token = TOKEN) => fetch(root + endpoint, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    body: JSON.stringify(data)
  })
  const unauth = await send('/internal/vote', { uuid: UUID, choice: 'no' }, 'invalid')
  assert.equal(unauth.status, 401)
  const first = await send('/internal/vote', { uuid: UUID, choice: 'yes' })
  assert.deepEqual(await first.json(), { ok: true, created: true, choice: 'yes' })
  const duplicate = await send('/internal/vote', { uuid: UUID, choice: 'no' })
  assert.deepEqual(await duplicate.json(), { ok: true, created: false, choice: 'yes' })
  assert.equal((await send('/internal/vote', { uuid: 'wrong', choice: 'no' })).status, 400)
  assert.equal((await send('/internal/appeal', { uuid: UUID, consent: false })).status, 400)
  const sign = await send('/internal/appeal', { uuid: UUID, consent: true })
  assert.equal((await sign.json()).created, true)
  assert.equal((await send('/internal/appeal', { uuid: UUID, consent: true }).then(r => r.json())).created, false)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(signed, 1)
  assert.equal((await fetch(root + '/api/results').then(r => r.json())).votes.total, 1)
})
