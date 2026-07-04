import type { OmnipathInteraction } from './api';

export type SimState = Record<string, boolean>;

export class BooleanNetwork {
  nodes: string[];
  edges: [string, string][];
  edgeWeights: Map<string, number>;
  state: SimState;
  knockouts: Set<string>;
  directedEdges: { source: string, target: string, weight: number }[];

  constructor(nodes: string[], edges: [string, string][], omnipathInteractions?: OmnipathInteraction[]) {
    this.nodes = nodes;
    this.edges = edges;
    this.edgeWeights = new Map();
    this.state = {};
    this.knockouts = new Set();
    this.directedEdges = [];

    if (omnipathInteractions && omnipathInteractions.length > 0) {
      omnipathInteractions.forEach(interaction => {
        let weight = 0;
        if (interaction.is_stimulation && !interaction.is_inhibition) weight = 1;
        else if (interaction.is_inhibition && !interaction.is_stimulation) weight = -1;
        else if (interaction.is_stimulation && interaction.is_inhibition) weight = 1; // Default to activation if both
        else weight = 1; // Fallback
        
        this.directedEdges.push({
          source: interaction.source,
          target: interaction.target,
          weight
        });
        this.edgeWeights.set(`${interaction.source}-${interaction.target}`, weight);
      });
    } else {
      // Fallback to random undirected edges if no Omnipath data
      edges.forEach(([u, v]) => {
        const weight = Math.random() > 0.2 ? 1 : -1;
        this.directedEdges.push({ source: u, target: v, weight });
        this.directedEdges.push({ source: v, target: u, weight });
        this.edgeWeights.set(`${u}-${v}`, weight);
        this.edgeWeights.set(`${v}-${u}`, weight);
      });
    }

    // Initialize states to random
    nodes.forEach(n => {
      this.state[n] = Math.random() > 0.5;
    });
  }

  tick(): SimState {
    const nextState: SimState = {};
    
    this.nodes.forEach(n => {
      if (this.knockouts.has(n)) {
        nextState[n] = false;
        return;
      }

      let activation = 0;
      
      this.directedEdges.forEach(edge => {
        if (edge.target === n) {
          if (this.state[edge.source]) {
            activation += edge.weight;
          }
        }
      });

      // Threshold function
      if (activation > 0) {
        nextState[n] = true;
      } else if (activation < 0) {
        nextState[n] = false;
      } else {
        nextState[n] = this.state[n]; // Keep current state if 0
      }
    });

    this.state = nextState;
    return { ...this.state };
  }


  setState(node: string, value: boolean) {
    if (!this.knockouts.has(node)) {
      this.state[node] = value;
    }
  }

  toggleKnockout(node: string) {
    if (this.knockouts.has(node)) {
      this.knockouts.delete(node);
    } else {
      this.knockouts.add(node);
      this.state[node] = false;
    }
  }
}
