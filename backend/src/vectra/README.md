# Vectra 向量存储模块

基于 [Vectra](https://github.com/Stevenic/vectra) 的本地向量数据库，向量数据存储在 **`backend/data/vectra/`** 独立目录下。

## 特性

- **Node.js 原生**：无需 Python，纯 JavaScript/TypeScript
- **零配置**：本地文件存储，无外部服务
- **跨平台**：Windows / Linux / macOS 均可运行

## 依赖

后端 `package.json` 已包含 `vectra`，执行 `npm install` 即可。

## 目录结构

```
backend/data/vectra/          # 向量数据根目录（与其它数据隔离）
  └── default/                # 默认集合（index.json）
  └── <collection_name>/      # 其它命名集合
```

## 模块说明

- `paths.js` - 路径配置，定义 VECTRA_DATA_DIR
- `store.js` - 集合操作（createOrOpen、insert、query、fetch、deleteById、stats）
- `index.js` - 模块导出
