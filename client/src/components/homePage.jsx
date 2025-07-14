import React, {useEffect, useState} from 'react';
import {View, TextInput, StyleSheet, Dimensions, Text} from 'react-native';
import Mapbox from '@rnmapbox/maps';

Mapbox.setAccessToken(
  'pk.eyJ1IjoiaHV6YWlmYS1zYXR0YXIxIiwiYSI6ImNsbmQxMmZ6dTAwcHgyam1qeXU2bjcwOXQifQ.Pvx7OyCBvhwtBbHVVKOCEg',
);

const INITIAL_COORDINATE = {
  latitude: 37.78825,
  longitude: -122.4324,
  zoomLevel: 12,
};

const HomePage = () => {
  const [search, setSearch] = useState('');
  const [spots, setSpots] = useState([]);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [zoom, setZoom] = useState(INITIAL_COORDINATE.zoomLevel);

  useEffect(() => {
    // Fetch parking spots from backend
    fetch('http://10.0.2.2:5001/spots')
      .then(res => res.json())
      .then(data => setSpots(data))
      .catch(() => setSpots([]));
  }, []);

  // For demo, filter by location string match
  const filteredSpots = spots.filter(
    spot =>
      spot.location &&
      spot.location.toLowerCase().includes(search.toLowerCase()),
  );

  // Helper: get coordinates for camera
  const cameraCenter = filteredSpots.length > 0 && filteredSpots[0].latitude && filteredSpots[0].longitude
    ? [filteredSpots[0].longitude, filteredSpots[0].latitude]
    : [INITIAL_COORDINATE.longitude, INITIAL_COORDINATE.latitude];

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchBar}
        placeholder="Search by location..."
        value={search}
        onChangeText={setSearch}
      />
      <View style={styles.zoomControls}>
        <Text style={styles.zoomButton} onPress={() => setZoom(z => Math.min(z + 1, 20))}>+</Text>
        <Text style={styles.zoomButton} onPress={() => setZoom(z => Math.max(z - 1, 1))}>-</Text>
      </View>
      <Mapbox.MapView style={styles.map}>
        <Mapbox.Camera
          zoomLevel={zoom}
          centerCoordinate={cameraCenter}
          animationMode="flyTo"
          animationDuration={800}
        />
        {filteredSpots.map((spot, idx) =>
          spot.latitude && spot.longitude ? (
            <Mapbox.PointAnnotation
              key={idx}
              id={`spot-${idx}`}
              coordinate={[spot.longitude, spot.latitude]}
              onSelected={() => setSelectedSpot(spot)}
            >
              <View style={styles.marker} />
              {selectedSpot && selectedSpot === spot && (
                <Mapbox.Callout title={spot.location || 'Parking Spot'}>
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle}>{spot.location || 'Parking Spot'}</Text>
                    {spot.price && <Text>Price: {spot.price}</Text>}
                    {spot.availability && <Text>Available: {spot.availability}</Text>}
                  </View>
                </Mapbox.Callout>
              )}
            </Mapbox.PointAnnotation>
          ) : null
        )}
      </Mapbox.MapView>
      {filteredSpots.length === 0 && (
        <View style={styles.noResults}>
          <Text>No spots found.</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F6',
  },
  searchBar: {
    backgroundColor: '#fff',
    borderColor: 'grey',
    borderWidth: 1,
    borderRadius: 50,
    padding: 12,
    margin: 16,
    fontSize: 16,
    zIndex: 2,
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    marginHorizontal: 16,
    elevation: 2,
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  marker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    borderWidth: 2,
    borderColor: '#fff',
  },
  callout: {
    padding: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    minWidth: 120,
  },
  calloutTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  zoomControls: {
    position: 'absolute',
    top: 80,
    right: 20,
    zIndex: 3,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    padding: 4,
    flexDirection: 'column',
    alignItems: 'center',
  },
  zoomButton: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 6,
    color: '#007AFF',
  },
  noResults: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});

export default HomePage;
