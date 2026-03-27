import axios from 'axios';

const baseURL =
  process.env.NODE_ENV === 'production'
    ? '/'  // changed from '/' to '/api'
    : 'http://localhost:5000/';  // changed from : 'http://127.0.0.1:5000/'

export default axios.create({
  withCredentials: true,  // Ensures cookies are sent
  baseURL: baseURL,
});