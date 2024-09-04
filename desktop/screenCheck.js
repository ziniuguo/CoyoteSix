const OBSWebSocket = require('obs-websocket-js').OBSWebSocket;
const fs = require('fs');
const Jimp = require('jimp').Jimp;
const obs = new OBSWebSocket();

// 连接到 OBS WebSocket
obs.connect('ws://localhost:4455', 'nekopass')
    .then(() => {
        console.log('成功连接到 OBS WebSocket');

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
                console.log('截图已保存为 screenshot.png');

                // 使用 Jimp 读取截图文件并获取特定像素颜色
                Jimp.read(screenshotPath)
                    .then(image => {
                        // 获取特定位置的颜色 (例如 765, 110)
                        const x = 765;
                        const y = 110;
                        const color = image.getPixelColor(x, y); // 返回的是颜色的 ARGB 值

                        // 转换为 HEX 格式
                        const hexColor = color.toString(16).padStart(8, '0').slice(2); // 去掉 alpha 通道并补全 0
                        console.log(`颜色 (HEX): #${hexColor}`);

                        // // 检查颜色是否为白色 (HEX 为 'ffffff')
                        // if (hexColor === 'ffffff') {
                        //     console.log('true');
                        // } else {
                        //     console.log('false');
                        // }
                    })
                    .catch(err => {
                        console.error('读取图像文件失败:', err);
                    });

            } catch (error) {
                console.error('截图或颜色处理失败:', error);
            }
        }, 5000);
    })
    .catch((error) => {
        console.error('连接失败:', error);
    });
