export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 401) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class UserNotFoundError extends AuthError {
  constructor() {
    super("Invalid credentials", 401);
  }
}

export class InvalidPasswordError extends AuthError {
  constructor() {
    super("Invalid credentials", 401);
  }
}

export class UserAlreadyExistsError extends AuthError {
  constructor() {
    super("User already exists", 409);
  }
}