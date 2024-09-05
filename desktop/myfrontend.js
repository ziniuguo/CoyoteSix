const qr = require('qrcode');
const fs = require('fs');
const WebSocket = require('ws');
const OBSWebSocket = require('obs-websocket-js').OBSWebSocket;
const Jimp = require('jimp').Jimp;
const obs = new OBSWebSocket();

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
                    let state = 0;
                    let currStrength = 5;
                    // 连接到 OBS WebSocket
                    obs.connect('ws://localhost:4455', 'nekopass') // TODO
                        .then(() => {
                            console.log('成功连接到 OBS WebSocket');
                            setWave() // wave initialization
                            const data = { type: 3, strength: 5, message: "set channel", channel: 1};
                            sendWsMsg(data); // strength initialization
                            // 每隔 5 秒截取一次屏幕并读取特定像素颜色
                            setInterval(async () => {
                                try {
                                    // 调用 GetSourceScreenshot 获取截图
                                    const response = await obs.call('GetSourceScreenshot', {
                                        sourceName: 'Game Capture', // 替换为你捕获游戏的源
                                        imageFormat: 'png',
                                        width: 1920, // 自定义宽度
                                        height: 1080 // 自定义高度
                                    });

                                    // 获取截图 Base64 数据，并移除前缀 "data:image/png;base64,"
                                    const imgBase64 = response.imageData.replace(/^data:image\/png;base64,/, '');
                                    const imgBuffer = Buffer.from(imgBase64, 'base64');

                                    // 保存为 PNG 文件
                                    const screenshotPath = 'screenshot.png';
                                    fs.writeFileSync(screenshotPath, imgBuffer);
                                    // console.log('截图已保存为 screenshot.png');

                                    // 使用 Jimp 读取截图文件并获取特定像素颜色
                                    Jimp.read(screenshotPath)
                                        .then(image => {
                                            // 获取特定位置的颜色 (例如 765, 110)
                                            const x = 790;
                                            const y = 110;
                                            const x2 = 1870;
                                            const y2 = 915;
                                            // const x3 = 960;
                                            // const y3 = 540;
                                            const color = image.getPixelColor(x, y); // 返回的是颜色的 ARGB 值
                                            const color2 = image.getPixelColor(x2, y2);
                                            // const color3 = image.getPixelColor(x2, y2);

                                            // 转换为 HEX 格式
                                            const hexColor = ((color >> 8) & 0xFFFFFF).toString(16).padStart(6, '0');
                                            const hexColor2 = ((color2 >> 8) & 0xFFFFFF).toString(16).padStart(6, '0');

                                            if (hexColor2 === 'adaeb9') {
                                                console.log(`颜色 (HEX2): #${hexColor} 游戏结束，惩罚重置`);
                                                const data = { type: 3, strength: 5, message: "set channel", channel: 1 };
                                                sendWsMsg(data);
                                                currStrength = 0;
                                            }

                                            if (state === 0) {
                                                if (hexColor === '3ca0ee') {
                                                    state = 1;
                                                }
                                            } else if (state === 1) {
                                                if (hexColor !== '3ca0ee') {
                                                    state = 2;
                                                }
                                            } else if (state === 2) {
                                                if (hexColor === '3ca0ee') {
                                                    state = 1;
                                                }
                                                if (hexColor === '395268') {
                                                    state = 3;
                                                    console.log(`颜色 (HEX): #${hexColor} 增加惩罚`);
                                                    const data = { type: 3, strength: Math.min(currStrength + 5, 200), message: "set channel", channel: 1 };
                                                    currStrength = Math.min(currStrength + 5, 200);
                                                    sendWsMsg(data);
                                                }
                                            } else if (state === 3) {
                                                if (hexColor !== '395286') {
                                                    state = 0;
                                                }
                                            }

                                        })
                                        .catch(err => {
                                            console.error('读取图像文件失败:', err);
                                        });

                                } catch (error) {
                                    console.error('截图或颜色处理失败:', error);
                                }
                            }, 540);
                        })
                        .catch((error) => {
                            console.error('连接失败:', error);
                        });
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
                // if (targetWSId !== '') {
                //     // 已连接上
                //     const light = document.getElementById("status-light");
                //     light.style.color = '#00ff37';
                //
                //     // 1秒后将颜色设置回 #ffe99d
                //     setTimeout(() => {
                //         light.style.color = '#ffe99d';
                //     }, 1000);
                // }
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
    // console.log(messageObj)
    wsConn.send(JSON.stringify((messageObj)));
}


function setWave() {
    // read new wave
    const dataA = fs.readFileSync('waveA', 'utf8');
    const durationA = 3; // TODO
    const interval = 4; // TODO
    //波形数据:
    function sendWave () {
        const w1 = { type: "clientMsg",
            message: "A:"+dataA, time: durationA, channel: "A"
        }
        sendWsMsg(w1)
    }
    sendWave()
    waveInterval = setInterval(sendWave, interval * 1000);
}
