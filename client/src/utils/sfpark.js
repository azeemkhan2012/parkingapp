export const fetchSFparkSpots = async (lat, lon, radius = 0.5) => {
  try {
    const url = `https://api.sfpark.org/sfpark/rest/availabilityservice?lat=${lat}&long=${lon}&radius=${radius}`;
    const resp = await fetch(url);
    const data = await resp.json();
    // SFpark returns data in 'AVL' array
    if (data && data.AVL) {
      return data.AVL.map(spot => ({
        id: spot.OSMID,
        latitude: parseFloat(spot.Y),
        longitude: parseFloat(spot.X),
        location: spot.NAME,
        is_available: spot.OCC === '0', // 0 = available
        price: spot.RATE ? parseFloat(spot.RATE) : 0,
        type: spot.TYPE,
        address: spot.NAME,
      }));
    }
    return [];
  } catch (e) {
    console.error('SFpark fetch error:', e);
    return [];
  }
}; 