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
      "background-color": "#4e79a7",
      "border-color": "#ffffff",
      "border-width": 1,
      color: "#1f2328",
      "font-size": 10,
      height: 34,
      label: "data(label)",
      "min-zoomed-font-size": 8,
      "overlay-padding": 6,
      shape: "round-rectangle",
      "text-background-color": "#ffffff",
      "text-background-opacity": 0.88,
      "text-background-padding": "3px",
      "text-margin-y": -6,
      "text-max-width": "104px",
      "text-valign": "top",
      "text-wrap": "wrap",
      width: 34,
    },
  },
  {
    selector: ".kind-note",
    style: {
      "background-color": "#4e79a7",
    },
  },
  {
    selector: ".scope-external-bridge",
    style: {
      "background-color": "#f28e2b",
      "border-color": "#7f4f24",
      "border-style": "dashed",
      "border-width": 2,
      shape: "diamond",
    },
  },
  {
    selector: ".folder-isolated",
    style: {
      "background-color": "#bab0ac",
      "border-color": "#6b625f",
      "border-width": 2,
    },
  },
  {
    selector: ".kind-tag",
    style: {
      "background-color": "#59a14f",
      shape: "ellipse",
    },
  },
  {
    selector: ".kind-concept",
    style: {
      "background-color": "#f28e2b",
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
      label: "data(label)",
      "line-color": "#8b949e",
      "target-arrow-color": "#8b949e",
      "target-arrow-shape": "triangle",
      "text-background-color": "#ffffff",
      "text-background-opacity": 0.85,
      "text-background-padding": "2px",
      "text-rotation": "autorotate",
      width: 1.4,
    },
  },
  {
    selector: ".relation-has_tag",
    style: {
      "line-color": "#59a14f",
      "target-arrow-color": "#59a14f",
    },
  },
  {
    selector: ".relation-links_to",
    style: {
      "line-color": "#4e79a7",
      "target-arrow-color": "#4e79a7",
    },
  },
  {
    selector: ".relation-depends_on, .relation-supports, .relation-affects",
    style: {
      "line-color": "#e15759",
      "target-arrow-color": "#e15759",
    },
  },
  {
    selector: ".relation-mentions, .relation-related_to, .relation-part_of, .relation-evidenced_by",
    style: {
      "line-color": "#b07aa1",
      "target-arrow-color": "#b07aa1",
    },
  },
  {
    selector: ":selected",
    style: {
      "border-color": "#d62728",
      "border-width": 3,
      "line-color": "#d62728",
      "target-arrow-color": "#d62728",
    },
  },
];
