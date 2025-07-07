// import React, { useEffect, useState } from 'react';
// import { View, TextInput, StyleSheet, Dimensions, Text } from 'react-native';
// import MapView, { Marker } from 'react-native-maps';

// const HomePage = () => {
//   const [search, setSearch] = useState('');
//   const [spots, setSpots] = useState([]);
//   const [region, setRegion] = useState({
//     latitude: 37.78825,
//     longitude: -122.4324,
//     latitudeDelta: 0.0922,
//     longitudeDelta: 0.0421,
//   });

// //   useEffect(() => {
// //     // Fetch parking spots from backend
// //     fetch('http://10.0.2.2:5001/spots')
// //       .then(res => res.json())
// //       .then(data => setSpots(data))
// //       .catch(() => setSpots([]));
// //   }, []);

//   // For demo, filter by location string match
//   const filteredSpots = spots.filter(spot =>
//     spot.location && spot.location.toLowerCase().includes(search.toLowerCase())
//   );

//   return (
//     <View style={styles.container}>
//       <TextInput
//         style={styles.searchBar}
//         placeholder="Search by location..."
//         value={search}
//         onChangeText={setSearch}
//       />
//       <MapView
//         style={styles.map}
//         region={region}
//         onRegionChangeComplete={setRegion}
//       >
//         {filteredSpots.map(spot => (
//           <Marker
//             key={spot.id}
//             coordinate={{
//               latitude: spot.latitude || 37.78825, // fallback demo coords
//               longitude: spot.longitude || -122.4324,
//             }}
//             title={spot.location}
//             description={spot.is_available ? 'Available' : 'Unavailable'}
//             pinColor={spot.is_available ? 'green' : 'red'}
//           />
//         ))}
//       </MapView>
//       {filteredSpots.length === 0 && (
//         <View style={styles.noResults}><Text>No spots found.</Text></View>
//       )}
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#F4F6F6',
//   },
//   searchBar: {
//     backgroundColor: '#fff',
//     borderColor: 'grey',
//     borderWidth: 1,
//     borderRadius: 50,
//     padding: 12,
//     margin: 16,
//     fontSize: 16,
//     zIndex: 2,
//     position: 'absolute',
//     top: 20,
//     left: 0,
//     right: 0,
//     marginHorizontal: 16,
//     elevation: 2,
//   },
//   map: {
//     width: Dimensions.get('window').width,
//     height: Dimensions.get('window').height,
//   },
//   noResults: {
//     position: 'absolute',
//     top: 100,
//     left: 0,
//     right: 0,
//     alignItems: 'center',
//   },
// });

// export default HomePage;
