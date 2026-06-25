import cytoscape from "cytoscape";
import type { ContextGraphMemorySettings } from "../types";
import {
  graphResultToCytoscapeElements,
  type CytoscapeNodeData,
} from "./cytoscape-adapter";
import type { GraphResult } from "./graph-scope";

export interface CytoscapeRendererOptions {
  layout: ContextGraphMemorySettings["graphLayout"];
  fitOnOpen: boolean;
  onNodeSelect?: (node: CytoscapeNodeData) => void;
  onRenderFallback?: (reason: string) => void;
}

export class CytoscapeRenderer {
  private cy: cytoscape.Core | null = null;

  constructor(
    private readonly containerEl: HTMLElement,
    private readonly options: CytoscapeRendererOptions,
  ) {}

  render(result: GraphResult): void {
    this.destroy();
    this.containerEl.empty();

    try {
      this.cy = cytoscape({
        container: this.containerEl,
        elements: graphResultToCytoscapeElements(result),
        layout: toLayoutOptions(this.options.layout),
        style: GRAPH_STYLE,
        maxZoom: 3,
        minZoom: 0.15,
        wheelSensitivity: 0.18,
      });

      this.cy.on("tap", "node", (event) => {
        this.options.onNodeSelect?.(event.target.data() as CytoscapeNodeData);
      });

      this.cy.ready(() => {
        this.cy?.resize();

        if (this.options.fitOnOpen) {
          this.fit();
        }
      });
    } catch (error) {
      this.destroy();
      this.options.onRenderFallback?.(error instanceof Error ? error.message : String(error));
    }
  }

  fit(): void {
    this.cy?.fit(undefined, 24);
  }

  resetView(): void {
    this.cy?.reset();
  }

  destroy(): void {
    if (!this.cy) {
      return;
    }

    this.cy.destroy();
    this.cy = null;
  }
}

function toLayoutOptions(layout: ContextGraphMemorySettings["graphLayout"]): cytoscape.LayoutOptions {
  if (layout === "cose") {
    return {
      name: "cose",
      animate: false,
      fit: false,
      padding: 24,
      nodeRepulsion: 18000,
      idealEdgeLength: 155,
      edgeElasticity: 70,
      nestingFactor: 1.1,
      gravity: 0.045,
      numIter: 2500,
      initialTemp: 120,
      coolingFactor: 0.95,
    } as cytoscape.LayoutOptions;
  }

  return {
    name: layout,
    animate: false,
    fit: false,
    padding: 24,
  } as cytoscape.LayoutOptions;
}

const GRAPH_STYLE: cytoscape.StylesheetJson = [
  {
    selector: "node",
    style: {
      "background-color": "#6f8fbd",
      "border-color": "#f8fafc",
      "border-width": 1.2,
      color: "#20242a",
      "font-size": 7.5,
      height: 16,
      label: "data(label)",
      "min-zoomed-font-size": 7,
      "overlay-padding": 5,
      shape: "ellipse",
      "text-background-color": "#ffffff",
      "text-background-opacity": 0.78,
      "text-background-padding": "2px",
      "text-margin-y": 8,
      "text-max-width": "84px",
      "text-outline-color": "#ffffff",
      "text-outline-opacity": 0.55,
      "text-outline-width": 1,
      "text-valign": "bottom",
      "text-wrap": "wrap",
      width: 16,
    },
  },
  {
    selector: ".kind-note",
    style: {
      "background-color": "#5f7fa8",
    },
  },
  {
    selector: ".scope-external-bridge",
    style: {
      "background-color": "#b98b48",
      "border-color": "#6d542e",
      "border-style": "dashed",
      "border-width": 2,
      shape: "ellipse",
    },
  },
  {
    selector: ".folder-isolated",
    style: {
      "background-color": "#a8adb5",
      "border-color": "#6f7782",
      "border-width": 2,
    },
  },
  {
    selector: ".kind-tag",
    style: {
      "background-color": "#8aa96e",
      shape: "ellipse",
    },
  },
  {
    selector: ".kind-concept",
    style: {
      "background-color": "#b98b48",
    },
  },
  {
    selector: ".kind-person, .kind-organization, .kind-system, .kind-project",
    style: {
      "background-color": "#b07aa1",
      shape: "hexagon",
    },
  },
  {
    selector: "edge",
    style: {
      "curve-style": "bezier",
      "font-size": 8,
      label: "data(displayLabel)",
      "line-color": "#a8b0ba",
      opacity: 0.72,
      "target-arrow-color": "#a8b0ba",
      "target-arrow-shape": "triangle",
      "text-background-color": "#ffffff",
      "text-background-opacity": 0.7,
      "text-background-padding": "2px",
      "text-rotation": "autorotate",
      width: 1,
    },
  },
  {
    selector: ".relation-has_tag",
    style: {
      "line-color": "#8aa96e",
      "target-arrow-color": "#8aa96e",
    },
  },
  {
    selector: ".relation-links_to",
    style: {
      "line-color": "#8f9baa",
      "target-arrow-color": "#8f9baa",
      "target-arrow-shape": "none",
      width: 0.9,
    },
  },
  {
    selector: ".relation-depends_on, .relation-supports, .relation-affects",
    style: {
      "line-color": "#c66a6d",
      "target-arrow-color": "#c66a6d",
    },
  },
  {
    selector: ".relation-mentions, .relation-related_to, .relation-part_of, .relation-evidenced_by",
    style: {
      "line-color": "#9a7aa1",
      "target-arrow-color": "#9a7aa1",
    },
  },
  {
    selector: ":selected",
    style: {
      "border-color": "#d14b4b",
      "border-width": 3,
      "line-color": "#d14b4b",
      "target-arrow-color": "#d14b4b",
    },
  },
];
