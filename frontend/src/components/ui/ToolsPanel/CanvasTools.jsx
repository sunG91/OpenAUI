/**
 * A2UI 画布 — Agent 推送可视化
 * 支持 surfaceUpdate、beginRendering 等 A2UI 协议消息
 * 临时 Demo：React Flow 节点流（拖动、连线、科技感）
 */
import { useState, useEffect, useCallback } from 'react';
import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, addEdge, BaseEdge, getSmoothStepPath, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { canvasGetState, canvasPush, canvasReset } from '../../../api/canvas';

function buildTree(components, rootId) {
  if (!components?.length || !rootId) return null;
  const byId = {};
  components.forEach((c) => { byId[c.id] = c; });
  const root = byId[rootId];
  if (!root) return null;

  function renderNode(node) {
    if (!node?.component) return null;
    const comp = node.component;
    if (comp.Column) {
      const children = comp.Column.children?.explicitList || [];
      return (
        <div key={node.id} className="flex flex-col gap-2">
          {children.map((cid) => {
            const child = byId[cid];
            return child ? <div key={cid}>{renderNode(child)}</div> : null;
          })}
        </div>
      );
    }
    if (comp.Text) {
      const text = comp.Text.text?.literalString ?? '';
      const hint = comp.Text.usageHint || 'body';
      const Tag = hint === 'h1' ? 'h2' : hint === 'h2' ? 'h3' : 'p';
      return (
        <Tag key={node.id} className={hint === 'h1' ? 'text-lg font-bold' : hint === 'h2' ? 'text-base font-semibold' : 'text-sm'}>
          {text}
        </Tag>
      );
    }
    if (comp.Button) {
      const label = comp.Button.label?.literalString ?? '按钮';
      return (
        <button key={node.id} type="button" className="px-3 py-1.5 rounded bg-blue-500 text-white text-sm hover:bg-blue-600">
          {label}
        </button>
      );
    }
    return null;
  }

  return renderNode(root);
}

/** React Flow 科技感节点（临时 Demo）- 必须含 Handle 边才能渲染 */
function TechNode({ data }) {
  return (
    <div
      className="px-4 py-2.5 rounded-lg border-2 border-cyan-500/60 bg-slate-900/95 min-w-[120px] relative"
      style={{ boxShadow: '0 0 12px rgba(0,212,255,0.25)' }}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-cyan-400 !border-cyan-300" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-cyan-400 !border-cyan-300" />
      <div className="text-cyan-400 font-mono text-xs font-medium">{data?.label || '节点'}</div>
      {data?.sub && <div className="text-cyan-500/70 text-[10px] mt-0.5">{data.sub}</div>}
    </div>
  );
}

const nodeTypes = { tech: TechNode };

/** 自定义流动边：青色线条 + 沿路径流动的光点 + 标签（处理中、校验中等） */
function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const label = data?.label || '';
  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        labelX={labelX}
        labelY={labelY}
        label={label}
        labelStyle={{ fill: '#67e8f9', fontSize: 10, fontWeight: 500 }}
        labelShowBg
        labelBgStyle={{ fill: 'rgba(15,23,42,0.95)', stroke: 'rgba(0,212,255,0.5)', strokeWidth: 1 }}
        labelBgPadding={[6, 4]}
        labelBgBorderRadius={4}
        style={{ stroke: 'rgba(0,212,255,0.9)', strokeWidth: 2.5 }}
      />
      <circle r="4" fill="#22d3ee" style={{ filter: 'drop-shadow(0 0 4px rgba(0,212,255,0.8))' }}>
        <animateMotion dur="1.5s" repeatCount="indefinite" path={edgePath} />
      </circle>
    </>
  );
}

const edgeTypes = { flow: FlowEdge };

const INITIAL_NODES = [
  { id: '1', type: 'tech', position: { x: 100, y: 80 }, data: { label: '输入', sub: 'Input' } },
  { id: '2', type: 'tech', position: { x: 320, y: 60 }, data: { label: '处理', sub: 'Process' } },
  { id: '3', type: 'tech', position: { x: 320, y: 160 }, data: { label: '校验', sub: 'Verify' } },
  { id: '4', type: 'tech', position: { x: 540, y: 100 }, data: { label: '输出', sub: 'Output' } },
];

const INITIAL_EDGES = [
  { id: 'e1-2', source: '1', target: '2', type: 'flow', data: { label: '待处理' } },
  { id: 'e1-3', source: '1', target: '3', type: 'flow', data: { label: '待校验' } },
  { id: 'e2-4', source: '2', target: '4', type: 'flow', data: { label: '处理中 → 输出' } },
  { id: 'e3-4', source: '3', target: '4', type: 'flow', data: { label: '校验中 → 输出' } },
];

/** 新连线的默认类型与标签 */
const defaultEdgeOptions = { type: 'flow', data: { label: '连接中' } };

function ReactFlowDemo() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, ...defaultEdgeOptions }, eds)),
    [setEdges]
  );

  return (
    <div className="w-full h-full min-h-[400px] rounded-lg overflow-hidden bg-slate-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        onlyRenderVisibleElements={false}
        className="react-flow-tech"
      >
        <Background variant="dots" gap={16} size={1} color="rgba(0,212,255,0.15)" />
        <Controls className="!bg-slate-800/90 !border-cyan-500/40 !rounded" />
        <MiniMap className="!bg-slate-900 !border-cyan-500/30" />
      </ReactFlow>
      <style>{`
        .react-flow-tech .react-flow__edge-path { stroke: rgba(0,212,255,0.6); stroke-width: 2; }
        .react-flow-tech .react-flow__edge.animated path { stroke-dasharray: 5; animation: dash 0.5s linear infinite; }
        @keyframes dash { to { stroke-dashoffset: -10; } }
        .react-flow-tech .react-flow__controls button { background: rgba(15,23,42,0.9) !important; color: #22d3ee !important; border-color: rgba(0,212,255,0.3) !important; }
        .react-flow-tech .react-flow__controls button:hover { background: rgba(0,212,255,0.2) !important; }
      `}</style>
    </div>
  );
}

const SAMPLE_A2UI = [
  {
    surfaceUpdate: {
      surfaceId: 'main',
      components: [
        { id: 'root', component: { Column: { children: { explicitList: ['title', 'content'] } } } },
        { id: 'title', component: { Text: { text: { literalString: 'A2UI 画布' }, usageHint: 'h1' } } },
        { id: 'content', component: { Text: { text: { literalString: 'Agent 可通过 POST /api/canvas/push 推送 A2UI 消息，此处实时渲染。' }, usageHint: 'body' } } },
      ],
    },
  },
  { beginRendering: { surfaceId: 'main', root: 'root' } },
];

const TABS = [
  { id: 'a2ui', label: 'A2UI 画布' },
  { id: 'demo', label: 'React Flow Demo（临时）' },
];

export function CanvasTools() {
  const [tab, setTab] = useState('a2ui');
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await canvasGetState();
      setState(s);
    } catch (e) {
      setState({ error: e?.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  const handlePushSample = async () => {
    try {
      await canvasPush(SAMPLE_A2UI);
      await refresh();
    } catch (e) {
      setState((s) => ({ ...s, error: e?.message }));
    }
  };

  const handleReset = async () => {
    try {
      await canvasReset();
      await refresh();
    } catch (e) {
      setState((s) => ({ ...s, error: e?.message }));
    }
  };

  const surfaces = state?.surfaces || {};
  const mainSurface = surfaces.main;
  const content = mainSurface
    ? buildTree(mainSurface.components, mainSurface.root)
    : (
        <p className="text-sm text-[var(--input-placeholder)]">
          画布为空。点击「推送示例」或由 Agent 通过 <code className="bg-[#f0f0f0] px-1 rounded">POST /api/canvas/push</code> 推送 A2UI 消息。
        </p>
      );

  return (
    <div className="flex flex-col h-full min-h-0 p-4">
      <div className="flex-shrink-0 flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex rounded-lg border border-[var(--input-bar-border)] bg-[#f8f9fa] p-0.5">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.id ? 'bg-white shadow text-blue-600' : 'text-[var(--input-placeholder)] hover:text-[var(--skill-btn-text)]'}`}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'a2ui' && (
          <>
        <button
          type="button"
          onClick={handlePushSample}
          className="px-3 py-1.5 rounded text-sm font-medium bg-blue-500 text-white hover:bg-blue-600"
        >
          推送示例
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="px-3 py-1.5 rounded text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300"
        >
          清空
        </button>
        <button type="button" onClick={refresh} disabled={loading} className="px-3 py-1.5 rounded text-sm text-[var(--input-placeholder)] hover:bg-gray-100 disabled:opacity-50">
          {loading ? '刷新中...' : '刷新'}
        </button>
          </>
        )}
      </div>
      <div className="flex-1 min-h-0 rounded-lg border border-[var(--input-bar-border)] overflow-hidden">
        {tab === 'demo' ? (
          <ReactFlowDemo />
        ) : (
          <div className="h-full bg-white p-4 overflow-auto">
            <div className="max-w-2xl space-y-3">
              {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
              {content}
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-[var(--input-placeholder)] mt-2">
        {tab === 'demo' ? 'React Flow 临时 Demo：可拖动节点、拖拽连线、科技感样式。' : '支持 A2UI 协议：surfaceUpdate、beginRendering、deleteSurface。Agent 或工具可调用 /api/canvas/push 推送。'}
      </p>
    </div>
  );
}
