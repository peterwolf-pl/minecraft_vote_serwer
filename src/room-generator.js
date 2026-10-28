'use strict'
const { Vec3 } = require('vec3')

// A single fixed 16x16 chunk, without terrain generation or persistent world files.
// The enclosed room is exactly 10x10 blocks, from x/z=3 through 12.
const LECTERNS = Object.freeze({ vote: { x: 6, y: 81, z: 6 }, appeal: { x: 9, y: 81, z: 6 } })
const SPAWN = Object.freeze({ x: 7.5, y: 81, z: 10.5 })
function geometry(x, y, z) {
  if (x < 3 || x > 12 || z < 3 || z > 12) return null
  if (y === 80) return ((x + z) % 2 === 0) ? 'polished_andesite' : 'smooth_stone'
  if (y === 86) return 'stone_bricks'
  if (y >= 81 && y <= 85 && (x === 3 || x === 12 || z === 3 || z === 12)) {
    if ((x === 3 || x === 12) && z >= 7 && z <= 8 && y >= 82 && y <= 83) return 'glass'
    return y === 81 || y === 85 ? 'chiseled_stone_bricks' : 'stone_bricks'
  }
  if (y === 85 && ((x === 5 && z === 5) || (x === 10 && z === 5) || (x === 7 && z === 10))) return 'sea_lantern'
  if (y === 81 && z === 6 && (x === 6 || x === 9)) return 'lectern'
  if (y === 81 && z === 5 && (x === 6 || x === 9)) return 'quartz_block'
  return null
}
function generator({ registry }) {
  const Chunk = require('prismarine-chunk')(registry)
  const state = Object.fromEntries(
    ['polished_andesite','smooth_stone','stone_bricks','chiseled_stone_bricks','glass','sea_lantern','lectern','quartz_block']
      .map(name => {
        const block = registry.blocksByName[name]
        if (!block) throw new Error('Missing block in registry: ' + name)
        return [name, block.defaultState]
      })
  )
  return function getChunk(chunkX, chunkZ) {
    const chunk = new Chunk()
    if (chunkX !== 0 || chunkZ !== 0) return chunk
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
      for (let y = 80; y <= 86; y++) {
        const name = geometry(x, y, z)
        if (name) chunk.setBlockStateId(new Vec3(x, y, z), state[name])
      }
      for (let y = 79; y <= 90; y++) {
        chunk.setSkyLight(new Vec3(x, y, z), 15)
        if (x >= 3 && x <= 12 && z >= 3 && z <= 12) chunk.setBlockLight(new Vec3(x, y, z), 15)
      }
    }
    return chunk
  }
}
generator.geometry = geometry
generator.LECTERNS = LECTERNS
generator.SPAWN = SPAWN
module.exports = generator
