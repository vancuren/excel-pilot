import { AgentMemory, AgentEvent, EventFilter, QueryPattern } from './types';

interface VectorEmbedding {
  id: string;
  vector: number[];
  metadata: any;
  timestamp: Date;
}

interface KnowledgeTriple {
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  timestamp: Date;
}

export class InMemoryAgentMemory implements AgentMemory {
  shortTerm: Map<string, any>;
  longTerm: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any, ttl?: number) => Promise<void>;
    search: (query: string, limit?: number) => Promise<any[]>;
  };
  episodic: {
    store: (event: AgentEvent) => Promise<void>;
    recall: (filter: EventFilter) => Promise<AgentEvent[]>;
  };
  semantic: {
    addRelation: (subject: string, predicate: string, object: string) => Promise<void>;
    query: (pattern: QueryPattern) => Promise<any[]>;
  };

  private longTermStorage: Map<string, { value: any; expiry?: number }>;
  private episodicStorage: AgentEvent[];
  private semanticStorage: KnowledgeTriple[];
  private vectorStorage: VectorEmbedding[];
  private patternCache: Map<string, any>;

  constructor() {
    // Initialize short-term memory
    this.shortTerm = new Map();

    // Initialize storage
    this.longTermStorage = new Map();
    this.episodicStorage = [];
    this.semanticStorage = [];
    this.vectorStorage = [];
    this.patternCache = new Map();

    // Setup long-term memory interface
    this.longTerm = {
      get: async (key: string) => {
        const entry = this.longTermStorage.get(key);
        if (!entry) return null;

        // Check expiry
        if (entry.expiry && entry.expiry < Date.now()) {
          this.longTermStorage.delete(key);
          return null;
        }

        return entry.value;
      },

      set: async (key: string, value: any, ttl?: number) => {
        const expiry = ttl ? Date.now() + ttl : undefined;
        this.longTermStorage.set(key, { value, expiry });
      },

      search: async (query: string, limit: number = 10) => {
        // Simple text-based search (in production, use vector similarity)
        const results: any[] = [];
        const queryLower = query.toLowerCase();

        for (const [key, entry] of this.longTermStorage) {
          // Check expiry
          if (entry.expiry && entry.expiry < Date.now()) {
            this.longTermStorage.delete(key);
            continue;
          }

          // Simple matching
          if (key.toLowerCase().includes(queryLower) ||
              JSON.stringify(entry.value).toLowerCase().includes(queryLower)) {
            results.push({
              key,
              value: entry.value,
              relevance: this.calculateRelevance(query, key, entry.value)
            });
          }

          if (results.length >= limit) break;
        }

        // Sort by relevance
        results.sort((a, b) => b.relevance - a.relevance);
        return results.slice(0, limit).map(r => r.value);
      }
    };

    // Setup episodic memory interface
    this.episodic = {
      store: async (event: AgentEvent) => {
        this.episodicStorage.push(event);
        
        // Keep only last 1000 events
        if (this.episodicStorage.length > 1000) {
          this.episodicStorage.shift();
        }

        // Update pattern cache if relevant
        await this.updatePatternCache(event);
      },

      recall: async (filter: EventFilter) => {
        let events = [...this.episodicStorage];

        if (filter.agentId) {
          events = events.filter(e => e.agentId === filter.agentId);
        }
        
        if (filter.type) {
          events = events.filter(e => e.type === filter.type);
        }
        
        if (filter.startDate) {
          events = events.filter(e => e.timestamp >= filter.startDate);
        }
        
        if (filter.endDate) {
          events = events.filter(e => e.timestamp <= filter.endDate);
        }
        
        if (filter.outcome) {
          events = events.filter(e => e.outcome === filter.outcome);
        }

        // Sort by timestamp descending
        events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        return events;
      }
    };

    // Setup semantic memory interface
    this.semantic = {
      addRelation: async (subject: string, predicate: string, object: string) => {
        const existing = this.semanticStorage.find(
          t => t.subject === subject && t.predicate === predicate && t.object === object
        );

        if (existing) {
          // Update confidence
          existing.confidence = Math.min(1, existing.confidence + 0.1);
          existing.timestamp = new Date();
        } else {
          this.semanticStorage.push({
            subject,
            predicate,
            object,
            confidence: 0.5,
            timestamp: new Date()
          });
        }

        // Update related patterns
        await this.updateRelatedPatterns(subject, predicate, object);
      },

      query: async (pattern: QueryPattern) => {
        let results = [...this.semanticStorage];

        if (pattern.subject) {
          results = results.filter(t => t.subject === pattern.subject);
        }
        
        if (pattern.predicate) {
          results = results.filter(t => t.predicate === pattern.predicate);
        }
        
        if (pattern.object) {
          results = results.filter(t => t.object === pattern.object);
        }

        // Sort by confidence descending
        results.sort((a, b) => b.confidence - a.confidence);

        return results;
      }
    };

    // Start cleanup timer
    this.startCleanupTimer();
  }

  private calculateRelevance(query: string, key: string, value: any): number {
    // Simple relevance scoring
    let score = 0;
    const queryWords = query.toLowerCase().split(/\s+/);
    const keyWords = key.toLowerCase().split(/\s+/);
    const valueStr = JSON.stringify(value).toLowerCase();

    for (const word of queryWords) {
      if (keyWords.includes(word)) score += 2;
      if (valueStr.includes(word)) score += 1;
    }

    return score;
  }

  private async updatePatternCache(event: AgentEvent): Promise<void> {
    if (event.type === 'task_execution' && event.outcome === 'success') {
      const pattern = this.extractPattern(event);
      if (pattern) {
        const patternKey = `pattern_${pattern.type}`;
        const existing = this.patternCache.get(patternKey) || [];
        existing.push(pattern);
        
        // Keep only last 100 patterns of each type
        if (existing.length > 100) {
          existing.shift();
        }
        
        this.patternCache.set(patternKey, existing);
      }
    }
  }

  private extractPattern(event: AgentEvent): any {
    if (!event.data) return null;

    const { task, result } = event.data;
    if (!task || !result) return null;

    return {
      type: task.type,
      toolsUsed: result.toolsUsed,
      executionTime: result.executionTime,
      confidence: result.confidence || 0.5,
      timestamp: event.timestamp
    };
  }

  private async updateRelatedPatterns(subject: string, predicate: string, object: string): Promise<void> {
    // Find related patterns
    const relatedPatterns = await this.findRelatedPatterns(subject);
    
    for (const pattern of relatedPatterns) {
      // Strengthen pattern confidence
      pattern.confidence = Math.min(1, pattern.confidence + 0.05);
      
      // Store updated pattern
      const key = `pattern_${subject}_${predicate}`;
      await this.longTerm.set(key, pattern, 86400000); // 24 hours
    }
  }

  private async findRelatedPatterns(subject: string): Promise<any[]> {
    const patterns: any[] = [];
    
    // Search in pattern cache
    for (const [key, value] of this.patternCache) {
      if (key.includes(subject)) {
        patterns.push(...(Array.isArray(value) ? value : [value]));
      }
    }

    // Search in semantic storage
    const semanticPatterns = await this.semantic.query({ subject });
    for (const triple of semanticPatterns) {
      patterns.push({
        type: 'semantic',
        relation: triple.predicate,
        target: triple.object,
        confidence: triple.confidence
      });
    }

    return patterns;
  }

  private startCleanupTimer(): void {
    // Clean up expired entries every hour
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 3600000);
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    
    // Clean long-term storage
    for (const [key, entry] of this.longTermStorage) {
      if (entry.expiry && entry.expiry < now) {
        this.longTermStorage.delete(key);
      }
    }

    // Clean old episodic memories (keep last 30 days)
    const thirtyDaysAgo = new Date(now - 30 * 86400000);
    this.episodicStorage = this.episodicStorage.filter(
      e => e.timestamp > thirtyDaysAgo
    );

    // Clean low-confidence semantic relations
    this.semanticStorage = this.semanticStorage.filter(
      t => t.confidence > 0.2 || t.timestamp > thirtyDaysAgo
    );
  }

  // Additional learning methods
  async learnFromSuccess(taskType: string, approach: any): Promise<void> {
    // Store successful approach
    const key = `success_${taskType}_${Date.now()}`;
    await this.longTerm.set(key, approach, 604800000); // 7 days

    // Update semantic knowledge
    await this.semantic.addRelation(taskType, 'solved_by', JSON.stringify(approach));
    
    // Update pattern confidence
    const patterns = this.patternCache.get(`pattern_${taskType}`) || [];
    for (const pattern of patterns) {
      if (JSON.stringify(pattern.approach) === JSON.stringify(approach)) {
        pattern.confidence = Math.min(1, pattern.confidence + 0.1);
      }
    }
  }

  async learnFromFailure(taskType: string, approach: any, error: Error): Promise<void> {
    // Store failed approach
    const key = `failure_${taskType}_${Date.now()}`;
    await this.longTerm.set(key, { approach, error: error.message }, 604800000);

    // Update semantic knowledge
    await this.semantic.addRelation(taskType, 'fails_with', error.message);
    
    // Reduce pattern confidence
    const patterns = this.patternCache.get(`pattern_${taskType}`) || [];
    for (const pattern of patterns) {
      if (JSON.stringify(pattern.approach) === JSON.stringify(approach)) {
        pattern.confidence = Math.max(0, pattern.confidence - 0.2);
      }
    }
  }

  async suggestApproach(taskType: string): Promise<any[]> {
    const suggestions: any[] = [];

    // Get successful patterns
    const patterns = this.patternCache.get(`pattern_${taskType}`) || [];
    const successfulPatterns = patterns
      .filter(p => p.confidence > 0.6)
      .sort((a, b) => b.confidence - a.confidence);

    suggestions.push(...successfulPatterns.slice(0, 3));

    // Get semantic relations
    const relations = await this.semantic.query({ subject: taskType, predicate: 'solved_by' });
    for (const relation of relations.slice(0, 2)) {
      try {
        suggestions.push({
          type: 'semantic',
          approach: JSON.parse(relation.object),
          confidence: relation.confidence
        });
      } catch (e) {
        // Not JSON, treat as string
        suggestions.push({
          type: 'semantic',
          approach: relation.object,
          confidence: relation.confidence
        });
      }
    }

    return suggestions;
  }

  // Statistics and insights
  async getMemoryStats(): Promise<any> {
    return {
      shortTermSize: this.shortTerm.size,
      longTermSize: this.longTermStorage.size,
      episodicEvents: this.episodicStorage.length,
      semanticRelations: this.semanticStorage.length,
      patternTypes: this.patternCache.size,
      oldestEvent: this.episodicStorage[0]?.timestamp,
      newestEvent: this.episodicStorage[this.episodicStorage.length - 1]?.timestamp
    };
  }

  async analyzePatterns(taskType?: string): Promise<any> {
    const analysis: any = {
      patterns: [],
      insights: [],
      recommendations: []
    };

    if (taskType) {
      // Analyze specific task type
      const patterns = this.patternCache.get(`pattern_${taskType}`) || [];
      
      if (patterns.length > 0) {
        const avgExecutionTime = patterns.reduce((sum, p) => sum + p.executionTime, 0) / patterns.length;
        const avgConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
        
        analysis.patterns = patterns;
        analysis.insights.push(`Average execution time: ${avgExecutionTime}ms`);
        analysis.insights.push(`Average confidence: ${(avgConfidence * 100).toFixed(1)}%`);
        
        if (avgConfidence < 0.6) {
          analysis.recommendations.push('Consider reviewing and optimizing this task type');
        }
      }
    } else {
      // General analysis
      for (const [key, patterns] of this.patternCache) {
        if (Array.isArray(patterns) && patterns.length > 5) {
          const avgConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
          analysis.patterns.push({
            type: key.replace('pattern_', ''),
            count: patterns.length,
            avgConfidence
          });
        }
      }
      
      analysis.insights.push(`Tracking ${this.patternCache.size} pattern types`);
      analysis.insights.push(`${this.episodicStorage.length} events in episodic memory`);
    }

    return analysis;
  }
}