export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    isOperational: boolean = true,
    details?: unknown
  ) {
    super(message);

    // Rend instanceof fiable
    Object.setPrototypeOf(this, new.target.prototype);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;


    // Stack propre (optionnel)
    Error.captureStackTrace?.(this, this.constructor);
  }
}

// Not found error
export class NotFoundError extends AppError {
  constructor(message = "Resources not found") {
    super(message, 404, true);
  }
}

// Validation Error (use for Joi/zod/react-hook-form validation errors)
export class ValidationError extends AppError {
  constructor(message = "Invalid request data", details?: unknown) {
    super(message, 400, true, details);
  }
}

// Authentication error
export class AuthError extends AppError {
  constructor(message = "Unauthorized"){
    super(message, 401, true);
  }
}


// Forbidden Error (For Insufficient Permissions)
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden access") {
    super(message, 403, true);
  }
}

// Database Error (For MongoDB/Postgres Errors)
export class DatabaseError extends AppError {
  constructor(message = "Database error", details?: unknown) {
    super(message, 500, true, details);
  }
}

// rate Limit Error (If user exceeds API limits)
export class RateLimitError extends AppError {
  constructor(message = "Too many requests, please try again later") {
    super(message, 429, true);
  }
}

// “email déjà pris”, “booking déjà confirmé”, etc
export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409);
  }
}
