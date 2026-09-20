/**
 * Bringing a diagram onto a canvas board.
 *
 * The diagram library keeps shapes and connectors in two lists; a board keeps
 * one ordered list of elements. The translation is mechanical and lossless,
 * and it is what lets the templates and every file the old diagram editor
 * saved open here unchanged — ids included, so the connectors still resolve.
 */
import type { Connector, Diagram, Shape } from "@/lib/diagram/model";
import {
  emptyBoard,
  type Board,
  type EdgeEl,
  type Element,
  type NodeEl,
} from "./model";

export function nodeFromShape(shape: Shape): NodeEl {
  return {
    id: shape.id,
    type: "node",
    kind: shape.kind,
    x: shape.x,
    y: shape.y,
    w: shape.w,
    h: shape.h,
    text: shape.text,
    fill: shape.fill,
    stroke: shape.stroke,
    strokeWidth: shape.strokeWidth,
    dash: "solid",
    fontSize: shape.fontSize,
    textColor: shape.textColor,
    bold: shape.bold,
  };
}

export function edgeFromConnector(connector: Connector): EdgeEl {
  return {
    id: connector.id,
    type: "edge",
    from: connector.from,
    to: connector.to,
    fromPort: connector.fromPort,
    toPort: connector.toPort,
    label: connector.label,
    stroke: connector.stroke,
    strokeWidth: connector.strokeWidth,
    dash: connector.style,
    routing: connector.routing,
    startArrow: connector.startArrow,
    endArrow: connector.endArrow,
  };
}

export function elementsFromDiagram(diagram: Diagram): Element[] {
  return [...diagram.shapes.map(nodeFromShape), ...diagram.connectors.map(edgeFromConnector)];
}

export function boardFromDiagram(diagram: Diagram, name = diagram.name): Board {
  return {
    ...emptyBoard(name),
    // A diagram's background is a flat colour; the ruling is a canvas idea.
    paperColor: diagram.background,
    grid: diagram.grid,
    elements: elementsFromDiagram(diagram),
  };
}
