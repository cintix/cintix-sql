export type DatabaseType = 'sqlserver' | 'mysql' | 'postgresql';

export interface ConnectionProfile {
  id: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  executionTime: number;
  affectedRows?: number;
}

export interface QueryTab {
  id: string;
  title: string;
  query: string;
  profileId?: string;
  results?: QueryResult;
  isExecuting: boolean;
  error?: string;
  editTable?: { schema: string; table: string };
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export const DEFAULT_PORTS: Record<DatabaseType, number> = {
  sqlserver: 1433,
  mysql: 3306,
  postgresql: 5432,
};

export const DB_LABELS: Record<DatabaseType, string> = {
  sqlserver: 'SQL Server',
  mysql: 'MySQL',
  postgresql: 'PostgreSQL',
};
