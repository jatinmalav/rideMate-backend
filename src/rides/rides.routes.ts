import { Router } from "express";

import {
  authenticateJWT,
  AuthenticatedRequest,
} from "../middleware/auth.middleware";

import { createRide, updateRide, findRides, findMyRides } from "./rides.service";

import {
  RideNotFoundError,
  RideForbiddenError,
  InvalidRideInputError,
} from "../errors/ride.errors";


const router = Router();

/**
 * POST /rides
 * Create a new ride (scheduled or window)
 */
router.post("/", authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const ride = await createRide({
    driverId: req.userId!,
    ...req.body,
  });

  res.status(201).json(ride);
});




/**
 * PUT /rides/:rideId
 * Edit any field of a ride (driver only)
 */
router.put(
  "/:rideId",
  authenticateJWT,
  async (req: AuthenticatedRequest, res) => {
    const ride = await updateRide({
      rideId: req.params.rideId,
      driverId: req.userId!,
      updates: req.body,
    });
    res.json(ride);
  }
);

/**
 * GET /rides/my-rides
 * Driver: View their offered rides
 */
router.get(
  "/my-rides",
  authenticateJWT,
  async (req: AuthenticatedRequest, res) => {
    const rides = await findMyRides(req.userId!);
    res.json(rides);
  }
);

export default router;




/**
 * GET /rides/search
 * Find rides for home screen
 */
router.get("/search", async (req, res) => {
  const { source, destination, date, page, limit } = req.query;

  const sourceFilters =
    typeof source === "string" && source.trim().length > 0
      ? source
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      : null;

  const destinationFilters =
    typeof destination === "string" && destination.trim().length > 0
      ? destination
          .split(",")
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean)
      : null;

  const pageNumber = Math.max(1, Number(page || 1));
  const pageSize = Math.min(50, Number(limit || 20));

  if (
    !Number.isInteger(pageNumber) ||
    !Number.isInteger(pageSize) ||
    pageNumber < 1 ||
    pageSize < 1 ||
    pageSize > 50
  ) {
    throw new InvalidRideInputError("invalid pagination parameters");
  }

  let searchDate: Date;
  if (date) {
    searchDate = new Date(date as string);
    if (isNaN(searchDate.getTime())) {
      throw new InvalidRideInputError("invalid date format");
    }
  } else {
    searchDate = new Date(); // default today
  }

  const rides = await findRides({
    sourceFilters,
    destinationFilters,
    date: searchDate,
    page: pageNumber,
    limit: pageSize,
  });

  res.json({
    page: pageNumber,
    limit: pageSize,
    results: rides,
  });
});
