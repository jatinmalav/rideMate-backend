import { pool } from "../db";
import {
  RequestNotFoundError,
  DuplicateRequestError,
  RideFullError,
  SelfRequestError,
  UnauthorizedRequestError,
  RequestStateError,
} from "../errors/request.errors";

interface CreateRequestParams {
  rideId: string;
  passengerId: string;
}

export async function createRequest({
  rideId,
  passengerId,
}: CreateRequestParams) {
  // 1. Validate Ride Availability
  const rideCheck = await pool.query(
    `SELECT driver_id, available_seats, status FROM rides WHERE id = $1`,
    [rideId],
  );

  if (rideCheck.rows.length === 0) {
    throw new RequestNotFoundError("Ride not found");
  }

  const ride = rideCheck.rows[0];

  if (ride.driver_id === passengerId) {
    throw new SelfRequestError();
  }
  if (ride.available_seats <= 0) {
    throw new RideFullError();
  }

  // 2. Check for Duplicate Request
  const existingRequest = await pool.query(
    `SELECT id FROM ride_requests WHERE ride_id = $1 AND passenger_id = $2`,
    [rideId, passengerId],
  );

  if (existingRequest.rows.length > 0) {
    throw new DuplicateRequestError();
  }

  // 3. Insert Request
  const result = await pool.query(
    `INSERT INTO ride_requests (ride_id, passenger_id, status) 
     VALUES ($1, $2, 'pending') 
     RETURNING *`,
    [rideId, passengerId],
  );

  return result.rows[0];
}




export async function getPassengerRequests(passengerId: string) {
  const query = `
    SELECT 
      req.id, req.status, req.created_at,
      r.id as ride_id, r.source, r.destination, r.ride_time,
      u.name as driver_name
    FROM ride_requests req
    JOIN rides r ON req.ride_id = r.id
    JOIN users u ON r.driver_id = u.id
    WHERE req.passenger_id = $1
    ORDER BY req.created_at DESC
  `;
  const result = await pool.query(query, [passengerId]);
  return result.rows;
}






export async function getRideRequests(rideId: string, driverId: string) {
  // Security: Verify the user is the driver
  const rideCheck = await pool.query(
    `SELECT id FROM rides WHERE id = $1 AND driver_id = $2`,
    [rideId, driverId],
  );

  if (rideCheck.rows.length === 0) {
    throw new UnauthorizedRequestError("Unauthorized or Ride not found");
  }

  const query = `
    SELECT 
      req.id as request_id, 
      req.status, 
      req.created_at,
      u.id as passenger_id, 
      u.name as passenger_name, 
      u.phone_number
    FROM ride_requests req
    JOIN users u ON req.passenger_id = u.id
    WHERE req.ride_id = $1
    ORDER BY 
      CASE WHEN req.status = 'accepted' THEN 1 ELSE 2 END, 
      req.created_at ASC
  `;
  const result = await pool.query(query, [rideId]);
  return result.rows;
}




interface RequestActionParams {
  requestId: string;
  driverId: string;
}

export async function acceptRequest({
  requestId,
  driverId,
}: RequestActionParams) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Fetch Request with Lock
    const reqQuery = `
      SELECT req.ride_id, req.status, r.driver_id, r.available_seats 
      FROM ride_requests req
      JOIN rides r ON req.ride_id = r.id
      WHERE req.id = $1
      FOR UPDATE
    `;
    const reqResult = await client.query(reqQuery, [requestId]);

    if (reqResult.rows.length === 0) {
      throw new RequestNotFoundError();
    }

    const { ride_id, status, driver_id, available_seats } = reqResult.rows[0];

    // 2. Validations
    if (driver_id !== driverId) {
      throw new UnauthorizedRequestError("You are not the driver of this ride");
    }
    if (status === "accepted") {
      throw new RequestStateError("Request is already accepted");
    }
    if (available_seats <= 0) {
      throw new RideFullError();
    }

    // 3. Decrement Seats
    await client.query(
      "UPDATE rides SET available_seats = available_seats - 1 WHERE id = $1",
      [ride_id],
    );

    // 4. Update Status
    const updateResult = await client.query(
      `UPDATE ride_requests SET status = 'accepted' WHERE id = $1 RETURNING *`,
      [requestId],
    );

    await client.query("COMMIT");
    return updateResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}





export async function revokeRequest({ requestId, driverId }: RequestActionParams) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. Fetch Request with Lock
    const reqQuery = `
      SELECT req.ride_id, req.status, r.driver_id 
      FROM ride_requests req
      JOIN rides r ON req.ride_id = r.id
      WHERE req.id = $1
      FOR UPDATE
    `;
    const reqResult = await client.query(reqQuery, [requestId]);

    if (reqResult.rows.length === 0) {
      throw new RequestNotFoundError();
    }

    const { ride_id, status, driver_id } = reqResult.rows[0];

    // 2. Validations
    if (driver_id !== driverId) {
      throw new UnauthorizedRequestError('You are not the driver of this ride');
    }
    if (status !== 'accepted') {
      throw new RequestStateError('Request is not currently accepted');
    }

    // 3. Increment Seats (Release the spot)
    await client.query(
      'UPDATE rides SET available_seats = available_seats + 1 WHERE id = $1',
      [ride_id]
    );

    // 4. Revert Status to Pending
    const updateResult = await client.query(
      `UPDATE ride_requests SET status = 'pending' WHERE id = $1 RETURNING *`,
      [requestId]
    );

    await client.query('COMMIT');
    return updateResult.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}