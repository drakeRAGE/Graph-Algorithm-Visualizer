/* eslint-disable react/prop-types */
/* eslint-disable react/display-name */
import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from 'react';

const Node = React.memo(({ node, onClick, color }) => (
  <g onClick={onClick} className="cursor-pointer">
    <circle
      cx={node.x}
      cy={node.y}
      r="25"
      fill={color}
      className="transition-colors duration-300 shadow-lg"
    />
    <text
      x={node.x}
      y={node.y}
      textAnchor="middle"
      dy=".3em"
      fill="white"
      className="text-sm font-bold pointer-events-none"
    >
      {node.label}
    </text>
  </g>
));

const Edge = React.memo(({ edge, fromNode, toNode, color }) => (
  <g>
    <line
      x1={fromNode.x}
      y1={fromNode.y}
      x2={toNode.x}
      y2={toNode.y}
      stroke={color}
      strokeWidth="3"
      className="transition-colors duration-300"
    />
    <rect
      x={(fromNode.x + toNode.x) / 2 - 12}
      y={(fromNode.y + toNode.y) / 2 - 12}
      width="24"
      height="24"
      fill="white"
      rx="4"
    />
    <text
      x={(fromNode.x + toNode.x) / 2}
      y={(fromNode.y + toNode.y) / 2}
      textAnchor="middle"
      dy=".3em"
      className="text-sm font-semibold"
      fill="#4B5563"
    >
      {edge.weight}
    </text>
  </g>
));

const App = () => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [path, setPath] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeIdCounter, setNodeIdCounter] = useState(1);
  const [startNode, setStartNode] = useState(null);
  const [endNode, setEndNode] = useState(null);
  const [mode, setMode] = useState('add'); // 'add', 'connect', 'setStart', 'setEnd'
  const [weight, setWeight] = useState('1');
  const [isAddingEdge, setIsAddingEdge] = useState(false);
  const [tempEdge, setTempEdge] = useState(null);

  const tempToRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(null);

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const getNodeColor = useCallback(
    (nodeId) => {
      if (nodeId === startNode) return '#22C55E';
      if (nodeId === endNode) return '#8B5CF6';
      if (path.slice(0, currentStep + 1).includes(nodeId)) return '#EF4444';
      return '#4B5563';
    },
    [startNode, endNode, path, currentStep]
  );

  const getEdgeColor = useCallback(
    (from, to) => {
      if (!path.length) return '#9CA3AF';
      for (let i = 0; i < currentStep; i++) {
        if (
          (path[i] === from && path[i + 1] === to) ||
          (path[i] === to && path[i + 1] === from)
        ) {
          return '#EF4444';
        }
      }
      return '#9CA3AF';
    },
    [path, currentStep]
  );

  // Handle canvas click for adding nodes
  const handleCanvasClick = (e) => {
    if (mode !== 'add') return;

    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newNode = {
      id: nodeIdCounter,
      label: `Node ${nodeIdCounter}`,
      x,
      y,
    };

    setNodes([...nodes, newNode]);
    setNodeIdCounter(nodeIdCounter + 1);
  };

  // Handle node click based on current mode
  const handleNodeClick = (node) => {
    if (mode === 'setStart') {
      setStartNode(node.id);
      setMode('add');
    } else if (mode === 'setEnd') {
      setEndNode(node.id);
      setMode('add');
    } else if (mode === 'connect') {
      if (!selectedNode) {
        setSelectedNode(node);
        setIsAddingEdge(true);
        setTempEdge({ from: node, to: { x: node.x, y: node.y } });
        tempToRef.current = { x: node.x, y: node.y };
      } else {
        if (selectedNode.id !== node.id) {
          const newEdge = {
            from: selectedNode.id,
            to: node.id,
            weight: parseInt(weight),
          };
          setEdges([...edges, newEdge]);
        }
        setSelectedNode(null);
        setIsAddingEdge(false);
        setTempEdge(null);
      }
    }
  };

  // Handle mouse move for edge preview
  const handleMouseMove = (e) => {
    if (isAddingEdge) {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      tempToRef.current = { x, y };
      scheduleUpdate(() => {
        setTempEdge((prev) => ({
          ...prev,
          to: { ...tempToRef.current },
        }));
      });
    }
  };

  // Batch updates using requestAnimationFrame
  const scheduleUpdate = (updateFn) => {
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        updateFn();
        rafRef.current = null;
      });
    }
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Dijkstra's algorithm implementation
  const dijkstra = (start, end) => {
    if (!start || !end) return { path: [], steps: [] };

    const distances = {};
    const previous = {};
    const unvisited = new Set();
    const steps = [];

    nodes.forEach((node) => {
      distances[node.id] = Infinity;
      previous[node.id] = null;
      unvisited.add(node.id);
    });
    distances[start] = 0;

    while (unvisited.size > 0) {
      let current = null;
      let minDistance = Infinity;
      unvisited.forEach((nodeId) => {
        if (distances[nodeId] < minDistance) {
          minDistance = distances[nodeId];
          current = nodeId;
        }
      });

      if (current === null || current === end) break;

      unvisited.delete(current);
      steps.push(current);

      edges
        .filter((edge) => edge.from === current || edge.to === current)
        .forEach((edge) => {
          const neighbor = edge.from === current ? edge.to : edge.from;
          if (!unvisited.has(neighbor)) return;

          const newDistance = distances[current] + edge.weight;
          if (newDistance < distances[neighbor]) {
            distances[neighbor] = newDistance;
            previous[neighbor] = current;
          }
        });
    }

    const path = [];
    let current = end;
    while (current !== null) {
      path.unshift(current);
      current = previous[current];
    }

    return { path, steps };
  };

  const startAlgorithm = () => {
    const result = dijkstra(startNode, endNode);
    setPath(result.path);
    setCurrentStep(0);
  };

  const nextStep = () => {
    if (currentStep < path.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const reset = () => {
    setCurrentStep(0);
    setPath([]);
  };

  const clearAll = () => {
    setNodes([]);
    setEdges([]);
    setPath([]);
    setCurrentStep(0);
    setStartNode(null);
    setEndNode(null);
    setNodeIdCounter(1);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          Interactive Dijkstra Algorithm Visualizer
        </h1>

        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => setMode('add')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                mode === 'add'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Add Nodes
            </button>
            <button
              onClick={() => setMode('connect')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                mode === 'connect'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Connect Nodes
            </button>
            <button
              onClick={() => setMode('setStart')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                mode === 'setStart'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Set Start Node
            </button>
            <button
              onClick={() => setMode('setEnd')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                mode === 'setEnd'
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Set End Node
            </button>
          </div>

          {mode === 'connect' && (
            <div className="flex justify-center items-center gap-4">
              <label className="text-gray-700">Edge Weight:</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-20 px-2 py-1 border rounded-lg"
                min="1"
              />
            </div>
          )}

          <div className="flex justify-center gap-4">
            <button
              onClick={startAlgorithm}
              disabled={!startNode || !endNode}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Algorithm
            </button>
            <button
              onClick={nextStep}
              disabled={!path.length || currentStep >= path.length - 1}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next Step
            </button>
            <button
              onClick={reset}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-semibold"
            >
              Reset
            </button>
            <button
              onClick={clearAll}
              className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold"
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="relative">
          <svg
            className="w-full h-96 border rounded-xl bg-gray-50"
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
          >
            {/* Draw edges */}
            {edges.map((edge, index) => (
              <Edge
                key={`edge-${index}`}
                edge={edge}
                fromNode={nodeMap.get(edge.from)}
                toNode={nodeMap.get(edge.to)}
                color={getEdgeColor(edge.from, edge.to)}
              />
            ))}

            {/* Draw temporary edge while connecting */}
            {tempEdge && (
              <line
                x1={tempEdge.from.x}
                y1={tempEdge.from.y}
                x2={tempEdge.to.x}
                y2={tempEdge.to.y}
                stroke="#9CA3AF"
                strokeWidth="3"
                strokeDasharray="5,5"
              />
            )}

            {/* Draw nodes */}
            {nodes.map((node) => (
              <Node
                key={`node-${node.id}`}
                node={node}
                onClick={() => handleNodeClick(node)}
                color={getNodeColor(node.id)}
              />
            ))}
          </svg>
        </div>

        <div className="mt-6 bg-gray-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Instructions:
          </h3>
          <ul className="text-gray-600 space-y-1">
            <li>1. Click "Add Nodes" and click on the canvas to add nodes</li>
            <li>
              2. Click "Connect Nodes" and select two nodes to connect them
            </li>
            <li>3. Set start and end nodes using the respective buttons</li>
            <li>4. Click "Start Algorithm" to find the shortest path</li>
          </ul>
        </div>

        <div className="mt-4 flex justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-600">Start Node</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-purple-500"></div>
            <span className="text-sm text-gray-600">End Node</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span className="text-sm text-gray-600">Visited Node</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
