/**
 * FindIt Centralized API Base URL Configuration
 * 
 * Instructions for Mobile Network Access:
 * 1. Keep CONFIG_SERVER_IP as '' (empty) to auto-detect your PC's IP address when opened in mobile Chrome browser!
 * 2. Or if you want to explicitly set your PC's local IPv4 address (e.g. '192.168.1.100'), enter it in CONFIG_SERVER_IP below.
 */
const CONFIG_SERVER_IP = ''; // Set this only when accessing the app from another device on the local network
const CONFIG_SERVER_PORT = '3000';

(function () {
  if (typeof window !== 'undefined') {
    if (CONFIG_SERVER_IP) {
      window.API_BASE_URL = `http://${CONFIG_SERVER_IP}:${CONFIG_SERVER_PORT}`;
    } else if (window.location.origin && window.location.origin !== 'null' && !window.location.origin.startsWith('file://')) {
      // Auto-detect current host IP and port
      window.API_BASE_URL = window.location.origin;
    } else {
      // Default fallback
      window.API_BASE_URL = `http://localhost:${CONFIG_SERVER_PORT}`;
    }
  }
})();

