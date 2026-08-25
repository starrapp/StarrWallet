/**
 * Dynamic Expo config.
 *
 * app.json stays the source of truth and is passed in as `config`. This wrapper
 * only injects the Google Maps API key, which cannot be committed.
 *
 * A dynamic config is required here: app.json is read as plain JSON, so a
 * "process.env.X" string in it reaches AndroidManifest.xml verbatim. The Expo
 * docs show exactly that broken snippet in a JSON block.
 * @see https://github.com/expo/expo/issues/40513
 * @see https://docs.expo.dev/versions/latest/sdk/map-view/#add-the-api-key-to-your-project
 */

// Expo evaluates this config several times per command.
let warned = false;

module.exports = ({ config }) => {
  const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!androidGoogleMapsApiKey && !warned) {
    warned = true;
    console.warn(
      'GOOGLE_MAPS_API_KEY is not set. The Map tab shows a blank map on Android.'
    );
  }

  return {
    ...config,
    plugins: [...config.plugins, ['react-native-maps', { androidGoogleMapsApiKey }]],
  };
};
