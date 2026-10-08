import type { OmnipathInteraction } from './api';

export type SimState = Record<string, boolean>;

export class BooleanNetwork {
  nodes: string[];
  edges: [string, string][];
  edgeWeights: Map<string, number>;
  state: SimState;
  knockouts: Set<string>;
  directedEdges: { source: string, target: string, weight: number }[];
  history: Map<string, boolean[]>;
  tickCount: number;
  static readonly WINDOW_SIZE = 50;

  constructor(nodes: string[], edges: [string, string][], omnipathInteractions?: OmnipathInteraction[]) {
    this.nodes = nodes;
    this.edges = edges;
    this.edgeWeights = new Map();
    this.state = {};
    this.knockouts = new Set();
    this.directedEdges = [];
    this.history = new Map();
    this.tickCount = 0;

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
      const initial = Math.random() > 0.5;
      this.state[n] = initial;
      this.history.set(n, [initial]);
    });
  }

  tick(): SimState {
    const nextState: SimState = {};
    this.tickCount++;
    
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

    // Record in rolling 50-tick history window
    this.nodes.forEach(n => {
      const h = this.history.get(n) || [];
      h.push(Boolean(nextState[n]));
      if (h.length > BooleanNetwork.WINDOW_SIZE) {
        h.shift();
      }
      this.history.set(n, h);
    });

    return { ...this.state };
  }

  getActivationFrequencies(): Record<string, number> {
    const freqs: Record<string, number> = {};
    this.nodes.forEach(n => {
      const h = this.history.get(n) || [];
      if (h.length === 0) {
        freqs[n] = 0;
      } else {
        const onCount = h.reduce((acc, val) => acc + (val ? 1 : 0), 0);
        freqs[n] = onCount / h.length;
      }
    });
    return freqs;
  }

  getNodeFrequency(node: string): { frequency: number; onTicks: number; totalTicks: number } {
    const h = this.history.get(node) || [];
    const onTicks = h.reduce((acc, val) => acc + (val ? 1 : 0), 0);
    return {
      frequency: h.length > 0 ? onTicks / h.length : 0,
      onTicks,
      totalTicks: h.length
    };
  }

  resetHistory() {
    this.tickCount = 0;
    this.history.clear();
    this.nodes.forEach(n => {
      this.history.set(n, [this.state[n]]);
    });
  }

  setState(node: string, value: boolean) {
    if (!this.knockouts.has(node)) {
      this.state[node] = value;
      const h = this.history.get(node);
      if (h && h.length > 0) {
        h[h.length - 1] = value;
      }
    }
  }

  toggleKnockout(node: string) {
    if (this.knockouts.has(node)) {
      this.knockouts.delete(node);
    } else {
      this.knockouts.add(node);
      this.state[node] = false;
      const h = this.history.get(node);
      if (h && h.length > 0) {
        h[h.length - 1] = false;
      }
    }
  }
}
