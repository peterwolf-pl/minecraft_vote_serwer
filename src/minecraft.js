'use strict'
const path = require('node:path')
const { Vec3 } = require('vec3')
const room = require('./room-generator')

function sameBlock(a, b) { return Boolean(a && a.x === b.x && a.y === b.y && a.z === b.z) }
function attachVoting(server, store, config, appealSync, logger = console) {
  const { ballot } = config
  const say = (player, message) => player.chat(message.replace(/&[0-9a-fk-or]/gi, ''))
  const helpVote = (player) => {
    say(player, '&6' + ballot.title)
    say(player, '&f' + ballot.question)
    say(player, '&a/vote yes &7- ' + ballot.choices.yes + '   &c/vote no &7- ' + ballot.choices.no)
    say(player, '&7Jeden glos na konto Minecraft. Nie mozna zmienic glosu.')
  }
  const helpAppeal = (player) => {
    say(player, '&6' + ballot.appealTitle)
    say(player, '&f' + ballot.appealText)
    say(player, '&7Aby swiadomie zgodzic sie na publikacje UUID i przetwarzanie podpisu, wpisz:')
    say(player, '&a/appeal sign')
    if (!config.syncUrl) say(player, '&ePodpis zostanie zapisany lokalnie. Publikacja na stronie wymaga integracji API.')
  }
  server.onBlockInteraction('lectern', ({ block, player }) => {
    if (sameBlock(block.position, room.LECTERNS.vote)) { helpVote(player); return true }
    if (sameBlock(block.position, room.LECTERNS.appeal)) { helpAppeal(player); return true }
    return true
  })
  server.commands.add({
    base: 'vote', info: 'Oddaj glos TAK lub NIE', usage: '/vote yes|no', onlyPlayer: true,
    parse: str => /^(yes|no)$/i.test(str.trim()) ? str.trim().toLowerCase() : false,
    action: (choice, { player }) => {
      const result = store.vote(ballot.id, player.uuid, choice)
      if (!result.created) { say(player, 'Juz glosowales. Zapisany glos: ' + ballot.choices[result.choice]); return }
      logger.info('[vote] ' + player.uuid + ' -> ' + choice)
      say(player, 'Twoj glos ' + ballot.choices[choice] + ' zostal zapisany.')
    }
  })
  server.commands.add({
    base: 'appeal', info: 'Podpisz apel UUID gracza', usage: '/appeal sign', onlyPlayer: true,
    parse: str => str.trim().toLowerCase() === 'sign' ? 'sign' : false,
    action: (_arg, { player }) => {
      const result = store.sign(player.uuid)
      if (!result.created) { say(player, 'Podpis jest juz zapisany (status: ' + result.signature.status + ').'); return }
      logger.info('[appeal] local signature ' + player.uuid)
      appealSync.flush().catch(error => logger.error(error))
      say(player, config.syncUrl
        ? 'Podpis zapisany. Trwa proba wyslania do WWW. Status potwierdzisz u administratora.'
        : 'Podpis zapisany lokalnie. Publikacja na mkal.pl wymaga konfiguracji API.')
    }
  })
  server.commands.add({
    base: 'results', info: 'Wyniki glosowania', usage: '/results', onlyPlayer: true,
    action: (_arg, { player }) => {
      const r = store.results(ballot)
      say(player, '&6Wyniki: &aTAK ' + r.votes.yes + ' &cNIE ' + r.votes.no + ' &7RAZEM ' + r.votes.total)
      say(player, '&7Podpisy: ' + r.appeal.total + ', na WWW: ' + r.appeal.synced)
    }
  })
  server.on('newPlayer', player => {
    player.on('spawned', () => {
      say(player, '&6Witaj w sali glosowania MKA!')
      say(player, '&fKliknij pulpit po lewej, aby zaglosowac, lub prawy, aby podpisac apel.')
      say(player, '&7Mozesz tez wpisac /vote yes, /vote no, /appeal sign, /results.')
    })
  })
}
function startMinecraft(store, config, appealSync, logger = console) {
  const flyingSquid = require('flying-squid')
  const server = flyingSquid.createMCServer({
    version: '1.21.4',
    host: config.mcHost,
    port: config.mcPort,
    motd: 'MKA | Voting room | 1.21.4',
    'max-players': 20,
    'online-mode': true,
    'enforce-secure-profile': false,
    logging: true,
    gameMode: 2,
    difficulty: 0,
    worldFolder: undefined,
    generation: { name: path.join(__dirname, 'room-generator.js'), options: {} },
    'view-distance': 2,
    'max-entities': 25,
    'everybody-op': false,
    kickTimeout: 30000,
    plugins: {},
    modpe: false
  })
  server.getSpawnPoint = async () => new Vec3(room.SPAWN.x, room.SPAWN.y, room.SPAWN.z)
  server.on('ready', () => {
    attachVoting(server, store, config, appealSync, logger)
    logger.info('[minecraft] Listening on ' + config.mcHost + ':' + server.listeningPort + ' (Java 1.21.4, online-mode)')
  })
  server.on('error', error => logger.error('[minecraft] ' + error.stack))
  server.on('clientError', (_client, error) => logger.error('[minecraft/client] ' + error.message))
  return server
}
module.exports = { startMinecraft, attachVoting, sameBlock }
