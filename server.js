const cp = require('child_process')

const util = require('./util.js')

const log = util.getLogger('server')

const debug = true

function startServer() {
    let clientProcess
    if (debug) {
        clientProcess = cp.spawn('node', ['--inspect=9230', './client.js'], {
            stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
        })
    } else {
        clientProcess = cp.fork('./client.js')
    }

    clientProcess.on('message', ({ context, arg }) => {
        log('Receive:', arg)

        const handle = commands[context.commandId]
        log('handle', handle)

        handle && handle({
            context,
            arg,
            clientProcess,
        })
    })
    log('Listening...')
}
startServer()

class ObjectsRegistry {
    constructor() {
        this.id = 0
        this.storage = new Map()
    }
    add(obj) {
        this.storage.set(++this.id, obj)
        return this.id
    }

    get(id) {
        return this.storage.get(id)
    }
}
const objectsRegistry = new ObjectsRegistry()

// Convert a real value into meta data.
const valueToMeta = function (value) {
    // Determine the type of value.
    let type = typeof value
    if (type === 'object') {
        // Recognize certain types of objects.
        if (value instanceof Buffer) {
            type = 'buffer'
        } else if (Array.isArray(value)) {
            type = 'array'
        } else if (util.isSerializableObject(value)) {
            type = 'value'
        }
    }

    // Fill the meta object according to value's type.
    if (type === 'array') {
        const v = value.map((el) => valueToMeta(el))
        return {
            type,
            members: value.map((el) => valueToMeta(el))
        }
    } else if (type === 'object' || type === 'function') {
        return {
            type,
            name: value.constructor ? value.constructor.name : '',
            id: objectsRegistry.add(value),
            members: parseMembers(value),
        }
    } else if (type === 'buffer') {
        return { type, value }
    } else {
        return {
            type: 'value',
            value
        }
    }
}

const IGNORE_FUNCTION_MEMBERS = ['length', 'name', 'arguments', 'caller', 'prototype']

function parseMembers(value) {
    const members = Object.getOwnPropertyNames(value)
    return members.map(name => {
        if (IGNORE_FUNCTION_MEMBERS.includes(name)) return false

        const meta = valueToMeta(value[name])
        if (meta.type === 'function') {
            return {
                ...meta,
                name,
                type: 'method',
            }
        }
        return {
            ...meta,
            name,
        }
    }).filter(Boolean)
}

// This Object is fetch by client.js
const remoteObj = {
    normal: 'dddd',
    foo: function () {
        console.log('xxx')
        return 'abc'
    },
    ddd: {
        eee: function () {
            console.log('eeee')
            return 'return eee value'
        }
    },
    lucky: Buffer.from('lucky'),
    arr: ['eee', function arrFoo() {
        console.log('test')
        return 'arr[1] return'
    }]
}

const commands = {
    ELECTRON_BROWSER_GET_BUILTIN: function ({ context, clientProcess } = {}) {
        const id = objectsRegistry.add(remoteObj)
        const meta = valueToMeta(remoteObj)
        log('[ELECTRON_BROWSER_GET_BUILTIN] meta', meta)
        clientProcess.send({
            channel: 'ELECTRON_BROWSER_RECEIVE',
            _seqId: context._seqId,
            id: id,
            ...meta
        })
    },
    ELECTRON_BROWSER_FUNCTION_CALL: function ({ context, arg, clientProcess } = {}) {
        const obj = objectsRegistry.get(arg.id)
        let value = null
        if (typeof obj === 'function') {
            value = obj(arg)
        }
        const meta = valueToMeta(value)
        log('[ELECTRON_BROWSER_FUNCTION_CALL] meta', meta)
        clientProcess.send({
            channel: 'ELECTRON_BROWSER_RECEIVE',
            _seqId: context._seqId,
            ...meta
        })
    },
    ELECTRON_BROWSER_MEMBER_CALL: function ({ context, arg, clientProcess } = {}) {
        const obj = objectsRegistry.get(arg.id)
        if (!obj[arg.name] || typeof obj[arg.name] !== 'function') {
            log('No member or no such function:', arg.name)
            return clientProcess.send({
                channel: 'ELECTRON_BROWSER_RECEIVE',
                _seqId: context._seqId,
                ...valueToMeta(null)
            })
        }
        const value = obj[arg.name]()
        const meta = valueToMeta(value)
        log('[ELECTRON_BROWSER_MEMBER_CALL] meta:', meta)
        clientProcess.send({
            channel: 'ELECTRON_BROWSER_RECEIVE',
            _seqId: context._seqId,
            ...meta
        })
    },
}


