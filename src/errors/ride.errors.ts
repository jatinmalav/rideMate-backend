export class RideError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "RideError";
    this.statusCode = statusCode;
  }
}

export class RideNotFoundError extends RideError {
  constructor(message = "Ride not found") {
    super(message, 404);
    this.name = "RideNotFoundError";
  }
}

export class RideForbiddenError extends RideError {
  constructor(message = "You are not allowed to modify this ride") {
    super(message, 403);
    this.name = "RideForbiddenError";
  }
}

export class InvalidRideInputError extends RideError {
  constructor(message: string) {
    super(message, 400);
    this.name = "InvalidRideInputError";
  }
}