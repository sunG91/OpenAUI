/**
 * 在 ReactFlow 子树内根据节点 id 自动 fitView 定位
 */
import { useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';

export function TianshuViewportHelper({ focusNodeId }) {
  const { fitView, getNode } = useReactFlow();

  useEffect(() => {
    if (!focusNodeId) return;
    const t = requestAnimationFrame(() => {
      const n = getNode(focusNodeId);
      if (!n) return;
      fitView({
        nodes: [{ id: focusNodeId }],
        padding: 0.42,
        duration: 520,
        minZoom: 0.45,
        maxZoom: 1.25,
      });
    });
    return () => cancelAnimationFrame(t);
  }, [focusNodeId, fitView, getNode]);

  return null;
}
