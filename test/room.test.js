'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const room = require('../src/room-generator')
test('10x10 footprint and physical separation of lecterns', () => {
  assert.equal(room.geometry(3, 80, 3), 'polished_andesite')
  assert.equal(room.geometry(12, 80, 12), 'polished_andesite')
  assert.equal(room.geometry(2, 80, 8), null)
  assert.equal(room.geometry(7, 86, 7), 'stone_bricks')
  assert.equal(room.geometry(6, 81, 6), 'lectern')
  assert.equal(room.geometry(9, 81, 6), 'lectern')
  assert.equal(room.geometry(7, 81, 10), null)
  assert.equal(room.SPAWN.y, 81)
})
