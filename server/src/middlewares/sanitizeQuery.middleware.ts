import { Request, Response, NextFunction } from 'express';

/** Strip keys Mongo would read as operators, in place, since `req.query` has no setter to replace. */
function stripOperators(value: unknown, depth = 0): void {
  if (depth > 6 || value === null || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    value.forEach((item) => stripOperators(item, depth + 1));
    return;
  }

  const container = value as Record<string, unknown>;
  for (const key of Object.keys(container)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete container[key];
      continue;
    }
    const child = container[key];
    if (child === null || typeof child !== 'object') continue;
    stripOperators(child, depth + 1);
    // What is left of `?category[$ne]=x` is an empty object, which Mongo rejects as a cast error.
    if (!Array.isArray(child) && Object.keys(child as object).length === 0) delete container[key];
  }
}

/** Express parses `?category[$ne]=x` into a nested object, so operator keys are dropped before any handler can pass one to Mongo. */
export function sanitizeMongoInput(req: Request, _res: Response, next: NextFunction): void {
  stripOperators(req.query);
  stripOperators(req.body);
  stripOperators(req.params);
  next();
}
