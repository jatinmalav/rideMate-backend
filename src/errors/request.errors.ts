export class RequestError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = "RequestError";
    this.statusCode = statusCode;
  }
}

export class RequestNotFoundError extends RequestError {
  constructor(message = "Ride request not found") {
    super(message, 404);
    this.name = "RequestNotFoundError";
  }
}

export class DuplicateRequestError extends RequestError {
  constructor(message = "You have already requested this ride") {
    super(message, 409);
    this.name = "DuplicateRequestError";
  }
}

export class RideFullError extends RequestError {
  constructor(message = "This ride has no available seats") {
    super(message, 409);
    this.name = "RideFullError";
  }
}

export class SelfRequestError extends RequestError {
  constructor(message = "You cannot request your own ride") {
    super(message, 409);
    this.name = "SelfRequestError";
  }
}

export class UnauthorizedRequestError extends RequestError {
  constructor(message = "You are not authorized to perform this action") {
    super(message, 403);
    this.name = "UnauthorizedRequestError";
  }
}

export class RequestStateError extends RequestError {
  constructor(message = "Request is already processed") {
    super(message, 409);
    this.name = "RequestStateError";
  }
}
