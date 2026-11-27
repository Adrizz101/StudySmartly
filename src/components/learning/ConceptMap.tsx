import { useMemo, useState } from 'react';
import dagre from '@dagrejs/dagre';
import {
  ReactFlow,
  Background,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ConceptMapData } from '@/lib/learning-models';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 72;

type ConceptNodeData = { label: string; nodeType: 'topic' | 'subtopic' | 'detail' };

function ConceptNode({ data }: NodeProps<Node<ConceptNodeData>>) {
  const palette = data.nodeType === 'topic'
    ? 'border-emerald-500 bg-slate-800'
    : data.nodeType === 'subtopic'
      ? 'border-sky-500 bg-slate-800'
      : 'border-slate-500 bg-slate-800';

  return (
    <div className={`flex h-full w-full max-w-[200px] items-center justify-center rounded-xl border-2 px-3 py-2 text-center text-sm font-medium leading-snug text-white shadow-lg break-words whitespace-normal ${palette}`}>
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-slate-300 !bg-slate-500" />
      <span className="max-w-full">{data.label}</span>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-slate-300 !bg-slate-500" />
    </div>
  );
}

const nodeTypes = { concept: ConceptNode };

function layoutGraph(map: ConceptMapData): { nodes: Node<ConceptNodeData>[]; edges: Edge[] } {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  // Dagre uses rankdir for its layout direction; TB keeps the concept map vertical.
graph.setGraph({ rankdir: 'TB', nodesep: 36, ranksep: 64, marginx: 24, marginy: 24 });

  map.nodes.forEach((node) => graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  map.edges.forEach((edge, index) => graph.setEdge(edge.source, edge.target, { label: edge.label ?? '', id: 'edge-' + index }));
  dagre.layout(graph);

  const nodes: Node<ConceptNodeData>[] = map.nodes.map((node) => {
    const position = graph.node(node.id);
    return {
      id: node.id,
      type: 'concept',
      position: { x: position.x - NODE_WIDTH / 2, y: position.y - NODE_HEIGHT / 2 },
      data: { label: node.label, nodeType: node.type },
      style: { width: NODE_WIDTH, height: NODE_HEIGHT, maxWidth: NODE_WIDTH, padding: 0, border: 'none', background: 'transparent' },
    };
  });

  const edges: Edge[] = map.edges.map((edge, index) => ({
    id: 'edge-' + index,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: 'smoothstep',
    animated: false,
    style: { stroke: '#64748b', strokeWidth: 1.6 },
    labelStyle: { fill: '#e2e8f0', fontSize: 11, fontWeight: 600 },
    labelBgStyle: { fill: '#0a0c10', fillOpacity: 0.96 },
  }));

  return { nodes, edges };
}

export default function ConceptMap({ map }: { map: ConceptMapData & { cached?: boolean } }) {
  const [fullScreen, setFullScreen] = useState(false);
  const graph = useMemo(() => layoutGraph(map), [map]);

  const renderFlow = (className: string) => (
    <div className={`relative min-w-0 overflow-hidden ${className}`}>
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
        panOnDrag
        zoomOnPinch
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        className="bg-[#0a0c10]"
      >
        <Background variant="dots" gap={22} size={1} color="#263244" />
      </ReactFlow>
    </div>
  );

  return (
    <div className="relative w-full min-w-0 max-w-full overflow-hidden">
      {map.cached && <span className="absolute right-2 top-12 z-10 rounded-full border border-emerald-400/30 bg-emerald-950/90 px-2.5 py-1 text-[11px] font-medium text-emerald-300 shadow-sm" role="status">⚡ Loaded from cache</span>}
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">{map.title}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => setFullScreen(true)} className="h-8 shrink-0 gap-1.5 px-2 text-xs">
          <Maximize2 size={13} /> Full Screen
        </Button>
      </div>
      {renderFlow('h-[350px] w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-slate-700 bg-[#0a0c10]')}
      <Dialog open={fullScreen} onOpenChange={setFullScreen}>
        <DialogContent className="fixed left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 gap-3 overflow-hidden rounded-none border-0 bg-[#0a0c10] p-3 sm:rounded-none">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>{map.title}</DialogTitle>
          </DialogHeader>
          {renderFlow('h-[calc(100dvh-5rem)] w-full min-w-0 overflow-hidden rounded-lg border border-slate-700 bg-[#0a0c10]')}
        </DialogContent>
      </Dialog>
    </div>
  );
}
