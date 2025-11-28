/**
 * Utility functions for parking spot operations
 */

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in kilometers
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c) * 100) / 100; // Round to 2 decimals
};

/**
 * Extract numeric price from price field
 * Handles various formats: number, string like "$5/hour", "40 PKR", etc.
 */
export const extractPrice = (price) => {
  if (typeof price === 'number') return price;
  if (typeof price === 'string') {
    // Remove currency symbols and extract first number
    const match = price.match(/\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : 0;
  }
  return 0;
};

/**
 * Get price from parking spot (handles different data structures)
 */
export const getSpotPrice = (spot) => {
  // Try different possible price fields
  if (spot.pricing_hourly) return spot.pricing_hourly;
  if (spot.pricing_daily) return spot.pricing_daily;
  if (spot.price) return extractPrice(spot.price);
  if (spot.pricing?.hourly) return spot.pricing.hourly;
  if (spot.pricing?.daily) return spot.pricing.daily;
  return 0;
};

/**
 * Get capacity info from parking spot
 */
export const getSpotCapacity = (spot) => {
  if (spot.availability_available !== undefined && spot.availability_total !== undefined) {
    return {
      available: spot.availability_available,
      total: spot.availability_total,
    };
  }
  if (spot.availability?.available && spot.availability?.total) {
    return {
      available: spot.availability.available,
      total: spot.availability.total,
    };
  }
  return { available: 0, total: 0 };
};

/**
 * Get rating from parking spot
 */
export const getSpotRating = (spot) => {
  return spot.rating || spot.rating || 0;
};

/**
 * Get review count from parking spot
 */
export const getReviewCount = (spot) => {
  return spot.reviewCount || spot.review_count || 0;
};

