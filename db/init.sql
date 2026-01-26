CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number VARCHAR(15) UNIQUE NOT NULL,
  email VARCHAR(255),
  password_hash TEXT NOT NULL,
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- RIDES
CREATE TABLE rides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- ownership
  driver_id UUID NOT NULL REFERENCES users(id),

  -- display fields (for UI only)
  source TEXT[] NOT NULL,
  destination TEXT[] NOT NULL,

  -- departure semantics
  departure_type VARCHAR(20) NOT NULL CHECK (
    departure_type IN ('scheduled', 'window')
  ),

  -- scheduled ride
  ride_time TIMESTAMP,

  -- window ride
  flexible_window_minutes INT,

  -- window correctness
  window_updated_at TIMESTAMP,

  -- seats & pricing
  total_seats INT,
  available_seats INT,
  seat_layout VARCHAR(50),
  price_per_person INT,

  -- vehicle & notes
  car_info VARCHAR(255),
  extra_notes TEXT,

  -- payment (manual UPI / phone)
  payment_contact VARCHAR(100),

  -- status
  status VARCHAR(20) DEFAULT 'active',

  -- timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- constraints
  CHECK (
    (departure_type = 'scheduled' AND ride_time IS NOT NULL)
    OR
    (departure_type = 'window' AND flexible_window_minutes IS NOT NULL)
  )
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rides_updated_at_trigger
BEFORE UPDATE ON rides
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();



-- RIDE REQUESTS
CREATE TABLE IF NOT EXISTS ride_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID REFERENCES rides(id),
  requester_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (ride_id, requester_id)
);

-- CONVERSATIONS
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id UUID REFERENCES users(id),
  user2_id UUID REFERENCES users(id),
  ride_id UUID REFERENCES rides(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user1_id, user2_id, ride_id)
);

-- MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id),
  sender_id UUID REFERENCES users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- RIDE PARTICIPANTS
CREATE TABLE IF NOT EXISTS ride_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID REFERENCES rides(id),
  user_id UUID REFERENCES users(id),
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (ride_id, user_id)
);
