import { useMemo, useState } from 'react';
import dagre from '@dagrejs/dagre';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node,
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

const NODE_WIDTH = 164;
const NODE_HEIGHT = 58;

function layoutGraph(map: ConceptMapData): { nodes: Node[]; edges: Edge[] } {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: 'TB', nodesep: 24, ranksep: 52, marginx: 18, marginy: 18 });

  map.nodes.forEach((node) => graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  map.edges.forEach((edge, index) => graph.setEdge(edge.source, edge.target, { label: edge.label ?? '', id: 'edge-' + index }));
  dagre.layout(graph);

  const nodes: Node[] = map.nodes.map((node) => {
    const position = graph.node(node.id);
    const palette = node.type === 'topic'
      ? 'border-accent-500 bg-accent-500/15 text-text'
      : node.type === 'subtopic'
        ? 'border-sky-500/60 bg-sky-500/10 text-text'
        : 'border-border bg-surface-hover text-text-muted';
    return {
      id: node.id,
      position: { x: position.x - NODE_WIDTH / 2, y: position.y - NODE_HEIGHT / 2 },
      data: { label: node.label },
      style: {
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        borderRadius: 12,
        border: '1px solid',
        borderColor: node.type === 'topic' ? 'var(--color-accent-500, #10b981)' : node.type === 'subtopic' ? '#0ea5e9' : 'var(--border)',
        background: node.type === 'topic' ? 'rgba(16,185,129,.16)' : node.type === 'subtopic' ? 'rgba(14,165,233,.12)' : 'var(--surface-hover)',
        color: 'var(--text)',
        padding: 10,
        fontSize: 12,
        fontWeight: node.type === 'topic' ? 700 : 500,
        textAlign: 'center' as const,
        overflowWrap: 'anywhere' as const,
      },
      className: palette,
    };
  });

  const edges: Edge[] = map.edges.map((edge, index) => ({
    id: 'edge-' + index,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: 'smoothstep',
    animated: false,
    style: { stroke: 'var(--muted-foreground)', strokeWidth: 1.4 },
    labelStyle: { fill: 'var(--text-muted)', fontSize: 10 },
    labelBgStyle: { fill: 'var(--background)', fillOpacity: 0.9 },
  }));

  return { nodes, edges };
}

export default function ConceptMap({ map }: { map: ConceptMapData }) {
  const [fullScreen, setFullScreen] = useState(false);
  const graph = useMemo(() => layoutGraph(map), [map]);

  const renderFlow = (className: string) => (
    <div className={className}>
      <ReactFlow
        nodes={graph.nodes}
        edges={graph.edges}
        fitView
        fitViewOptions={{ padding: 0.18, minZoom: 0.35, maxZoom: 1.15 }}
        panOnDrag
        zoomOnPinch
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden">
      <div className="mb-2 flex items-center justify-end">
        <Button type="button" variant="outline" size="sm" onClick={() => setFullScreen(true)} className="h-8 gap-1.5 px-2 text-xs">
          <Maximize2 size={13} /> Full Screen
        </Button>
      </div>
      {renderFlow('h-[350px] w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-background')}
      <Dialog open={fullScreen} onOpenChange={setFullScreen}>
        <DialogContent className="fixed left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 gap-3 overflow-hidden rounded-none border-0 p-3 sm:rounded-none">
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle>{map.title}</DialogTitle>
          </DialogHeader>
          {renderFlow('h-[calc(100dvh-5rem)] w-full min-w-0 overflow-hidden rounded-lg border border-border bg-background')}
        </DialogContent>
      </Dialog>
    </div>
  );
}
