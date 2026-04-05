import type pg from 'pg';

export type Queryable = Pick<pg.Pool, 'query'>;
