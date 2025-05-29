import {StyleSheet} from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F6',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#27AE60',
    alignSelf: 'center',
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#fff',
    borderStyle: 'solid',
    borderColor: 'grey',
    borderWidth: 1,
    padding: 15,
    borderRadius: 50,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2ECC71',
    padding: 15,
    borderRadius: 50,
    alignItems: 'center',
    marginTop: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  logoContainer: {
    marginTop: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 150,
    height: 150,
  },
  error: {
    color: 'blue',
    marginBottom: 15,
    marginLeft:10,
  },
});
