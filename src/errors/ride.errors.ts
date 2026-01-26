export class RideNotFoundError extends Error {
  statusCode = 404;

  constructor() {
    super("Ride not found");
  }
}

export class RideForbiddenError extends Error {
  statusCode = 403;

  constructor() {
    super("You are not allowed to modify this ride");
  }
}

export class InvalidRideInputError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
  }
}