/**
 * 天枢架构 · AUI 画布（React Flow）
 * 对标工具面板 A2UI 画布科技感：深色、青色流动边、全模块节点
 */
import { useCallback, useMemo, useEffect, useId, memo } from 'react';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  BaseEdge,
  getSmoothStepPath,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TianshuViewportHelper } from './TianshuViewportHelper';

/** 默认 props 勿用内联 {}，否则父级每次重渲染（如输入框打字）都会得到新引用，触发 useEffect 重置画布闪屏 */
const EMPTY_OBJ = Object.freeze({});

/**
 * 边语义（与侧栏「思考 / 消息 / 执行」及流程阶段对照）
 * - thinking: 用户→三层决策（意图拆解、审核、监督）→ 对应「思考」
 * - dispatch: 璇玑→执行部（调度）→ 对应「消息」帧
 * - exec: 执行部→赏罚（反馈）→ 对应「执行」回执
 * - close: 赏罚→闭环
 */
const EDGE_KIND_TAG = {
  thinking: '思考',
  dispatch: '消息',
  exec: '执行',
  close: '闭环',
};

const EDGE_THEME = {
  thinking: {
    stroke: 'rgba(167,139,250,0.88)',
    strokeWidth: 2,
    strokeDasharray: '7 5',
    labelFill: '#ddd6fe',
    labelBg: 'rgba(30,27,75,0.92)',
    labelStroke: 'rgba(167,139,250,0.45)',
    dotMain: '#a78bfa',
    dotTrail: '#e9d5ff',
    durSec: 3.2,
  },
  dispatch: {
    stroke: 'rgba(34,211,238,0.9)',
    strokeWidth: 2,
    strokeDasharray: undefined,
    labelFill: '#a5f3fc',
    labelBg: 'rgba(15,23,42,0.92)',
    labelStroke: 'rgba(34,211,238,0.5)',
    dotMain: '#22d3ee',
    dotTrail: '#cffafe',
    durSec: 2.35,
  },
  exec: {
    stroke: 'rgba(52,211,153,0.92)',
    strokeWidth: 2,
    strokeDasharray: undefined,
    labelFill: '#a7f3d0',
    labelBg: 'rgba(6,78,59,0.88)',
    labelStroke: 'rgba(52,211,153,0.5)',
    dotMain: '#34d399',
    dotTrail: '#6ee7b7',
    durSec: 1.75,
  },
  close: {
    stroke: 'rgba(251,191,36,0.9)',
    strokeWidth: 2,
    strokeDasharray: '4 6',
    labelFill: '#fde68a',
    labelBg: 'rgba(69,26,3,0.88)',
    labelStroke: 'rgba(251,191,36,0.45)',
    dotMain: '#fbbf24',
    dotTrail: '#fef3c7',
    durSec: 2.65,
  },
};

/** 流动边 + 与流程/思考·消息·执行 对照的标签与动效（memo 避免无关重绘） */
const FlowEdge = memo(function FlowEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const kind = data?.kind && EDGE_THEME[data.kind] ? data.kind : 'dispatch';
  const theme = EDGE_THEME[kind];
  const baseLabel = data?.label || '';
  const tag = EDGE_KIND_TAG[kind] || '';
  const label = tag && baseLabel ? `${tag} · ${baseLabel}` : baseLabel || tag;

  const dur = `${theme.durSec}s`;
  const trailBegin = `${Math.min(0.85, theme.durSec * 0.28).toFixed(2)}s`;

  const lineStyle = useMemo(
    () => ({
      stroke: theme.stroke,
      strokeWidth: theme.strokeWidth,
      ...(theme.strokeDasharray ? { strokeDasharray: theme.strokeDasharray } : {}),
    }),
    [theme.stroke, theme.strokeWidth, theme.strokeDasharray],
  );

  const flowOn = data?.flowActive === true;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        labelX={labelX}
        labelY={labelY}
        label={label}
        labelStyle={{ fill: theme.labelFill, fontSize: 9, fontWeight: 600 }}
        labelShowBg
        labelBgStyle={{ fill: theme.labelBg, stroke: theme.labelStroke, strokeWidth: 1 }}
        labelBgPadding={[5, 3]}
        labelBgBorderRadius={4}
        style={lineStyle}
      />
      {flowOn && (
        <g className="pointer-events-none" style={{ isolation: 'isolate' }}>
          <circle r="3.5" fill={theme.dotMain} opacity={0.95} shapeRendering="optimizeSpeed">
            <animateMotion dur={dur} repeatCount="indefinite" path={edgePath} />
          </circle>
          <circle r="2" fill={theme.dotTrail} opacity={0.7} shapeRendering="optimizeSpeed">
            <animateMotion dur={dur} repeatCount="indefinite" path={edgePath} begin={trailBegin} />
          </circle>
        </g>
      )}
    </>
  );
});

const edgeTypes = { flow: FlowEdge };

const VARIANT = {
  user: 'from-sky-500/20 to-blue-900/40 border-sky-400/50 text-sky-100',
  layerA: 'from-amber-500/15 to-amber-950/50 border-amber-400/50 text-amber-100',
  layerB: 'from-violet-500/15 to-violet-950/50 border-violet-400/50 text-violet-100',
  layerC: 'from-fuchsia-500/15 to-fuchsia-950/50 border-fuchsia-400/50 text-fuchsia-100',
  dept: 'from-slate-700/80 to-slate-900/90 border-slate-500/40 text-slate-200',
  mech: 'from-emerald-500/15 to-emerald-950/50 border-emerald-400/50 border-dashed text-emerald-100',
};

/** 标题右侧：运行中 · 粒子绕核旋转（多节点实例需唯一渐变 id） */
function RunningParticleOrb() {
  const gid = useId().replace(/:/g, '');
  const gradId = `orb-glow-${gid}`;
  return (
    <svg
      className="shrink-0"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      aria-hidden
    >
      <defs>
        <radialGradient id={gradId} cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ecfeff" />
          <stop offset="45%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0891b2" />
        </radialGradient>
      </defs>
      {/* 内核光球 */}
      <circle cx="10" cy="10" r="3.2" fill={`url(#${gradId})`} opacity={0.98} />
      <circle cx="10" cy="10" r="3.2" fill="none" stroke="rgba(103,232,249,0.45)" strokeWidth="0.6" />
      {/* 轨道粒子：整组旋转 */}
      <g>
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 10 10"
          to="360 10 10"
          dur="1.85s"
          repeatCount="indefinite"
        />
        <circle cx="10" cy="3.5" r="1.35" fill="#f0fdfa" opacity={0.95} />
        <circle cx="10" cy="3.5" r="1.15" fill="#67e8f9" transform="rotate(120 10 10)" />
        <circle cx="10" cy="3.5" r="1.05" fill="#a5f3fc" transform="rotate(240 10 10)" />
      </g>
      {/* 反向慢旋外晕，增强「粒子感」 */}
      <g opacity={0.55}>
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="360 10 10"
          to="0 10 10"
          dur="3.2s"
          repeatCount="indefinite"
        />
        <circle cx="10" cy="2.8" r="0.55" fill="#cffafe" />
        <circle cx="10" cy="2.8" r="0.45" fill="#e0f2fe" transform="rotate(180 10 10)" />
      </g>
    </svg>
  );
}

function statusRing(status) {
  /** 不使用 animate-pulse，避免拖拽时持续重绘加剧闪屏 */
  if (status === 'rest') {
    return 'opacity-60 saturate-[0.7] border-slate-500/55 border-dashed';
  }
  if (status === 'active') return 'ring-2 ring-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.35)]';
  if (status === 'done') return 'ring-1 ring-emerald-500/60 shadow-[0_0_10px_rgba(16,185,129,0.2)]';
  if (status === 'error') return 'ring-2 ring-red-500/70';
  if (status === 'skipped') return 'opacity-40 border-dashed';
  return '';
}

function ArchNode({ data }) {
  const { label, sub, status = 'idle', variant = 'dept', badge } = data;
  const v = VARIANT[variant] || VARIANT.dept;
  return (
    <div
      className={`
        px-3 py-2.5 rounded-xl border-2 min-w-[112px] max-w-[200px] relative
        bg-gradient-to-br ${v} ${statusRing(status)}
      `}
    >
      {/* 左进右出 + 上进下出：支持「决策横排 + 执行部分行」 */}
      <Handle id="h-l" type="target" position={Position.Left} className="!w-2 !h-2 !bg-cyan-400 !border-cyan-200" />
      <Handle id="h-r" type="source" position={Position.Right} className="!w-2 !h-2 !bg-cyan-400 !border-cyan-200" />
      <Handle id="h-t" type="target" position={Position.Top} className="!w-2 !h-2 !bg-cyan-400 !border-cyan-200" />
      <Handle id="h-b" type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-cyan-400 !border-cyan-200" />
      {badge && (
        <span className="absolute -top-2 -right-1 text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/90 text-white font-bold">
          {badge}
        </span>
      )}
      <div className="flex items-start gap-1.5 min-w-0">
        <div className="text-[11px] font-bold tracking-wide leading-tight min-w-0 flex-1">{label}</div>
        {status === 'active' && (
          <span className="shrink-0 mt-px" title="运行中 / 输出中">
            <RunningParticleOrb />
          </span>
        )}
      </div>
      {sub && (
        <div className="text-[9px] text-white/60 mt-1 leading-snug line-clamp-2">{sub}</div>
      )}
      {status === 'rest' && !badge && (
        <span className="absolute -top-1.5 -right-1 text-[8px] px-1 py-px rounded bg-slate-700/90 text-slate-300 border border-slate-500/50">
          休息
        </span>
      )}
    </div>
  );
}

const nodeTypes = { arch: ArchNode };

/** 始终展示全部执行部；是否「休息」由 nodeStatus 控制 */
function buildGraph(architecture) {
  if (!architecture) return { nodes: [], edges: [] };

  const layers = architecture.decisionLayers || [];
  const depts = architecture.executionDepts || [];
  const mechs = architecture.mechanisms || [];

  const nodes = [];
  const edges = [];

  /**
   * 列式分散布局（从左到右）：
   * ① 用户意图 ② 三层决策（竖排 3 个）③ 七大执行部 4+3：左列 4 个、右列 3 个**交错**（右列左移 + 垂直错半格，便于连线交叉分流）④ 赏罚台 + 闭环
   */
  const X_USER = 40;
  const X_LAYERS = 280;
  const X_DEPT_COL4 = 600;
  /** 右列整体左移，与左列更近，线条从璇玑分出时更易呈「交叉」感 */
  const X_DEPT_COL5 = 720;
  const X_TAIL = 1140;
  const GAP_LAYER_Y = 175;
  const GAP_DEPT_Y = 145;
  /** 右列相对左列向下错半格，与左列节点在行上交叉分布 */
  const DEPT_STAGGER_Y = GAP_DEPT_Y / 2;
  const LAYER_Y0 = 70;

  const push = (id, x, y, data) => {
    nodes.push({ id, type: 'arch', position: { x, y }, data });
  };

  const edgeLR = (id, src, tgt, label, kind = 'dispatch') => {
    edges.push({
      id,
      source: src,
      target: tgt,
      sourceHandle: 'h-r',
      targetHandle: 'h-l',
      type: 'flow',
      data: { label, kind },
    });
  };

  const edgeTB = (id, src, tgt, label, kind = 'dispatch') => {
    edges.push({
      id,
      source: src,
      target: tgt,
      sourceHandle: 'h-b',
      targetHandle: 'h-t',
      type: 'flow',
      data: { label, kind },
    });
  };

  /** 第 2 列：三层决策竖排 */
  layers.forEach((layer, i) => {
    const variants = ['layerA', 'layerB', 'layerC'];
    push(`node-${layer.id}`, X_LAYERS, LAYER_Y0 + i * GAP_LAYER_Y, {
      label: layer.name,
      sub: `${layer.role} · ${layer.desc}`,
      variant: variants[i] || 'layerA',
      status: 'idle',
    });
  });

  /** 第 1 列：用户（与三决策块垂直居中对齐） */
  const layerMidY =
    layers.length >= 2 ? LAYER_Y0 + ((layers.length - 1) * GAP_LAYER_Y) / 2 : LAYER_Y0;
  push('node-user', X_USER, layerMidY, { label: '用户意图', sub: 'Input / 目标输入', variant: 'user', status: 'idle' });

  if (layers[0]) {
    edgeLR('e-user-l1', 'node-user', `node-${layers[0].id}`, '意图传递', 'thinking');
  }
  for (let i = 0; i < layers.length - 1; i++) {
    edgeTB(
      `e-l${i}-l${i + 1}`,
      `node-${layers[i].id}`,
      `node-${layers[i + 1].id}`,
      i === 0 ? '拆解计划' : '监督',
      'thinking',
    );
  }

  const lastLayer = layers[layers.length - 1];
  const col4 = depts.slice(0, 4);
  const col5 = depts.slice(4, 7);

  const deptTop4 = 55;
  col4.forEach((d, i) => {
    push(`node-dept-${d.id}`, X_DEPT_COL4, deptTop4 + i * GAP_DEPT_Y, {
      label: d.name,
      sub: d.desc,
      variant: 'dept',
      status: 'idle',
      deptId: d.id,
    });
    if (lastLayer) {
      edgeLR(`e-xuan-${d.id}`, `node-${lastLayer.id}`, `node-dept-${d.id}`, '调度', 'dispatch');
    }
  });

  /** 右列 3 个：X 左移 + Y 与左列交错（错半格），与左列 4 个呈「交叉」排布 */
  col5.forEach((d, i) => {
    const y = deptTop4 + DEPT_STAGGER_Y + i * GAP_DEPT_Y;
    push(`node-dept-${d.id}`, X_DEPT_COL5, y, {
      label: d.name,
      sub: d.desc,
      variant: 'dept',
      status: 'idle',
      deptId: d.id,
    });
    if (lastLayer) {
      edgeLR(`e-xuan-${d.id}`, `node-${lastLayer.id}`, `node-dept-${d.id}`, '调度', 'dispatch');
    }
  });

  const mech = mechs[0];
  const tailY1 = 210;
  const tailY2 = 460;
  if (mech) {
    push('node-shangfa', X_TAIL, tailY1, {
      label: mech.name,
      sub: `${mech.role} · ${mech.desc}`,
      variant: 'mech',
      status: 'idle',
    });
    depts.forEach((d) => {
      edgeLR(`e-dept-sf-${d.id}`, `node-dept-${d.id}`, 'node-shangfa', '反馈', 'exec');
    });
  }

  push('node-reward', X_TAIL, mech ? tailY2 : tailY1, {
    label: '体验闭环',
    sub: '赏罚台 · 主观评分',
    variant: 'user',
    status: 'idle',
  });
  if (mech) {
    edgeTB('e-sf-reward', 'node-shangfa', 'node-reward', '闭环', 'close');
  }

  return { nodes, edges };
}

/** @param {{ architecture: object, nodeStatus?: object, edgeLabels?: object, edgeFlowActive?: Record<string, boolean>, focusNodeId?: string | null }} props */
function TianshuArchitectureCanvasInner({ architecture, nodeStatus = EMPTY_OBJ, edgeLabels = EMPTY_OBJ, edgeFlowActive = EMPTY_OBJ, focusNodeId = null }) {
  const built = useMemo(() => buildGraph(architecture), [architecture]);
  const [nodes, setNodes, onNodesChange] = useNodesState(built.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(built.edges);

  const fitViewOpts = useMemo(() => ({ padding: 0.22 }), []);

  useEffect(() => {
    setNodes(built.nodes);
    setEdges(
      built.edges.map((e) => ({
        ...e,
        data: {
          ...e.data,
          flowActive: edgeFlowActive[e.id] === true,
          label: edgeLabels[e.id] ?? e.data.label,
        },
      })),
    );
  }, [built, edgeFlowActive, edgeLabels, setNodes, setEdges]);

  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const st = nodeStatus[n.id];
        if (!st) return n;
        return {
          ...n,
          data: { ...n.data, status: st },
        };
      }),
    );
  }, [nodeStatus, setNodes]);

  const onInit = useCallback((instance) => {
    instance.fitView({ padding: 0.2, duration: 400 });
  }, []);

  return (
    <div className="w-full min-h-0 flex-1 flex flex-col rounded-xl overflow-hidden border border-sky-400/40 bg-slate-950/20 shadow-inner shadow-sky-950/50 ring-1 ring-cyan-400/15">
      <div className="flex-1 min-h-0 min-w-0">
        <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={onInit}
          fitView
          fitViewOptions={fitViewOpts}
          minZoom={0.35}
          maxZoom={1.45}
          proOptions={{ hideAttribution: true }}
          zoomOnDoubleClick={false}
          onlyRenderVisibleElements={false}
          elevateNodesOnSelect={false}
          className="tianshu-flow-canvas !h-full !min-h-0 !bg-transparent [&_.react-flow__pane]:cursor-grab [&_.react-flow__pane:active]:cursor-grabbing"
        >
          <TianshuViewportHelper focusNodeId={focusNodeId} />
          <Background color="rgba(56,189,248,0.14)" gap={24} size={1} />
        </ReactFlow>
        </ReactFlowProvider>
      </div>
    </div>
  );
}

export const TianshuArchitectureCanvas = memo(TianshuArchitectureCanvasInner);
