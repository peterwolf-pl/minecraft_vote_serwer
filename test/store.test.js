'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const os = require('node:os')
const path = require('node:path')
const fs = require('node:fs')
const { VoteStore, canonicalUUID } = require('../src/store')
const ballot = { id: 'test-ballot', title: 'Title', question: 'Question', choices: { yes: 'Yes', no: 'No' } }
const A = '01234567-89ab-cdef-0123-456789abcdef'
const B = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-vote-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  return path.join(dir, 'store.json')
}
test('canonical UUID normalizes and rejects impersonation input', () => {
  assert.equal(canonicalUUID('0123456789ABCDEF0123456789ABCDEF'), A)
  assert.throws(() => canonicalUUID('not-an-uuid'), /Invalid UUID/)
})
test('only one vote per authenticated UUID per ballot persists after restart', t => {
  const file = fixture(t)
  const store = new VoteStore(file)
  assert.deepEqual(store.vote(ballot.id, A, 'yes'), { created: true, choice: 'yes' })
  assert.deepEqual(store.vote(ballot.id, A, 'no'), { created: false, choice: 'yes' })
  assert.equal(store.vote(ballot.id, B, 'no').created, true)
  assert.throws(() => store.vote(ballot.id, B, 'maybe'), /Invalid choice/)
  const reopened = new VoteStore(file)
  assert.deepEqual(reopened.results(ballot).votes, { yes: 1, no: 1, total: 2 })
  assert.equal(reopened.vote(ballot.id, A, 'no').created, false)
})
test('signature is unique, stored locally and synced only on confirmation', t => {
  const file = fixture(t)
  const store = new VoteStore(file)
  assert.equal(store.sign(A).created, true)
  assert.equal(store.sign(A).created, false)
  assert.equal(store.results(ballot).appeal.pending, 1)
  assert.equal(store.synced(A), true)
  assert.equal(store.synced(A), false)
  assert.deepEqual(new VoteStore(file).results(ballot).appeal, { total: 1, synced: 1, pending: 0 })
})
test('corrupt stored data cannot be silently replaced', t => {
  const file = fixture(t)
  fs.writeFileSync(file, 'malformed')
  assert.throws(() => new VoteStore(file), SyntaxError)
})
