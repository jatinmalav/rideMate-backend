export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
  }
}

export class UserNotFoundError extends AuthError {
  constructor() {
    super("Invalid credentials", 401);
    this.name = "UserNotFoundError";
  }
}

export class InvalidPasswordError extends AuthError {
  constructor() {
    super("Invalid credentials", 401);
    this.name = "InvalidPasswordError";
  }
}

export class UserAlreadyExistsError extends AuthError {
  constructor() {
    super("User already exists", 409);
    this.name = "UserAlreadyExistsError";
  }
}