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
npm run vision:download-model
```
将自动下载 YOLOv8n 预训练模型（约 12MB）到本目录。

### 方式二：手动下载
- **YOLOv8n**（通用 80 类，轻量）：  
  https://huggingface.co/Kalray/yolov8/resolve/main/yolov8n.onnx
- 下载后重命名为 `yolov8n.onnx` 放入本目录

### 方式三：自训练导出
```bash
yolo export model=your_model.pt format=onnx
```
将生成的 `.onnx` 文件放入本目录。

## 使用步骤
1. 按上述方式下载或导出 `.onnx` 模型
2. 放入本目录
3. 在工具面板「本地视觉检测」中选择模型并检测

## 龙虾专用模型
需自行训练或从其他渠道获取。训练完成后执行 `yolo export model=lobster.pt format=onnx` 导出。
