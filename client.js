const EventEmitter = require('events')
const event = new EventEmitter()
const util = require('./util')
const log = util.getLogger('client')

const MAX_WAIT_TIME = 10 * 60 * 1000 // 10 mins

process.on('message', info => {
  // Accept data from server side
  event.emit(info.channel, info)
})

async function getRemoteValue(commandId, arg = null) {
  const seqId = util.randomId()
  process.send({
    context: {
      commandId, // : 'ELECTRON_BROWSER_GET_BUILTIN',
      _seqId: seqId,
    },
    arg,
  })

  return new Promise((resolve, reject) => {
    const listener = info => {
      log('info:', info)
      if (info._seqId !== seqId) return

      event.removeListener('ELECTRON_BROWSER_RECEIVE', listener)
      resolve(info)
    }
    event.on('ELECTRON_BROWSER_RECEIVE', listener)
    setTimeout(() => {
      reject(new Error('Can not get return value, timeout.'))
    }, MAX_WAIT_TIME)
  })
}

// Convert meta data from server into real value.
async function metaToValue(meta) {
  const types = {
    value: () => meta.value,
    array: () => meta.members.map((member) => metaToValue(member)),
    buffer: () => Buffer.from(meta.value),
  }

  if (meta.type in types) {
    return types[meta.type]()
  } else {
    let ret

    // A shadow class to represent the remote function object.
    if (meta.type === 'function') {
      const remoteFunction = async function (...args) {
        const commandId = 'ELECTRON_BROWSER_FUNCTION_CALL'
        const obj = await getRemoteValue(commandId, { id: meta.id })
        return await metaToValue(obj)
      }
      ret = remoteFunction
    } else {
      ret = {}
    }

    for (const member of meta.members) {
      if (member.type === 'method') {
        Object.defineProperty(ret, member.name, {
          value: async function () {
            const commandId = 'ELECTRON_BROWSER_MEMBER_CALL'
            const obj = await getRemoteValue(commandId, { id: meta.id, name: member.name })
            return metaToValue(obj)
          }
        })
      } else {
        Object.defineProperty(ret, member.name, { value: await metaToValue(member) })
      }
    }

    return ret
  }
}


module.exports = {
  async getRemoteObj() {
    const commandId = 'ELECTRON_BROWSER_GET_BUILTIN'
    const meta = await getRemoteValue(commandId)
    return await metaToValue(meta)
  }
}