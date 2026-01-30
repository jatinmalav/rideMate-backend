import { Router, Response } from "express";
// Using correct named exports from your middleware file
import {
  authenticateJWT,
  AuthenticatedRequest,
} from "../middleware/auth.middleware";
import * as requestService from "./requests.service";

const router = Router();

/**
 * POST /requests
 * Create a new ride request
 */
router.post(
  "/",
  authenticateJWT,
  async (req: AuthenticatedRequest, res: Response) => {
    const passengerId = req.userId!;
    const { rideId } = req.body;

    const request = await requestService.createRequest({
      rideId,
      passengerId,
    });
    res.status(201).json(request);
  },
);

/**
 * GET /requests/my-requests
 * Passenger: View their requests
 */
router.get(
  "/my-requests",
  authenticateJWT,
  async (req: AuthenticatedRequest, res: Response) => {
    const passengerId = req.userId!;
    const requests = await requestService.getPassengerRequests(passengerId);
    res.json(requests);
  },
);

/**
 * GET /requests/ride/:rideId
 * Driver: View requests for their ride
 */
router.get(
  "/ride/:rideId",
  authenticateJWT,
  async (req: AuthenticatedRequest, res: Response) => {
    const driverId = req.userId!;
    const { rideId } = req.params;

    const requests = await requestService.getRideRequests(rideId, driverId);
    res.json(requests);
  },
);




/**
 * POST /requests/:requestId/accept
 * Driver: Accept a request
 */
router.post(
  "/:requestId/accept",
  authenticateJWT,
  async (req: AuthenticatedRequest, res: Response) => {
    const driverId = req.userId!;
    const { requestId } = req.params;

    const result = await requestService.acceptRequest({
      requestId,
      driverId,
    });

    res.status(200).json({
      message: "Request accepted successfully",
      request: result,
    });
  },
);



/**
 * POST /requests/:requestId/revoke
 * Driver Action: Un-accept (Undo) a request.
 * Moves status back to 'pending' and frees up a seat.
 */
router.post('/:requestId/revoke', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const driverId = req.userId!;
  const { requestId } = req.params;

  const result = await requestService.revokeRequest({ requestId, driverId });

  res.status(200).json({
    message: 'Request revoked (un-accepted) successfully',
    request: result
  });
});

export default router;