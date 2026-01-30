import dotenv from "dotenv";
dotenv.config();
import "express-async-errors"; // Must be imported before your app

import app from "./app";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`RideMate backend running on port ${PORT}`);
});
