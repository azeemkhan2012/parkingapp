import { createParkingSpot } from '../config/firebase';

export const seedParkingSpots = async () => {
  const sampleSpots = [
    {
      location: 'A1',
      latitude: 37.78825,
      longitude: -122.4324,
      is_available: true,
      price: '$5/hour',
      description: 'Premium parking spot near downtown'
    },
    {
      location: 'A2',
      latitude: 37.78925,
      longitude: -122.4334,
      is_available: true,
      price: '$4/hour',
      description: 'Convenient parking near shopping center'
    },
    {
      location: 'B1',
      latitude: 37.79025,
      longitude: -122.4344,
      is_available: true,
      price: '$3/hour',
      description: 'Affordable parking option'
    },
    {
      location: 'B2',
      latitude: 37.79125,
      longitude: -122.4354,
      is_available: true,
      price: '$6/hour',
      description: 'Premium spot with security'
    },
    {
      location: 'C1',
      latitude: 37.79225,
      longitude: -122.4364,
      is_available: true,
      price: '$4/hour',
      description: 'Standard parking spot'
    }
  ];

  for (const spot of sampleSpots) {
    try {
      await createParkingSpot(spot);
      console.log(`Created spot: ${spot.location}`);
    } catch (error) {
      console.error(`Error creating spot ${spot.location}:`, error);
    }
  }
};

// Call this function once to seed your Firestore database
// seedParkingSpots(); 