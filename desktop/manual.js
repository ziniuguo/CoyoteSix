const qr = require('qrcode');
const fs = require('fs');
const WebSocket = require('ws');
const {GlobalKeyboardListener} = require("node-global-key-listener");
const kListener = new GlobalKeyboardListener();


let connectionId = ""; // 从接口获取的连接标识符
let targetWSId = ""; // 发送目标
let wsConn = null; // 全局ws链接
let isAwarding = false;
let isPressing = 0;
// 0 : waiting for down
// 1: already down, waiting for up

const feedBackMsg = {
    "feedback-0": "A通道：○",
    "feedback-1": "A通道：△",
    "feedback-2": "A通道：□",
    "feedback-3": "A通道：☆",
    "feedback-4": "A通道：⬡",
    "feedback-5": "B通道：○",
    "feedback-6": "B通道：△",
    "feedback-7": "B通道：□",
    "feedback-8": "B通道：☆",
    "feedback-9": "B通道：⬡",
}

function connectWs() {
    wsConn = new WebSocket("ws://47.106.145.100:9999/");
    wsConn.onopen = function (event) {
        console.log("Desktop: WebSocket connection opened!");
    };

    wsConn.onmessage = function (event) {
        let message = null;
        try {
            message = JSON.parse(event.data);
        }
        catch (e) {
            console.log(event.data);
            return;
        }

        // 根据 message.type 进行不同的处理
        switch (message.type) {
            case 'bind':
                if (!message.targetId) {
                    //初次连接获取网页wsid
                    connectionId = message.clientId; // 获取 clientId
                    console.log("收到clientId（后端）：" + message.clientId);
                    const url = "https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#ws://47.106.145.100:9999/" + connectionId;
                    const filePath = './qrcode.png'; // You can specify the path where you want to save the QR code image
                    generateQRCode(url, filePath).then(r => {

                    });
                }
                else {
                    if (message.clientId !== connectionId) {
                        alert('收到不正确的target消息' + message.message)
                        return;
                    }
                    targetWSId = message.targetId;

                    console.log("收到targetId: " + message.targetId + "msg: " + message.message);
                    // hideqrcode();
                }
                break;
            case 'break':
                //对方断开
                if (message.targetId !== targetWSId)
                    return;
                console.log("对方已断开，code:" + message.message)
                // location.reload();
                break;
            case 'error':
                if (message.targetId !== targetWSId)
                    return;
                console.log(message); // 输出错误信息到控制台
                break;
            case 'msg':
                // 定义一个空数组来存储结果
                const result = [];
                if (message.message.includes("strength")) {
                    const numbers = message.message.match(/\d+/g).map(Number);
                    result.push({ type: "strength", numbers });
                    console.log("A通道当前强度：" +  numbers[0]);
                    console.log("B通道当前强度：" +  numbers[1]);
                    console.log("A通道软上限：" +  numbers[2]);
                    console.log("B通道软上限：" +  numbers[3]);
                    // if (followAStrength && numbers[2] !== numbers[0]) {
                    //     //开启跟随软上限  当收到和缓存不同的软上限值时触发自动设置
                    //     // softAStrength = numbers[2]; // 保存 避免重复发信
                    //     const data1 = { type: 4, message: `strength-1+2+${numbers[2]}` }
                    //     sendWsMsg(data1);
                    // }
                    // if (followBStrength && numbers[3] !== numbers[1]) {
                    //     // softBStrength = numbers[3]
                    //     const data2 = { type: 4, message: `strength-2+2+${numbers[3]}` }
                    //     sendWsMsg(data2);
                    // }
                }
                else if (message.message.includes("feedback")) {
                    console.log(feedBackMsg[message.message]);
                }
                break;
            case 'heartbeat':
                console.log("收到心跳");
                break;
            default:
                console.log("收到其他消息：" + JSON.stringify(message)); // 输出其他类型的消息到控制台
                break;
        }
    };

    wsConn.onerror = function (event) {
        console.error("Desktop: error");
        // 在这里处理连接错误的情况
    };

    wsConn.onclose = function (event) {
        console.log("Desktop: close");
    };
}

async function generateQRCode(url, filePath) {
    try {
        // Generate QR code
        const qrData = await qr.toDataURL(url);

        // Check if qrData is a string
        if (typeof qrData !== 'string') {
            console.error('QR code data is not a string');
        }

        // Remove the prefix
        const base64Data = qrData.replace(/^data:image\/png;base64,/, '');

        // Write QR code to file
        fs.writeFileSync(filePath, base64Data, 'base64');

        console.log('Desktop: QR Code generated successfully and saved at:', filePath);
    } catch (err) {
        console.error('Error generating QR Code:', err);
    }
}

connectWs();

function sendWsMsg(messageObj) {
    messageObj.clientId = connectionId;
    messageObj.targetId = targetWSId;
    if (!messageObj.hasOwnProperty('type'))
        messageObj.type = "msg";
    wsConn.send(JSON.stringify((messageObj)));
}

function setLevel(channelIndex, strength) {
    const data = { type: 3, strength: strength, message: "set channel", channel: channelIndex };
    console.log(data)
    sendWsMsg(data);
}

kListener.addListener(function (e, down) {
    if (e.state === "DOWN" && e.rawKey._nameRaw === "VK_CAPITAL") {
        console.log(`${e.name} ${e.state === "DOWN" ? "DOWN" : "UP  "} [${e.rawKey._nameRaw}]`);
        isPressing = 1;
    }
    if (e.state === "UP" && e.rawKey._nameRaw === "VK_CAPITAL") {
        console.log(`${e.name} ${e.state === "DOWN" ? "DOWN" : "UP  "} [${e.rawKey._nameRaw}]`);
        if (!isAwarding) {
            // trigger
            setLevel(1, 30);
            // set flag
            isAwarding = true
            // reset pressing status
            isPressing = 0;
        } else {
            // de-trigger
            setLevel(1, 10);
            // set flag
            isAwarding = false
            // reset pressing status
            isPressing = 0;
        }
    }
}).then(r => {});

