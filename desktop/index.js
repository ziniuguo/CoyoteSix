const qr = require('qrcode');
const fs = require('fs');
const WebSocket = require('ws');
const {GlobalKeyboardListener} = require("node-global-key-listener");
const kListener = new GlobalKeyboardListener();


let connectionId = ""; // 从接口获取的连接标识符
let targetWSId = ""; // 发送目标
let wsConn = null; // 全局ws链接
let nextStatus = false; //
let lb = 30;
let hb = 50;

const waveData = {
    "1": `["0A0A0A0A00000000","0A0A0A0A0A0A0A0A","0A0A0A0A14141414","0A0A0A0A1E1E1E1E","0A0A0A0A28282828","0A0A0A0A32323232","0A0A0A0A3C3C3C3C","0A0A0A0A46464646","0A0A0A0A50505050","0A0A0A0A5A5A5A5A","0A0A0A0A64646464"]`,
    "2": `["0A0A0A0A00000000","0D0D0D0D0F0F0F0F","101010101E1E1E1E","1313131332323232","1616161641414141","1A1A1A1A50505050","1D1D1D1D64646464","202020205A5A5A5A","2323232350505050","262626264B4B4B4B","2A2A2A2A41414141"]`,
    "3": `["4A4A4A4A64646464","4545454564646464","4040404064646464","3B3B3B3B64646464","3636363664646464","3232323264646464","2D2D2D2D64646464","2828282864646464","2323232364646464","1E1E1E1E64646464","1A1A1A1A64646464"]`
}

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
    console.log(messageObj)
    wsConn.send(JSON.stringify((messageObj)));
}

function setLevel(channelIndex, strength) {
    const data = { type: 3, strength: strength, message: "set channel", channel: channelIndex };
    sendWsMsg(data);
}

function setLevelFromFile() {
    try {
        //波形数据:
        // setInterval(() => {
            const w = { type: "clientMsg", message: `A:${waveData[1]}`, message2: `B:${waveData[1]}`, time1: 3, time2: 3 }
            sendWsMsg(w)
        // }, 5000);

        //强度操作：
        const data = fs.readFileSync('strength', 'utf8');
        const [name, value1, value2] = data.trim().split(',');
        const data2send = { type: 3, strength: nextStatus ? value2 : value1, message: "set channel", channel: name === "A" ? 1 : 2 };
        sendWsMsg(data2send);
    } catch (err) {
        console.error('Error reading the file:', err);
    }
}

kListener.addListener(function (e, down) {
    if (e.state === "UP" && e.rawKey._nameRaw === "VK_CAPITAL") {
        console.log(`${e.name} ${e.state === "DOWN" ? "DOWN" : "UP  "} [${e.rawKey._nameRaw}]`);
        setLevelFromFile();
        nextStatus = !nextStatus;
    }
}).then(r => {});

