/**
 * Training Path definitions for the Gallery.
 *
 * A training path is a structured learning journey composed of phases,
 * each phase containing one or more manuals linked to gallery samples.
 */

export interface TrainingManual {
  /** Manual filename (without directory). */
  title: string;
  /** Short description of what the manual covers. */
  description: string;
  difficulty: 'easy' | 'medium' | 'advanced';
  /** Gallery sample ID used in this manual. Undefined if no sample (e.g., audit log). */
  sampleId?: string;
  /** Relative path to the HTML manual file from docs/training-manuals/. */
  manualPath?: string;
}

export interface TrainingPhase {
  id: number;
  name: string;
  manuals: TrainingManual[];
}

export interface TrainingPath {
  id: string;
  name: string;
  icon: string;
  description: string;
  phases: TrainingPhase[];
  /** If true, the path is not yet available (shown as "Coming soon"). */
  comingSoon?: boolean;
}

/** All registered training paths. */
export const trainingPaths: TrainingPath[] = [
  {
    id: 'versioning',
    name: 'Versioning',
    icon: '🔖',
    description: 'Master version control across all 6 entity types — workflows, tests, requests, environments, feature groups, and scripts.',
    phases: [
      {
        id: 1,
        name: 'Workflow Versioning',
        manuals: [
          {
            title: 'Workflow Version History',
            description: 'Create, browse, rename, and restore workflow version snapshots',
            difficulty: 'easy',
            sampleId: 'sample-workflow-001',
            manualPath: 'versioning/workflow/workflow-version-history-easy.html',
          },
          {
            title: 'Workflow Version Diff',
            description: '4-tab diff modal — Nodes, Edges, Variables, Services comparison',
            difficulty: 'medium',
            sampleId: 'sample-workflow-webhook',
            manualPath: 'versioning/workflow/workflow-version-diff-medium.html',
          },
          {
            title: 'Workflow Version Advanced',
            description: 'Bulk operations, export/import with history, undo persistence',
            difficulty: 'advanced',
            sampleId: 'sample-workflow-sub-workflow',
            manualPath: 'versioning/workflow/workflow-version-advanced.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Test Definition Versioning',
        manuals: [
          {
            title: 'Test Definition History',
            description: 'Snapshots, 20-version cap, canonical JSON fingerprinting, change summaries',
            difficulty: 'easy',
            sampleId: 'test-user-api-smoke',
            manualPath: 'versioning/test/test-definition-history-easy.html',
          },
          {
            title: 'Test Definition Diff',
            description: '5-tab diff — Overview, Headers, Body, Auth, Extractions with tab badges',
            difficulty: 'medium',
            sampleId: 'test-ecommerce-full',
            manualPath: 'versioning/test/test-definition-diff-medium.html',
          },
        ],
      },
      {
        id: 3,
        name: 'Environment Audit Log',
        manuals: [
          {
            title: 'Environment Audit Log',
            description: 'Browse audit entries, filtering, field-level change tracking',
            difficulty: 'easy',
            manualPath: 'versioning/catalog/environment-audit-log-easy.html',
          },
          {
            title: 'Audit Export',
            description: 'JSON/CSV export, 500-entry rotation management',
            difficulty: 'medium',
            manualPath: 'versioning/catalog/environment-audit-export-medium.html',
          },
        ],
      },
      {
        id: 4,
        name: 'Run Baselines',
        manuals: [
          {
            title: 'Run Baselines',
            description: 'Mark test runs as baselines for performance comparison',
            difficulty: 'easy',
            sampleId: 'test-product-listing',
            manualPath: 'versioning/test/run-baselines-easy.html',
          },
          {
            title: 'Baseline Comparison',
            description: 'Trend charts, regression detection via MetricDelta',
            difficulty: 'medium',
            sampleId: 'test-auth-flow',
            manualPath: 'versioning/test/run-baselines-comparison-medium.html',
          },
        ],
      },
      {
        id: 5,
        name: 'Request Definition Versioning',
        manuals: [
          {
            title: 'Request Definition History',
            description: 'Request versioning basics using Get All Users',
            difficulty: 'easy',
            sampleId: 'req-get-all-users',
            manualPath: 'versioning/request/request-definition-history-easy.html',
          },
          {
            title: 'Request Definition Diff',
            description: '4-tab diff (Overview/Headers/Body/Auth) for requests',
            difficulty: 'medium',
            sampleId: 'req-create-post',
            manualPath: 'versioning/request/request-definition-diff-medium.html',
          },
        ],
      },
      {
        id: 6,
        name: 'Feature Group Structure',
        manuals: [
          {
            title: 'Feature Group History',
            description: 'Per-feature-group changelog and structure tracking',
            difficulty: 'easy',
            sampleId: 'test-user-api-smoke',
            manualPath: 'versioning/catalog/feature-group-history-easy.html',
          },
          {
            title: 'Feature Group Comparison',
            description: 'Structure comparison and restore operations',
            difficulty: 'medium',
            sampleId: 'test-country-search',
            manualPath: 'versioning/catalog/feature-group-history-medium.html',
          },
        ],
      },
      {
        id: 7,
        name: 'Script Library Versioning',
        manuals: [
          {
            title: 'Script Library Versioning',
            description: 'Script snapshots, restore, and version management',
            difficulty: 'easy',
            manualPath: 'versioning/advanced/script-library-versioning-easy.html',
          },
          {
            title: 'Script Impact Analysis',
            description: 'Which workflows use this script? Impact analysis across entities',
            difficulty: 'medium',
            manualPath: 'versioning/advanced/script-library-impact-medium.html',
          },
        ],
      },
    ],
  },
  {
    id: 'workflow-patterns',
    name: 'Workflow Patterns',
    icon: '⚡',
    description: 'Learn conditional branching, parallel execution, error handling, loops, and sub-workflow composition patterns.',
    comingSoon: true,
    phases: [],
  },
  {
    id: 'auth-strategies',
    name: 'Auth Strategies',
    icon: '🔐',
    description: 'API Key, Bearer Token, OAuth2, Basic Auth, and chained auth flows across tests and workflows.',
    comingSoon: true,
    phases: [],
  },
  {
    id: 'assertion-mastery',
    name: 'Assertion Mastery',
    icon: '✅',
    description: 'From simple status checks to structured JSON assertions, regex patterns, and custom validation scripts.',
    comingSoon: true,
    phases: [],
  },
];
