'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react'

interface Node {
  id: string
  label: string
  description?: string
  level?: number
  category?: string
  parent_id?: string
}

interface Edge {
  source: string
  target: string
  label?: string
}

interface KnowledgeGraphProps {
  nodes: Node[]
  edges: Edge[]
  title?: string
}

// Category color mapping
const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
  main: { bg: '#344895', border: '#1A1F71', text: '#FFFFFF' },
  mechanism: { bg: '#3B82F6', border: '#2563EB', text: '#FFFFFF' },
  treatment: { bg: '#10B981', border: '#059669', text: '#FFFFFF' },
  symptom: { bg: '#F59E0B', border: '#D97706', text: '#1A1F71' },
  diagnosis: { bg: '#8B5CF6', border: '#7C3AED', text: '#FFFFFF' },
  pharmacology: { bg: '#14B8A6', border: '#0D9488', text: '#FFFFFF' },
  default: { bg: '#3DD6D0', border: '#2BB5AF', text: '#1A1F71' },
}

export default function KnowledgeGraph({ nodes, edges }: KnowledgeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width } = containerRef.current.getBoundingClientRect()
        // Responsive height based on screen size
        const height = window.innerWidth < 640 ? 400 : window.innerWidth < 1024 ? 500 : 600
        setDimensions({ width, height })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Zoom controls
  const handleZoom = useCallback((direction: 'in' | 'out' | 'reset' | 'fit') => {
    if (!svgRef.current || !zoomRef.current) return

    const svg = d3.select(svgRef.current)
    const zoom = zoomRef.current

    if (direction === 'reset') {
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity)
    } else if (direction === 'fit') {
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity.scale(0.8).translate(dimensions.width * 0.1, dimensions.height * 0.1))
    } else {
      const scale = direction === 'in' ? 1.3 : 0.7
      svg.transition().duration(300).call(zoom.scaleBy, scale)
    }
  }, [dimensions])

  // Main D3 rendering
  useEffect(() => {
    if (!svgRef.current || !nodes.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const { width, height } = dimensions

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    zoomRef.current = zoom
    svg.call(zoom)

    // Main group for zooming
    const g = svg.append('g')

    // Prepare data for D3
    const nodeMap = new Map(nodes.map(n => [n.id, n]))
    
    const d3Nodes = nodes.map(n => ({
      ...n,
      x: width / 2,
      y: height / 2,
    }))

    const d3Links = edges
      .filter(e => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map(e => ({
        ...e,
        source: e.source,
        target: e.target,
      }))

    // Create force simulation
    const simulation = d3.forceSimulation(d3Nodes as any)
      .force('link', d3.forceLink(d3Links as any)
        .id((d: any) => d.id)
        .distance(120)
        .strength(0.5))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(60))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05))

    // Add arrow marker for directed edges
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#344895')
      .style('opacity', 0.6)

    // Add glow filter
    const defs = svg.select('defs')
    const filter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%')

    filter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur')

    const feMerge = filter.append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'coloredBlur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Draw links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(d3Links)
      .enter()
      .append('line')
      .attr('stroke', '#344895')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 2)
      .attr('marker-end', 'url(#arrowhead)')

    // Draw link labels
    const linkLabel = g.append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(d3Links.filter(l => l.label))
      .enter()
      .append('text')
      .attr('font-size', '10px')
      .attr('fill', '#666')
      .attr('text-anchor', 'middle')
      .attr('dy', -5)
      .text((d: any) => d.label || '')

    // Draw nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(d3Nodes)
      .enter()
      .append('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<SVGGElement, any>()
        .on('start', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d: any) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        }) as any)

    // Node background (for glow effect on hover)
    node.append('rect')
      .attr('class', 'node-bg')
      .attr('rx', 8)
      .attr('ry', 8)
      .attr('fill', (d: any) => {
        const colors = categoryColors[d.category] || categoryColors.default
        return colors.bg
      })
      .attr('stroke', (d: any) => {
        const colors = categoryColors[d.category] || categoryColors.default
        return colors.border
      })
      .attr('stroke-width', 2)
      .attr('filter', 'none')

    // Node text
    node.append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', (d: any) => {
        const colors = categoryColors[d.category] || categoryColors.default
        return colors.text
      })
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('font-family', 'Montserrat, sans-serif')
      .each(function(d: any) {
        const text = d3.select(this)
        const words = d.label.split(/\s+/)
        const lineHeight = 14
        
        // Wrap text to max 3 lines
        let line: string[] = []
        let lineNumber = 0
	        words.forEach((word: string) => {
	          line.push(word)
	          const testLine = line.join(' ')
	          if (testLine.length > 15 && line.length > 1) {
            line.pop()
            text.append('tspan')
              .attr('x', 0)
              .attr('dy', lineNumber === 0 ? 0 : lineHeight)
              .text(line.join(' '))
            line = [word]
            lineNumber++
          }
        })
        
        if (line.length > 0 && lineNumber < 3) {
          text.append('tspan')
            .attr('x', 0)
            .attr('dy', lineNumber === 0 ? 0 : lineHeight)
            .text(line.join(' '))
        }
      })

    // Calculate and set node sizes based on text
	    node.each(function() {
	      const textElement = d3.select(this).select('text')
	      const bbox = (textElement.node() as SVGTextElement)?.getBBox()
	      const padding = 16
	      const width = Math.max((bbox?.width || 80) + padding * 2, 100)
      const height = Math.max((bbox?.height || 20) + padding, 40)
      
      d3.select(this).select('rect')
        .attr('width', width)
        .attr('height', height)
        .attr('x', -width / 2)
        .attr('y', -height / 2)
      
      // Center text vertically
      const tspans = textElement.selectAll('tspan')
      const numLines = tspans.size() || 1
      const totalHeight = numLines * 14
      textElement.attr('transform', `translate(0, ${-totalHeight / 2 + 7})`)
    })

	    // Hover effects
	    node
	      .on('mouseover', function(_event, d: any) {
	        d3.select(this).select('rect')
	          .attr('filter', 'url(#glow)')
	          .transition()
	          .duration(200)
          .attr('transform', 'scale(1.05)')
        
        setSelectedNode(d)
      })
      .on('mouseout', function() {
        d3.select(this).select('rect')
          .attr('filter', 'none')
          .transition()
          .duration(200)
          .attr('transform', 'scale(1)')
      })
      .on('click', function(event, d: any) {
        setSelectedNode(d)
        event.stopPropagation()
      })

    // Click on background to deselect
    svg.on('click', () => setSelectedNode(null))

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      linkLabel
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => (d.source.y + d.target.y) / 2)

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    // Initial fit
    setTimeout(() => {
      handleZoom('fit')
    }, 500)

    return () => {
      simulation.stop()
    }
  }, [nodes, edges, dimensions, handleZoom])

  if (!nodes.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <p className="text-gray-500">No concept map data available.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Graph Container */}
      <div 
        ref={containerRef}
        className="relative bg-gradient-to-br from-white to-gray-50 border-2 border-[#3DD6D0]/30 rounded-2xl overflow-hidden shadow-lg"
      >
        {/* Zoom Controls */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <button
            onClick={() => handleZoom('in')}
            className="p-2 bg-white/90 hover:bg-white rounded-lg shadow-md border border-gray-200 text-[#344895] transition-all hover:scale-105"
            title="Zoom In"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleZoom('out')}
            className="p-2 bg-white/90 hover:bg-white rounded-lg shadow-md border border-gray-200 text-[#344895] transition-all hover:scale-105"
            title="Zoom Out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleZoom('fit')}
            className="p-2 bg-white/90 hover:bg-white rounded-lg shadow-md border border-gray-200 text-[#344895] transition-all hover:scale-105"
            title="Fit to View"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleZoom('reset')}
            className="p-2 bg-white/90 hover:bg-white rounded-lg shadow-md border border-gray-200 text-[#344895] transition-all hover:scale-105"
            title="Reset View"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions */}
        <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-gray-600 shadow-sm border border-gray-200">
          <span className="hidden sm:inline">🖱️ Drag nodes • Scroll to zoom • Click node for details</span>
          <span className="sm:hidden">👆 Drag • Pinch to zoom</span>
        </div>

        {/* SVG Canvas */}
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="w-full touch-none"
          style={{ minHeight: '400px' }}
        />
      </div>

      {/* Selected Node Details */}
      {selectedNode && (
        <div className="bg-gradient-to-r from-[#344895]/5 to-[#3DD6D0]/5 border border-[#3DD6D0]/30 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-start gap-3">
            <div 
              className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
              style={{ backgroundColor: (categoryColors[selectedNode.category || 'default'] || categoryColors.default).bg }}
            />
            <div>
              <h4 className="font-montserrat font-bold text-[#344895] text-lg">
                {selectedNode.label}
              </h4>
              {selectedNode.description && (
                <p className="text-gray-600 text-sm mt-1 font-lato">
                  {selectedNode.description}
                </p>
              )}
              {selectedNode.category && (
                <span 
                  className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ 
                    backgroundColor: `${(categoryColors[selectedNode.category] || categoryColors.default).bg}20`,
                    color: (categoryColors[selectedNode.category] || categoryColors.default).bg
                  }}
                >
                  {selectedNode.category.charAt(0).toUpperCase() + selectedNode.category.slice(1)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-2 justify-center">
        {Object.entries(categoryColors)
          .filter(([key]) => key !== 'default' && nodes.some(n => n.category === key))
          .map(([key, colors]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium"
              style={{ backgroundColor: `${colors.bg}15`, color: colors.bg }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.bg }} />
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </span>
          ))}
      </div>
    </div>
  )
}
