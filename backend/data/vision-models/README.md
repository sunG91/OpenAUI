# 本地视觉模型目录

将 **YOLO/ONNX** 模型文件（`.onnx`）放入此目录即可使用。模型文件已加入 `.gitignore`，不会随仓库上传。

## 特点
- 100% 本地运行，无需联网
- 不依赖第三方 API，不产生费用
- 隐私安全，图片不会上传

## 下载方式

### 方式一：npm 脚本（推荐）
```bash
cd backend
npm run vision:download-all
```
将自动下载多个模型到本目录：
- **yolov8n.onnx**（12MB）、**yolov8s.onnx**（45MB）、**yolov8m.onnx**（104MB）— 通用 COCO 80 类
- **Windows UI**、**GPA-GUI** 的 .pt 文件（需转换，见下方）

仅下载轻量模型：`npm run vision:download-model`（仅 yolov8n）

### 方式二：手动下载

**通用模型（人物、车辆、电脑等）：**
- **YOLOv8n**（COCO 80 类，轻量）：  
  https://huggingface.co/Kalray/yolov8/resolve/main/yolov8n.onnx

**UI 元素模型（按钮、输入框、图标，电脑自动化首选）：**
- **UI Detector YOLOv8**（OpenClaw 同款，最准）：  
  https://github.com/xulianwu/ui-detection-yolov8/releases  
  下载 `yolov8_ui_best.onnx` 放入本目录
- **Windows UI YOLOv8**（Windows 控件专用）：  
  https://github.com/hanbinchen/windows-ui-yolov8/releases
- **Web UI YOLOv8**（网页元素专用）：  
  https://github.com/erikl13/web-ui-yolov8/releases

下载后放入本目录，在工具中选择「类别: UI 元素」即可。

### 方式三：自训练导出
```bash
yolo export model=your_model.pt format=onnx
```
将生成的 `.onnx` 文件放入本目录。

## 使用步骤
1. 按上述方式下载或导出 `.onnx` 模型
2. 放入本目录
3. 在工具面板「本地视觉检测」中选择模型并检测

## .pt 转 ONNX（UI 模型）
下载的 Windows UI、GPA-GUI 等为 .pt 格式，需转换后使用：
```bash
pip install ultralytics
cd backend && npm run vision:convert-pt
```
转换后的 .onnx 将出现在本目录，在工具中选择「类别: UI 元素」即可。

## 自定义专用模型
需自行训练或从其他渠道获取。训练完成后执行 `yolo export model=your_model.pt format=onnx` 导出。
