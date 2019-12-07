function isPromise(val) {
    return (
        val &&
        val.then &&
        val.then instanceof Function &&
        val.constructor &&
        val.constructor.reject &&
        val.constructor.reject instanceof Function &&
        val.constructor.resolve &&
        val.constructor.resolve instanceof Function
    )
}

const serializableTypes = [
    Boolean,
    Number,
    String,
    Date,
    RegExp,
    ArrayBuffer
]

function isSerializableObject(value) {
    return value === null || ArrayBuffer.isView(value) || serializableTypes.some(type => value instanceof type)
}

function getLogger(info) {
    return function (...args) {
        console.log(`\x1b[36m[${info}]\x1b[0m`, ...args)
    }
}

function randomId() {
    return Math.random().toString(16).substr(2)
}

module.exports = {
    isSerializableObject,
    isPromise,
    getLogger,
    randomId,
}
