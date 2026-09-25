// Remove the one-time authorization code from the visible address/history.
history.replaceState(null, '', '/auth/callback');
