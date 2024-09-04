const qr = require('qrcode');
const fs = require('fs');
const WebSocket = require('ws');
const {GlobalKeyboardListener} = require("node-global-key-listener");
const kListener = new GlobalKeyboardListener();


let connectionId = ""; // 从接口获取的连接标识符
let targetWSId = ""; // 发送目标
let wsConn = null; // 全局ws链接
let nextStatus = false; //
let waveInterval = null;
let lb = 30;
let hb = 50;


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
    //wsConn = new WebSocket("ws://localhost:9999/");
    wsConn.onopen = function (event) {
        console.log("WebSocket连接已建立");
    };

    wsConn.onmessage = function (event) {
        var message = null;
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
                }
                break;
            case 'break':
                //对方断开
                if (message.targetId !== targetWSId)
                    return;
                console.log("对方已断开，code:" + message.message)
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

                }
                else if (message.message.includes("feedback")) {
                    console.log(feedBackMsg[message.message]);
                }
                break;
            case 'heartbeat':
                //心跳包
                console.log("收到心跳");
                if (targetWSId !== '') {
                    // 已连接上
                    const light = document.getElementById("status-light");
                    light.style.color = '#00ff37';

                    // 1秒后将颜色设置回 #ffe99d
                    setTimeout(() => {
                        light.style.color = '#ffe99d';
                    }, 1000);
                }
                break;
            default:
                console.log("收到其他消息：" + JSON.stringify(message)); // 输出其他类型的消息到控制台
                break;
        }
    };

    wsConn.onerror = function (event) {
        console.error("WebSocket连接发生错误");
        // 在这里处理连接错误的情况
    };

    wsConn.onclose = function (event) {
        showToast("连接已断开");
    };
}

async function generateQRCode(url, filePath) {
    try {
        // Generate QR code
        const qrData = qr.toDataURL(url);

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
    console.log(messageObj)
    wsConn.send(JSON.stringify((messageObj)));
}

function setLevel(channelIndex, strength) {
    const data = { type: 3, strength: strength, message: "set channel", channel: channelIndex };
    sendWsMsg(data);
}

function setLevelFromFile() {
    try {
        //强度操作：
        const data = fs.readFileSync('strength', 'utf8');
        const [name, value1, value2] = data.trim().split('|');
        const data2send = { type: 3, strength: nextStatus ? value2 : value1, message: "set channel", channel: name === "A" ? 1 : 2 };
        sendWsMsg(data2send);
    } catch (err) {
        console.error('Error reading the file:', err);
    }
}

function resetWave() {
    // read new wave
    const dataA = fs.readFileSync('waveA', 'utf8');
    const dataB = fs.readFileSync('waveB', 'utf8');
    const dataTime = fs.readFileSync('waveDurationInterval', 'utf8');

    const [durationA, durationB, interval] = dataTime.trim().split('|');
    const durationANumber = parseInt(durationA);
    const durationBNumber = parseInt(durationB);

// Convert interval to number and convert seconds to milliseconds
    const intervalNumber = parseInt(interval) * 1000;

    // clear legacy waveA. actually not necessary as long as you dont send a lot
    clearInterval(waveInterval)
    clearAB(1);
    clearAB(2);

    //波形数据:
    function sendWave () {
        const w1 = { type: "clientMsg",
            message: "A:"+dataA, time: durationANumber, channel: "A"
        }
        const w2 = { type: "clientMsg",
            message: "B:"+dataB, time: durationBNumber, channel: "B"
        }
        sendWsMsg(w1)
        sendWsMsg(w2)
    }
    sendWave()
    waveInterval = setInterval(sendWave, intervalNumber);
}

function clearAB(channelIndex) {
    const data = { type: 4, message: "clear-" + channelIndex }
    sendWsMsg(data);
}

kListener.addListener(function (e, down) {
    if (e.state === "UP" && e.name === "CAPS LOCK") {
        // change strength
        console.log(`${e.name} ${e.state === "DOWN" ? "DOWN" : "UP  "} [${e.rawKey._nameRaw}]`);
        setLevelFromFile();
        nextStatus = !nextStatus;
    }
    if (e.state === "UP" && e.name === "F4") {
        // re-read waveA
        console.log(`${e.name} ${e.state === "DOWN" ? "DOWN" : "UP  "} [${e.rawKey._nameRaw}]`);
        resetWave();
    }
}).then(r => {});

