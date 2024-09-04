const robot = require('robotjs');

// 定义要读取的屏幕位置 (x, y)
const x = 960;  // 替换为你需要的位置的x坐标
const y = 540;  // 替换为你需要的位置的y坐标

// 每隔五秒读取一次该位置的颜色
setInterval(() => {
    // 获取屏幕指定位置的颜色
    const color = robot.getPixelColor(x, y);

    // 打印颜色，颜色为十六进制格式
    console.log(`颜色: #${color}`);

    // 检查颜色是否为白色 (白色的十六进制为 'ffffff')
    if (color === 'ffffff') {
        console.log('true');
    } else {
        console.log('false');
    }
}, 5000);
