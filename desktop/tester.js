const {GlobalKeyboardListener} = require("node-global-key-listener");
const kListener = new GlobalKeyboardListener();

kListener.addListener(function (e, down) {
    console.log(
        `${e.name} ${e.state === "DOWN" ? "DOWN" : "UP  "} [${e.rawKey._nameRaw}]`
    );
}).then(r => {});

