import { pool } from "../db";
import {
  RideNotFoundError,
  RideForbiddenError,
  InvalidRideInputError,
} from "../errors/ride.errors";

interface CreateRideInput {
  driverId: string;
  source?: string;
  destination?: string;
  departure_type?: "scheduled" | "window";
  ride_time?: string;
  flexible_window_minutes?: number;
  total_seats?: number;
  available_seats?: number; 
  seat_layout?: string;
  price_per_person?: number;
  payment_contact?: string;
  car_info?: string;
  extra_notes?: string;
}

export async function createRide(input: CreateRideInput) {
  const {
    driverId,
    source,
    destination,
    departure_type,
    ride_time,
    flexible_window_minutes,
    total_seats,
    available_seats,
    seat_layout,
    price_per_person,
    payment_contact,
    car_info,
    extra_notes,
  } = input;

  // VALIDATION MOVED TO SERVICE (IMPORTANT)
  if (!Array.isArray(source) || source.length === 0) {
    throw new InvalidRideInputError("source path is required");
  }

  if (!Array.isArray(destination) || destination.length === 0) {
    throw new InvalidRideInputError("destination path is required");
  }

  if (departure_type !== "scheduled" && departure_type !== "window") {
    throw new InvalidRideInputError(
      "departure_type must be 'scheduled' or 'window'",
    );
  }

  if (departure_type === "scheduled" && !ride_time) {
    throw new InvalidRideInputError(
      "ride_time is required for scheduled rides",
    );
  }

  if (departure_type === "window" && flexible_window_minutes === undefined) {
    throw new InvalidRideInputError(
      "flexible_window_minutes is required for window rides",
    );
  }

  if (total_seats !== undefined && total_seats <= 0) {
    throw new InvalidRideInputError("total_seats must be > 0");
  }

  /* ---------- normalization ---------- */

  const normalizedSource = source.map((s) => s.trim().toLowerCase());

  const normalizedDestination = destination.map((d) => d.trim().toLowerCase());

  /* ---------- window correctness ---------- */

  const windowUpdatedAt = departure_type === "window" ? new Date() : null;
  /* ---------- insert ---------- */

  const finalAvailableSeats =
    available_seats !== undefined ? available_seats : (total_seats ?? null);

  const result = await pool.query(
    `
    INSERT INTO rides (
      driver_id,
      source,
      destination,
      departure_type,
      ride_time,
      flexible_window_minutes,
      window_updated_at,
      total_seats,
      available_seats,
      seat_layout,
      price_per_person,
      payment_contact,
      car_info,
      extra_notes
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,
      $8,$9,$10,$11,$12,$13,$14
    )
    RETURNING *;
    `,
    [
      driverId,
      normalizedSource,
      normalizedDestination,
      departure_type,
      departure_type === "scheduled" ? ride_time : null,
      departure_type === "window" ? flexible_window_minutes : null,
      windowUpdatedAt,
      total_seats ?? null, // total_seats
      finalAvailableSeats,
      seat_layout ?? null,
      price_per_person ?? null,
      payment_contact ?? null,
      car_info ?? null,
      extra_notes ?? null,
    ],
  );

  return result.rows[0];
}

interface UpdateRideInput {
  rideId: string;
  driverId: string;
  updates: Record<string, any>;
}

const NON_EDITABLE_FIELDS = new Set(["id", "driver_id", "created_at"]);

export async function updateRide({
  rideId,
  driverId,
  updates,
}: UpdateRideInput) {
  // Existence + ownership check (split errors)
  const check = await pool.query(`SELECT driver_id FROM rides WHERE id = $1`, [
    rideId,
  ]);

  if (check.rowCount === 0) {
    throw new RideNotFoundError();
  }

  if (check.rows[0].driver_id !== driverId) {
    throw new RideForbiddenError();
  }

  const current = check.rows[0];

  // Semantic validation (only when fields are present)
  if (
    updates.departure_type &&
    updates.departure_type !== "scheduled" &&
    updates.departure_type !== "window"
  ) {
    throw new InvalidRideInputError(
      "departure_type must be 'scheduled' or 'window'",
    );
  }

  if (
    updates.departure_type === "scheduled" &&
    updates.ride_time === undefined
  ) {
    throw new InvalidRideInputError(
      "ride_time is required for scheduled rides",
    );
  }

  if (
    updates.departure_type === "window" &&
    updates.flexible_window_minutes === undefined
  ) {
    throw new InvalidRideInputError(
      "flexible_window_minutes is required for window rides",
    );
  }

  /* ---------- window timing detection ---------- */
  let shouldUpdateWindowTime = false;
  // switching to window
  if (
    updates.departure_type === "window" &&
    current.departure_type !== "window"
  ) {
    shouldUpdateWindowTime = true;
  }

  // window minutes changed
  if (
    updates.flexible_window_minutes !== undefined &&
    updates.flexible_window_minutes !== current.flexible_window_minutes
  ) {
    shouldUpdateWindowTime = true;
  }

  const columns: string[] = [];
  const values: any[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(updates)) {
    // Never allow system fields
    if (NON_EDITABLE_FIELDS.has(key)) {
      continue;
    }

    // undefined → do not touch
    if (value === undefined) {
      continue;
    }

    // source / destination normalization
    if (key === "source") {
      if (!Array.isArray(value) || value.length === 0) {
        throw new InvalidRideInputError("source must be a non-empty array");
      }
      columns.push(`source = $${idx++}`);
      values.push(value.map((s: string) => s.trim().toLowerCase()));
      continue;
    }

    if (key === "destination") {
      if (!Array.isArray(value) || value.length === 0) {
        throw new InvalidRideInputError(
          "destination must be a non-empty array",
        );
      }
      columns.push(`destination = $${idx++}`);
      values.push(value.map((d: string) => d.trim().toLowerCase()));
      continue;
    }

    // null → explicitly clear column
    columns.push(`${toSnakeCase(key)} = $${idx++}`);
    values.push(value);
  }

  /* ---------- window timestamp ---------- */

  if (shouldUpdateWindowTime) {
    columns.push(`window_updated_at = $${idx++}`);
    values.push(new Date());
  }

  
  if (columns.length === 0) {
    throw new InvalidRideInputError("No valid fields to update");
  }

  const query = `
    UPDATE rides
    SET ${columns.join(", ")}
    WHERE id = $${idx} AND driver_id = $${idx + 1}
    RETURNING *
  `;

  values.push(rideId, driverId);

  const result = await pool.query(query, values);
  return result.rows[0];
}

function toSnakeCase(str: string) {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}




/**
 * Parameters for finding rides on home/search screen
 */
export interface FindRideParams {
  sourceFilters: string[] | null;
  destinationFilters: string[] | null;
  date: Date;
  page: number;
  limit: number;
}
/**
 * SQL query for Find Ride API
 * - Supports optional source & destination filters
 * - Uses pickup_points and drop_points arrays
 * - Handles scheduled + window rides
 * - Defaults to today's date (handled in service)
 */
const FIND_RIDES_SQL = `
SELECT
  r.id,
  r.source,
  r.destination,
  r.available_seats,
  r.price_per_person,
  r.seat_layout,
  r.car_info,
  r.extra_notes,

  -- unified ride_time for frontend
  CASE
    WHEN r.departure_type = 'scheduled'
      THEN to_char(r.ride_time, 'HH:MI AM')
    ELSE
      CASE
        WHEN r.flexible_window_minutes <= 5
          THEN 'Now'
        ELSE
          'Leaving in ' || r.flexible_window_minutes || ' mins'
      END
  END AS ride_time,

  u.id   AS driver_id,
  u.name AS driver_name,

  -- effective time for sorting
  CASE
    WHEN r.departure_type = 'scheduled'
      THEN r.ride_time
    ELSE
      r.updated_at
        + (r.flexible_window_minutes || ' minutes')::interval
  END AS effective_time

FROM rides r
JOIN users u ON u.id = r.driver_id

WHERE
  r.status = 'active'
  AND r.available_seats > 0

  -- optional source filter (pickup path)
  AND (
        $1::text[] IS NULL
        OR r.source && $1
        )
        AND (
        $2::text[] IS NULL
        OR r.destination && $2
    )

  -- date + time validity
  AND (
    (
      r.departure_type = 'scheduled'
      AND r.ride_time >= $3
      AND r.ride_time <  $4
      AND r.ride_time > NOW()
    )
    OR
    (
      r.departure_type = 'window'
      AND r.updated_at >= $3
      AND r.updated_at <  $4
      AND (
        r.updated_at
          + (r.flexible_window_minutes || ' minutes')::interval
      ) > NOW()
    )
  )

ORDER BY
  effective_time ASC,
  r.created_at DESC

LIMIT $5 OFFSET $6;
`;

export async function findRides({
  sourceFilters,
  destinationFilters,
  date,
  page,
  limit,
}: FindRideParams) {
  // normalize date boundaries
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const offset = (page - 1) * limit;

  const result = await pool.query(FIND_RIDES_SQL, [
    sourceFilters, // $1
    destinationFilters, // $2
    startOfDay, // $3
    endOfDay, // $4
    limit, // $5
    offset, // $6
  ]);

  // map DB rows → API response
  return result.rows.map((row) => ({
    id: row.id,
    source: row.source,
    destination: row.destination,
    ride_time: row.ride_time,
    available_seats: row.available_seats,
    price_per_person: row.price_per_person,
    seat_layout: row.seat_layout,
    car_info: row.car_info,
    extra_notes: row.extra_notes,
    driver: {
      id: row.driver_id,
      name: row.driver_name,
    },
  }));
}