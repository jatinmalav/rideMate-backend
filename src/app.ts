import express from "express";
import cors from "cors";
import { testDbConnection } from "./db";
import authRoutes from "./auth/auth.routes";
import ridesRoutes from "./rides/rides.routes";
import { authenticateJWT, AuthenticatedRequest } from "./middleware/auth.middleware";

const app = express();


// ---- Middlewares ----
app.use(cors());
app.use(express.json());


// ---- Routes ----
app.use("/auth", authRoutes);
app.use("/rides", ridesRoutes);


// ----- Health checks -----
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/health/db", async (_req, res) => {
  try {
    await testDbConnection();
    res.json({ db: "connected" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ db: "error" });
  }
});

app.get("/me", authenticateJWT, (req: AuthenticatedRequest, res) => {
  res.json({ userId: req.userId });
});


export default app;
