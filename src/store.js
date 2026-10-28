'use strict'
const fs = require('node:fs')
const path = require('node:path')

function canonicalUUID(input) {
  if (typeof input !== 'string') throw new Error('Invalid UUID')
  const value = input.toLowerCase().replaceAll('-', '')
  if (!/^[0-9a-f]{32}$/.test(value)) throw new Error('Invalid UUID')
  return [value.slice(0, 8), value.slice(8, 12), value.slice(12, 16), value.slice(16, 20), value.slice(20)].join('-')
}
class VoteStore {
  constructor(file) {
    this.file = file
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
    if (fs.existsSync(file)) {
      this.data = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (!this.data || this.data.schema !== 1 || !this.data.votes || !this.data.signatures) throw new Error('Invalid data file, refusing to overwrite')
    } else {
      this.data = { schema: 1, votes: {}, signatures: {} }
      this.persist()
    }
  }
  persist() {
    const temporary = this.file + '.tmp-' + process.pid
    try {
      fs.writeFileSync(temporary, JSON.stringify(this.data, null, 2) + '\n', { mode: 0o600 })
      fs.renameSync(temporary, this.file)
    } finally {
      try { fs.unlinkSync(temporary) } catch (error) { if (error.code !== 'ENOENT') throw error }
    }
  }
  vote(ballotId, uuid, choice) {
    uuid = canonicalUUID(uuid)
    if (!['yes', 'no'].includes(choice)) throw new Error('Invalid choice')
    if (!this.data.votes[ballotId]) this.data.votes[ballotId] = {}
    if (this.data.votes[ballotId][uuid]) return { created: false, choice: this.data.votes[ballotId][uuid].choice }
    this.data.votes[ballotId][uuid] = { choice, at: new Date().toISOString() }
    this.persist()
    return { created: true, choice }
  }
  sign(uuid) {
    uuid = canonicalUUID(uuid)
    if (this.data.signatures[uuid]) return { created: false, signature: this.data.signatures[uuid] }
    const signature = { uuid, name: uuid, city: 'MINECRAFT', status: 'pending', at: new Date().toISOString() }
    this.data.signatures[uuid] = signature
    this.persist()
    return { created: true, signature }
  }
  synced(uuid) {
    uuid = canonicalUUID(uuid)
    const entry = this.data.signatures[uuid]
    if (!entry || entry.status === 'synced') return false
    entry.status = 'synced'
    entry.syncedAt = new Date().toISOString()
    this.persist()
    return true
  }
  pending() { return Object.values(this.data.signatures).filter(s => s.status === 'pending') }
  results(ballot) {
    const votes = Object.values(this.data.votes[ballot.id] || {})
    const signatures = Object.values(this.data.signatures)
    return {
      ballot: { id: ballot.id, title: ballot.title, question: ballot.question, choices: ballot.choices },
      votes: { yes: votes.filter(v => v.choice === 'yes').length, no: votes.filter(v => v.choice === 'no').length, total: votes.length },
      appeal: { total: signatures.length, synced: signatures.filter(s => s.status === 'synced').length, pending: signatures.filter(s => s.status === 'pending').length }
    }
  }
}
module.exports = { VoteStore, canonicalUUID }
