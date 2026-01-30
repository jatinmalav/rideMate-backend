import axios from "axios";

const API_URL = "http://localhost:3000";

// --- State Management ---
const users = {
  driver: {
    phone: "9876543210",
    pass: "pass123",
    name: "Driver Dave",
    token: "",
    id: "",
  },
  p1: {
    phone: "1122334455",
    pass: "pass123",
    name: "Passenger Paul",
    token: "",
    id: "",
  },
  p2: {
    phone: "5566778899",
    pass: "pass123",
    name: "Passenger Sarah",
    token: "",
    id: "",
  },
};

let scheduledRideId: string;
let windowRideId: string;
let requestId: string;

// --- Helpers ---
const print = (msg: string) => console.log(`\n🔹 ${msg}`);
const success = (msg: string) => console.log(`   ✅ ${msg}`);
const fail = (msg: string) => console.error(`   ❌ ${msg}`);
const info = (msg: string) => console.log(`   ℹ️  ${msg}`);

async function registerAndLogin(userKey: keyof typeof users) {
  const u = users[userKey];
  // 1. Register User
  try {
    await axios.post(`${API_URL}/auth/register`, {
      phone: u.phone,
      name: u.name,
      password: u.pass,
      email: `${u.name.replace(" ", "")}@test.com`,
    });
    info(`Registered new user: ${u.name}`);
  } catch (e: any) {
    if (e.response && e.response.status === 409) {
      info(`User ${u.name} already exists, skipping registration.`);
    } else {
      fail(`REGISTRATION FAILED for ${u.name}: ${e.response?.data?.error || e.message}`);
      process.exit(1); // Exit if registration fails unexpectedly
    }
  }

  // 2. Login
  try {
    const res = await axios.post(`${API_URL}/auth/login`, {
      phone: u.phone,
      password: u.pass,
    });

    u.token = res.data.token;

    // Decode JWT to get User ID using Node.js Buffer
    const payloadBase64 = u.token.split(".")[1];
    const jsonPayload = Buffer.from(payloadBase64, "base64").toString("utf-8");
    u.id = JSON.parse(jsonPayload).userId;

    success(`${u.name} Logged In`);
  } catch (e: any) {
    fail(`${u.name} Login Failed: ${e.response?.data?.error || e.message}`);
    process.exit(1); // Exit if login fails
  }
}

async function main() {
  console.log("🚀 STARTING COMPREHENSIVE SYSTEM TEST");

  // --- PHASE 1: Auth ---
  print("PHASE 1: Auth & User Setup");
  await registerAndLogin("driver");
  await registerAndLogin("p1");
  await registerAndLogin("p2");

  // --- PHASE 2: Ride Creation ---
  print("PHASE 2: Driver Creates Rides");

  // Case A: Scheduled Ride
  try {
    const res = await axios.post(
      `${API_URL}/rides`,
      {
        source: ["Palava City"],
        destination: ["Dadar Station"],
        departure_type: "scheduled",
        ride_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        total_seats: 3,
        price_per_person: 150,
      },
      { headers: { Authorization: `Bearer ${users.driver.token}` } },
    );

    scheduledRideId = res.data.id;
    success(`Created Scheduled Ride (ID: ${scheduledRideId})`);
  } catch (e: any) {
    fail(`Scheduled Ride Creation Failed: ${e.response?.data?.error || e.message}`);
  }

  // Case B: Flexible Window Ride (for search testing)
  try {
    const res = await axios.post(
      `${API_URL}/rides`,
      {
        source: ["Dombivli"],
        destination: ["Navi Mumbai"],
        departure_type: "window",
        flexible_window_minutes: 30,
        window_updated_at: new Date().toISOString(),
        total_seats: 2,
        price_per_person: 200,
        car_info: "Hatchback",
      },
      { headers: { Authorization: `Bearer ${users.driver.token}` } },
    );

    windowRideId = res.data.id;
    success(`Created Flexible Window Ride (ID: ${windowRideId})`);
  } catch (e: any) {
    fail(`Window Ride Creation Failed: ${e.response?.data?.error || e.message}`);
  }
  // Case C: Invalid Constraint Test (Scheduled without Time)
  try {
    await axios.post(
      `${API_URL}/rides`,
      {
        source: ["Test"],
        destination: ["Test"],
        departure_type: "scheduled", // Missing ride_time
        // MISSING ride_time -> Should Fail DB Check
        total_seats: 1,
        price_per_person: 100,
      },
      { headers: { Authorization: `Bearer ${users.driver.token}` } },
    );
    fail("Constraint Test Failed: DB accepted scheduled ride without time");
  } catch (e: any) {
    if (e.response && e.response.status === 400) {
      success("Constraint Verified: Rejected scheduled ride without time (400 OK)");
    } else {
      fail(`Constraint test failed with unexpected error: ${e.message}`);
    }
  }

  // --- PHASE 3: Search ---
  print("PHASE 3: Passenger Searches for Rides");
  try {
    const tomorrow = new Date(Date.now() + 86400000);
    const res = await axios.get(`${API_URL}/rides/search`, {
      params: {
        source: "palava city",
        destination: "Dadar Station",
        date: tomorrow.toISOString().split("T")[0], // Specify tomorrow's date
      },
    });
    const foundRide = res.data.results.find((r: any) => r.id === scheduledRideId);
    if (foundRide) {
      success(`Search API found the created ride (ID: ${foundRide.id})`);
    } else {
      fail("Search API did not return the created ride");
    }
  } catch (e: any) {
    fail(`Ride Search Failed: ${e.response?.data?.error || e.message}`);
  }

  // --- PHASE 4: Ride Requests ---
  print("PHASE 4: Request & Dashboard Flow");
  try {
    const res = await axios.post(
      `${API_URL}/requests`,
      { rideId: scheduledRideId },
      {
        headers: { Authorization: `Bearer ${users.p1.token}` },
      },
    );
    requestId = res.data.id;
    success("Passenger 1 requested Scheduled Ride");
  } catch (e: any) {
    fail(`Request Creation Failed: ${e.response?.data?.error || e.message}`);
  }

  // --- PHASE 5: Driver Actions ---
  print("PHASE 5: Driver Manages Requests");
  try {
    await axios.post(
      `${API_URL}/requests/${requestId}/accept`,
      {},
      {
        headers: { Authorization: `Bearer ${users.driver.token}` },
      },
    );
    success("Driver Accepted P1");
    // Verify Seat Count Decrement
    const tomorrow = new Date(Date.now() + 86400000);
    const rideRes = await axios.get(`${API_URL}/rides/search`, {
      params: { date: tomorrow.toISOString().split("T")[0] }, // Search for tomorrow's ride
    });
    const ride = rideRes.data.results.find((r: any) => r.id === scheduledRideId);
    if (ride.available_seats === 2) {
      success("Seat count decremented correctly (3 -> 2)");
    } else {
      fail(`Seat count is incorrect: Expected 2, Got ${ride.available_seats}`);
    }
  } catch (e: any) {
    fail(`Accept Request Failed: ${e.response?.data?.error || e.message}`);
  }

  // --- PHASE 6: Edge Cases & Final State ---
  print("PHASE 6: Testing Edge Cases");
  try {
    await axios.post(
      `${API_URL}/requests`,
      { rideId: scheduledRideId },
      {
        headers: { Authorization: `Bearer ${users.p1.token}` },
      },
    );
    fail("Duplicate Request Logic Failed: System allowed a duplicate request.");
  } catch (e: any) {
    if (e.response && e.response.status === 409) {
      success("Duplicate Request Blocked (409 OK)");
    } else {
      fail(`Unexpected error on duplicate request test: ${e.message}`);
    }
  }
  try {
    await axios.post(
      `${API_URL}/requests/${requestId}/revoke`,
      {},
      {
        headers: { Authorization: `Bearer ${users.driver.token}` },
      },
    );
    success("Driver Revoked P1");
    // Verify Seat Count Restoration
    const tomorrow = new Date(Date.now() + 86400000);
    const rideRes = await axios.get(`${API_URL}/rides/search`, {
      params: { date: tomorrow.toISOString().split("T")[0] }, // Search for tomorrow's ride
    });
    const ride = rideRes.data.results.find((r: any) => r.id === scheduledRideId);
    if (ride.available_seats === 3) {
      success("Seat count restored correctly (2 -> 3)");
    } else {
      fail(`Seat count wrong after revoke: Expected 3, Got ${ride.available_seats}`);
    }
  } catch (e: any) {
    fail(`Revoke Request Failed: ${e.response?.data?.error || e.message}`);
  }

  console.log("\n✅ TEST SUITE COMPLETED");
}

main();
