import { Request, Response, NextFunction } from "express";

interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const statusCode = err.statusCode || 500;
  const message = err.statusCode ? err.message : "Internal Server Error";

  if (statusCode === 500) {
    console.error(`Unhandled error on ${req.path}:`, err);
  }

  res.status(statusCode).json({ error: message });
}