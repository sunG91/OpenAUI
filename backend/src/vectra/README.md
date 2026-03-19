# Vectra 向量存储模块

基于 [Vectra](https://github.com/Stevenic/vectra) 的本地向量数据库，向量数据存储在 **`backend/data/vectra/`** 独立目录下。  
整合 [@xenova/transformers](https://github.com/xenova/transformers.js) 实现文本→向量嵌入。

## 特性

- **Node.js 原生**：无需 Python，纯 JavaScript
- **零 API 依赖**：Vectra 存储 + Xenova 本地嵌入
- **跨平台**：Windows / Linux / macOS 均可运行

## 依赖

- `vectra` - 向量存储
- `@xenova/transformers` - 文本嵌入（Xenova/all-MiniLM-L6-v2，384 维）

执行 `npm install` 即可。

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
