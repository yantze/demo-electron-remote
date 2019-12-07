# Revealing the principle of electron.remote module.

```javascript
// server.js
const cp = require('child_process')
const clientProcess = cp.fork('./client.js')
const remoteObj = {
    normal: 'dddd',
    num: 2,
}
clientProcess.on('message', (commandId) => {
    if (commandId === 'GET_OBJ') {
        clientProcess.send(remoteObj)
    }
})

// client.js
process.send('GET_OBJ')
process.on('message', obj => {
    console.log('Receive obj:', obj)
})
```

[More Info (in chinese)](https://vastiny.com/post/tech/electron-remote)